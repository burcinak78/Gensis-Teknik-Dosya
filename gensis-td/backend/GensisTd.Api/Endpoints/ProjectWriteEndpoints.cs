using System.Text.Json;
using System.Text.RegularExpressions;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Create / update / delete teknik dosya projects (was app/(app)/yeni/actions.ts).
/// Differences from the Next.js version: project and equipment are written in one transaction,
/// TD numbers are generated under a lock, and access is checked before anything is changed.
/// </summary>
public static partial class ProjectWriteEndpoints
{
    public record EquipmentInput(
        Guid CategoryId, string? Slot, Guid? BrandId, Guid? ModelId, Guid? CertificateId, string? SeriNo, List<string>? SeriList);

    public record ProjectInput(
        Guid CompanyId, string? DosyaNo, DateOnly? DosyaTarihi, Guid? MakineMuhendisId, Guid? ElektrikMuhendisId,
        string? BinaAdi, string? MontajAdresi, short? ProvinceId, Guid? DistrictId, int? BeyanYukuKg, int? KisiSayisi,
        decimal? BeyanHizi, int? KatAdedi, int? DurakAdedi, int? ImalYili, JsonElement? InputData,
        List<EquipmentInput>? Equipment);

    public record CreatedProject(Guid Id, string TdNo);

    public static void MapProjectWriteEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/projects").RequireAuthorization();

        g.MapPost("/", async (ProjectInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (Validate(input) is { } invalid) return invalid;
            // RLS p_projects_insert: staff, or a member of the project's company.
            if (!actor.CanAccessCompany(input.CompanyId)) return Results.Forbid();

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var project = new Project { Id = Guid.NewGuid(), CreatedBy = actor.UserId, TdNo = await NextTdNoAsync(db, ct) };
            Apply(project, input);
            db.Projects.Add(project);
            db.ProjectEquipments.AddRange(ToEquipment(project.Id, input.Equipment));
            if (await SaveAsync(db, ct) is { } failed) return failed;
            await tx.CommitAsync(ct);
            return Results.Created($"/api/projects/{project.Id}", new CreatedProject(project.Id, project.TdNo!));
        });

        g.MapPut("/{id:guid}", async (Guid id, ProjectInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (Validate(input) is { } invalid) return invalid;
            var project = await db.Projects.VisibleTo(actor).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (project is null) return Results.NotFound();
            // RLS WITH CHECK: the project may not be moved to a company the user does not belong to.
            if (!actor.CanAccessCompany(input.CompanyId)) return Results.Forbid();

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            Apply(project, input);
            // Equipment is replaced as a whole, as before, but now inside the transaction.
            await db.ProjectEquipments.Where(e => e.ProjectId == id).ExecuteDeleteAsync(ct);
            db.ProjectEquipments.AddRange(ToEquipment(id, input.Equipment));
            if (await SaveAsync(db, ct) is { } failed) return failed;
            await tx.CommitAsync(ct);
            return Results.Ok(new { id });
        });

