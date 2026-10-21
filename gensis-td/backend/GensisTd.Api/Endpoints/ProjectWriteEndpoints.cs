using System.Text.Json;
using System.Text.RegularExpressions;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Storage;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Projects;
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

        g.MapDelete("/{id:guid}", async (Guid id, Actor actor, AppDbContext db, StorageService storage, ILoggerFactory logs,
            CancellationToken ct) =>
        {
            var project = await db.Projects.VisibleTo(actor).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (project is null) return Results.NotFound();

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            // Read before the cascade removes the rows; the objects go once the delete is committed.
            var paths = await db.ProjectFiles.Where(f => f.ProjectId == id).Select(f => f.StoragePath).ToListAsync(ct);
            await TakipCleanup.RemoveUnpostedAsync(db, project, ct);
            db.Projects.Remove(project); // project_equipment, project_files cascade in the database
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, paths, logs.CreateLogger(nameof(ProjectWriteEndpoints)));
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

    /// <summary>
    /// Numbers are never reused (user decision 2026-10-21): td_counters keeps the last number per year,
    /// so deleting a project does not free its number. The upsert's row lock serializes concurrent
    /// creates. The counter never falls behind numbers already in the data (projects and takip rows,
    /// e.g. after the data migration), hence GREATEST with the highest existing number + 1.
    /// </summary>
    private static async Task<string> NextTdNoAsync(AppDbContext db, CancellationToken ct)
    {
        var year = (short)TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Istanbul).Year;
        var prefix = TdPrefix(year);
        // Longest first, then text: keeps TD-26-10000 above TD-26-9999.
        var last = await db.Projects.Select(p => p.TdNo)
            .Concat(db.TakipProjelers.Select(t => t.TdNo))
            .Where(td => td != null && td.StartsWith(prefix))
            .OrderByDescending(td => td!.Length).ThenByDescending(td => td)
            .FirstOrDefaultAsync(ct);
        var floor = LastNumber(last) + 1;
        // ToListAsync, not SingleAsync: an INSERT cannot be wrapped in the SELECT ... LIMIT that Single adds.
        var next = await db.Database.SqlQuery<int>($"""
            INSERT INTO td_counters (year, last_no) VALUES ({year}, {floor})
            ON CONFLICT (year) DO UPDATE SET last_no = GREATEST(td_counters.last_no + 1, EXCLUDED.last_no)
            RETURNING last_no AS "Value"
            """).ToListAsync(ct);
        return FormatTdNo(prefix, next.Single());
    }

    public static string TdPrefix(int year) => $"TD-{year % 100:00}-";

    public static string FormatTdNo(string prefix, int number) => $"{prefix}{number:0000}";

    /// <summary>Trailing number of an existing TD No, 0 when there is none.</summary>
    public static int LastNumber(string? tdNo)
    {
        var m = tdNo is null ? null : TrailingNumber().Match(tdNo);
        return m is { Success: true } ? int.Parse(m.Groups[1].Value) : 0;
    }

    [GeneratedRegex(@"(\d+)\s*$")]
    private static partial Regex TrailingNumber();
}
