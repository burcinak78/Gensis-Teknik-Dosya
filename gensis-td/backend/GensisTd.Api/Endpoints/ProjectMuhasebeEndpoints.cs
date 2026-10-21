using System.Text.Json;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Projects;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// "Muhasebeye gönder" from the teknik dosya wizard (yeni/actions.ts sendProjectToMuhasebe,
/// removeProjectFromMuhasebe). The live actions used the service key without checking the project;
/// here project access comes first and only takip rows matching <see cref="TakipCleanup.RemovableFor"/>'s
/// company rule (same TD number, project's company or none) are touched. A posted row (cariye işlendi)
/// is never changed.
/// </summary>
public static class ProjectMuhasebeEndpoints
{
    public static readonly string[] FaturaTipleri = ["faturali", "faturasiz"];
    public static readonly string[] TeslimTipleri = ["hard_copy", "dijital"];

    public record MuhasebeStatus(bool Sent, bool Posted);
    public record MuhasebeInput(decimal Fiyat, string? FaturaTipi, string? TeslimTipi);

    public static void MapProjectMuhasebeEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/projects/{id:guid}/muhasebe").RequireAuthorization();

        g.MapGet("/", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var project = await db.Projects.AsNoTracking().VisibleTo(actor).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (project is null) return Results.NotFound();
            var row = await LinkedRows(db, project).Select(t => new { Posted = t.TakipMuhasebe != null && t.TakipMuhasebe.CariyeIslendi })
                .FirstOrDefaultAsync(ct);
            return Results.Ok(new MuhasebeStatus(row is not null, row?.Posted == true));
        });

        g.MapPut("/", async (Guid id, MuhasebeInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var errors = new Dictionary<string, string[]>();
            if (input.Fiyat <= 0) errors["fiyat"] = ["Muhasebeye göndermek için fiyat girilmeli."];
            if (input.FaturaTipi is null || !FaturaTipleri.Contains(input.FaturaTipi)) errors["faturaTipi"] = ["Geçersiz fatura tipi."];
            if (input.TeslimTipi is null || !TeslimTipleri.Contains(input.TeslimTipi)) errors["teslimTipi"] = ["Geçersiz teslim tipi."];
            if (errors.Count > 0) return Results.ValidationProblem(errors);

            var project = await db.Projects.AsNoTracking().VisibleTo(actor).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (project is null) return Results.NotFound();
            if (string.IsNullOrEmpty(project.TdNo))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["tdNo"] = ["Projenin TD numarası yok."] });

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var row = await LinkedRows(db, project).Include(t => t.TakipMuhasebe).FirstOrDefaultAsync(ct);
            if (row?.TakipMuhasebe?.CariyeIslendi == true) return Results.Conflict();

            if (row is null)
            {
                row = new TakipProjeler
                {
                    Id = Guid.NewGuid(),
                    ProjeNo = await NextTakipNoAsync(db, ct),
                    ProjeTipi = "uygulama", // required by the schema; accounting shows it as a TD
                    Durum = "HAZIRLANIYOR",
                    CreatedBy = actor.UserId,
                };
                db.TakipProjelers.Add(row);
            }
            await ApplyAsync(db, row, project, input, ct);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Results.Ok(new { row.Id, row.ProjeNo });
        });

        g.MapDelete("/", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var project = await db.Projects.AsNoTracking().VisibleTo(actor).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (project is null) return Results.NotFound();
            await TakipCleanup.RemoveUnpostedAsync(db, project, ct);
            return Results.NoContent();
        });
    }

    // Takip rows this project may touch: same TD number, the project's company or none (KRR-013).
    private static IQueryable<TakipProjeler> LinkedRows(AppDbContext db, Project project) =>
        db.TakipProjelers.Where(t => project.TdNo != null && t.TdNo == project.TdNo
            && (t.CompanyId == project.CompanyId || t.CompanyId == null));

    private static async Task ApplyAsync(AppDbContext db, TakipProjeler row, Project project, MuhasebeInput input, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrEmpty(project.InputData) ? "{}" : project.InputData);
        string? Text(string name) => doc.RootElement.ValueKind == JsonValueKind.Object
            && doc.RootElement.TryGetProperty(name, out var v) && v.ValueKind is JsonValueKind.String or JsonValueKind.Number
            ? v.ToString() is { Length: > 0 } s ? s : null
            : null;

        row.CompanyId = project.CompanyId;
        row.TdNo = project.TdNo;
        row.Ada = Text("ada");
        row.Parsel = Text("parsel");
        row.AdaParsel = string.Join(" / ", new[] { row.Ada, row.Parsel }.Where(s => s != null)) is { Length: > 0 } ap ? ap : null;
        row.IsAdi = project.BinaAdi;
        row.IlAdi = project.ProvinceId is { } pid
            ? await db.Provinces.Where(p => p.Id == pid).Select(p => p.Name).FirstOrDefaultAsync(ct) : null;
        row.IlceAdi = project.DistrictId is { } did
            ? await db.Districts.Where(d => d.Id == did).Select(d => d.Name).FirstOrDefaultAsync(ct) : null;
        row.Fiyat = input.Fiyat;
        row.FaturaTipi = input.FaturaTipi;
        row.ToplamTutar = input.FaturaTipi == "faturali" ? Math.Round(input.Fiyat * 1.2m, 2) : input.Fiyat;
        row.TeslimTipi = input.TeslimTipi;
        row.MuhasebeyeGonderildi = true;
        row.MuhasebeDurumu = "bekliyor";
        row.UpdatedAt = DateTime.UtcNow;
    }

    // Same as public.next_takip_no() without calling the SECURITY DEFINER function (the app role cannot).
    // Never handed out twice: a deleted takip record does not give its number back (user decision).
    internal static async Task<int> NextTakipNoAsync(AppDbContext db, CancellationToken ct) =>
        (await db.Database.SqlQuery<int>($"""
            INSERT INTO public.takip_counter (id, next_no) VALUES (1, 1002)
            ON CONFLICT (id) DO UPDATE SET next_no = public.takip_counter.next_no + 1
            RETURNING next_no - 1 AS "Value"
            """).ToListAsync(ct)).Single();
}