        g.MapDelete("/{id:guid}", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var project = await db.Projects.VisibleTo(actor).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (project is null) return Results.NotFound();

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            // Accounting rows created for this TD go too, unless already posted (cariye işlendi).
            if (!string.IsNullOrEmpty(project.TdNo))
                await db.TakipProjelers
                    .Where(t => t.TdNo == project.TdNo && (t.TakipMuhasebe == null || !t.TakipMuhasebe.CariyeIslendi))
                    .ExecuteDeleteAsync(ct);
            db.Projects.Remove(project); // project_equipment, project_files cascade in the database
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Results.NoContent();
        });
    }

    private static IResult? Validate(ProjectInput input)
    {
        var errors = new Dictionary<string, string[]>();
        if (input.CompanyId == Guid.Empty) errors["companyId"] = ["Firma seçilmedi."];
        if (string.IsNullOrWhiteSpace(input.DosyaNo)) errors["dosyaNo"] = ["Dosya no boş olamaz."];
        if (input.InputData is { ValueKind: not (JsonValueKind.Object or JsonValueKind.Null or JsonValueKind.Undefined) })
            errors["inputData"] = ["inputData bir JSON nesnesi olmalı."];
        var slots = Selected(input.Equipment).Select(e => (e.CategoryId, Slot: SlotOf(e))).ToList();
        if (slots.Count != slots.Distinct().Count())
            errors["equipment"] = ["Aynı kategori ve slot iki kez seçilmiş."];
        return errors.Count == 0 ? null : Results.ValidationProblem(errors);
    }

    private static void Apply(Project p, ProjectInput i)
    {
        p.CompanyId = i.CompanyId;
        p.DosyaNo = i.DosyaNo!.Trim();
        p.DosyaTarihi = i.DosyaTarihi;
        p.MakineMuhendisId = i.MakineMuhendisId;
        p.ElektrikMuhendisId = i.ElektrikMuhendisId;
        p.BinaAdi = i.BinaAdi;
        p.MontajAdresi = i.MontajAdresi;
        p.ProvinceId = i.ProvinceId;
        p.DistrictId = i.DistrictId;
        p.BeyanYukuKg = i.BeyanYukuKg;
        p.KisiSayisi = i.KisiSayisi;
        p.BeyanHizi = i.BeyanHizi;
        p.KatAdedi = i.KatAdedi;
        p.DurakAdedi = i.DurakAdedi;
        p.ImalYili = i.ImalYili;
        p.InputData = i.InputData is { ValueKind: JsonValueKind.Object } json ? json.GetRawText() : "{}";
    }

    // Rows with neither brand nor model are empty pickers in the wizard and are not stored.
    private static IEnumerable<EquipmentInput> Selected(List<EquipmentInput>? equipment) =>
        (equipment ?? []).Where(e => e.ModelId is not null || e.BrandId is not null);

    private static string SlotOf(EquipmentInput e) => string.IsNullOrWhiteSpace(e.Slot) ? "main" : e.Slot.Trim();

    private static IEnumerable<ProjectEquipment> ToEquipment(Guid projectId, List<EquipmentInput>? equipment) =>
        Selected(equipment).Select(e => new ProjectEquipment
        {
            ProjectId = projectId,
            CategoryId = e.CategoryId,
            Slot = SlotOf(e),
            BrandId = e.BrandId,
            ModelId = e.ModelId,
            CertificateId = e.CertificateId,
            SeriNo = e.SeriNo,
            SeriList = e.SeriList is null ? null : JsonSerializer.Serialize(e.SeriList),
        });

    /// <summary>Unknown company/engineer/district/... ids come back as 400 instead of 500.</summary>
    private static async Task<IResult?> SaveAsync(AppDbContext db, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return null;
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation } pg)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["reference"] = [$"Geçersiz kayıt referansı ({pg.ConstraintName})."] });
        }
    }

    // ---------- TD No: TD-YY-0001, per year, global across companies ----------

    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    private static async Task<string> NextTdNoAsync(AppDbContext db, CancellationToken ct)
    {
        // Serializes concurrent creates until the transaction ends; td_no has no unique index
        // (existing data may contain duplicates), so the lock is what prevents new ones.
        await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(hashtext('projects.td_no'))", ct);
        var prefix = TdPrefix(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Istanbul).Year);
        // Longest first, then text: keeps TD-26-10000 above TD-26-9999.
        var last = await db.Projects.Where(p => p.TdNo != null && p.TdNo.StartsWith(prefix))
            .OrderByDescending(p => p.TdNo!.Length).ThenByDescending(p => p.TdNo)
            .Select(p => p.TdNo).FirstOrDefaultAsync(ct);
        return NextTdNo(prefix, last);
    }

    public static string TdPrefix(int year) => $"TD-{year % 100:00}-";

    public static string NextTdNo(string prefix, string? last)
    {
        var m = last is null ? null : TrailingNumber().Match(last);
        var next = m is { Success: true } ? int.Parse(m.Groups[1].Value) + 1 : 1;
        return $"{prefix}{next:0000}";
    }

    [GeneratedRegex(@"(\d+)\s*$")]
    private static partial Regex TrailingNumber();
}
