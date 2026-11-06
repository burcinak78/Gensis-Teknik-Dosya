using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// TD wizard "Proje No" picker (z8qgvcc7xf): completed Proje Takip jobs a teknik dosya can be opened from, with
/// the details the wizard fills in and the job's documents. The documents stay in Proje Takip (linked, not
/// copied, not counted in the 20-attachment limit). Unlike /api/takip this is open to customers, filtered by
/// <see cref="AccessFilters.SelectableBy"/>, and returns no price, accounting, owner or waiting note.
/// </summary>
public static class TakipSecimEndpoints
{
    public record SecimDoc(Guid Id, string Kind, string? OriginalName, DateTime CreatedAt);

    public record SecimRow(
        Guid Id, int ProjeNo, Guid? CompanyId, string? IsAdi, string? Ada, string? Parsel, string? AdaParsel,
        int? ProvinceId, Guid? DistrictId, string? IlAdi, string? IlceAdi, int? AsansorSayisi, string? AsansorTipi,
        string? AsansorSeriNo, DateOnly? TamamlanmaTarihi, int LinkedTdCount, List<SecimDoc> Docs);

    public static void MapTakipSecimEndpoints(this WebApplication app)
    {
        app.MapGet("/api/takip-secim", async (Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var rows = await db.TakipProjelers.AsNoTracking().SelectableBy(actor)
                .OrderByDescending(t => t.ProjeNo).Take(5000)
                .Select(t => new
                {
                    t.Id, t.ProjeNo, t.CompanyId, t.IsAdi, t.Ada, t.Parsel, t.AdaParsel, t.ProvinceId, t.DistrictId, t.IlAdi,
                    t.IlceAdi, t.AsansorSayisi, t.AsansorTipi, t.AsansorSeriNo, t.TamamlanmaTarihi,
                    Linked = db.Projects.Count(p => p.TakipId == t.Id),
                })
                .ToListAsync(ct);
            var ids = rows.Select(r => r.Id).ToList();
            var docs = (await db.TakipDokumanlars.AsNoTracking()
                    .Where(d => ids.Contains(d.TakipId) || (d.Takip.ParentId != null && ids.Contains(d.Takip.ParentId.Value)))
                    .Select(d => new { Root = d.Takip.ParentId ?? d.TakipId, Doc = new SecimDoc(d.Id, d.Kind, d.OriginalName, d.CreatedAt) })
                    .ToListAsync(ct))
                .ToLookup(d => d.Root, d => d.Doc);
            return rows.Select(r => new SecimRow(
                r.Id, r.ProjeNo, r.CompanyId, r.IsAdi, r.Ada, r.Parsel, r.AdaParsel, r.ProvinceId,
                Guid.TryParse(r.DistrictId, out var district) ? district : null, r.IlAdi, r.IlceAdi, r.AsansorSayisi,
                r.AsansorTipi, r.AsansorSeriNo, r.TamamlanmaTarihi, r.Linked, Latest(docs[r.Id])));
        }).RequireAuthorization();
    }

    /// <summary>
    /// The job's documents with its revisions'. A single-file kind (yapı ruhsatı, mimari proje, ...) can be on the
    /// job and on a revision: the newest one is the current one. Other kinds keep every file.
    /// </summary>
    public static List<SecimDoc> Latest(IEnumerable<SecimDoc> docs) =>
        docs.GroupBy(d => TakipEndpoints.SingleKinds.Contains(d.Kind) ? d.Kind : d.Id.ToString())
            .Select(g => g.OrderByDescending(d => d.CreatedAt).First())
            .OrderBy(d => d.CreatedAt).ToList();

    /// <summary>Storage key of a document of a job the actor may pick, or null (open as 404).</summary>
    public static Task<string?> DocumentKeyAsync(AppDbContext db, Actor actor, Guid docId, CancellationToken ct) =>
        db.TakipDokumanlars.AsNoTracking()
            .Where(d => d.Id == docId && db.TakipProjelers.SelectableBy(actor).Any(r => r.Id == (d.Takip.ParentId ?? d.TakipId)))
            .Select(d => d.StoragePath).SingleOrDefaultAsync(ct);

    /// <summary>
    /// The link a teknik dosya may store: a job the actor may pick, of the file's own company, so a linked
    /// document never reaches another company's file (and its users) through the TD. 400 otherwise.
    /// An unchanged link is kept without the pick check (the job stays completed; KRR-032), but the company must still match.
    /// </summary>
    public static async Task<IResult?> ValidateLinkAsync(AppDbContext db, Actor actor, Guid? takipId, Guid companyId,
        Guid? currentTakipId, CancellationToken ct)
    {
        if (takipId is not { } id) return null;
        var source = takipId == currentTakipId ? db.TakipProjelers.AsNoTracking() : db.TakipProjelers.AsNoTracking().SelectableBy(actor);
        var company = await source.Where(t => t.Id == id).Select(t => new { t.CompanyId }).SingleOrDefaultAsync(ct);
        if (company is null)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["takipId"] = ["Proje Takip projesi bulunamadı ya da tamamlanmamış."] });
        if (company.CompanyId != companyId)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["takipId"] = ["Seçilen Proje Takip projesi bu firmanın değil."] });
        return null;
    }

    /// <summary>
    /// Linked yapı ruhsatı for the PDF when the file has none of its own (user decision 2026-11-06). Only while the
    /// job still belongs to the file's company: if the job is moved to another company later, its permit stays there.
    /// </summary>
    public static async Task<List<string>> LinkedYapiRuhsatiAsync(AppDbContext db, Guid? takipId, Guid companyId, CancellationToken ct)
    {
        if (takipId is not { } id) return [];
        if (!await db.TakipProjelers.AnyAsync(t => t.Id == id && t.CompanyId == companyId, ct)) return [];
        var key = await db.TakipDokumanlars.AsNoTracking()
            .Where(d => d.Kind == "yapi_ruhsati" && (d.TakipId == id || d.Takip.ParentId == id))
            .OrderByDescending(d => d.CreatedAt).Select(d => d.StoragePath).FirstOrDefaultAsync(ct);
        return key is null ? [] : [key];
    }
}
