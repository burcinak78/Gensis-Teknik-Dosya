using System.Text.Json;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Storage;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Data for the teknik dosya PDF, which Next.js renders (app/api/pdf/teknik-dosya). The live route read
/// these rows with the Supabase service key after one access check; here the same check comes first and
/// the route gets everything in one bundle. Attachments are streamed through /file, limited to the files
/// that belong to the project (its files, its engineers' and company's documents, its certificates).
/// </summary>
public static class PdfSourceEndpoints
{
    public record ProjectPart(
        Guid? MakineMuhendisId, Guid? ElektrikMuhendisId, Guid CompanyId, JsonElement InputData, string? BinaAdi, string? TdNo);
    public record CompanyPart(string? Phone, string? MobilePhone, string? Email);
    public record ProjectFileRef(string Kind, string Path, int SortOrder);
    public record EngineerDocRef(Guid EngineerId, string DocType, string Path);
    public record CompanyDocRef(Guid Id, string DocType, string? Path, string? BelgeNo, DateOnly? IssueDate, Guid? NotifiedBodyId);
    public record NotifiedBodyPart(Guid Id, string Name, string? ShortName, string? IdentityNo, string? Address);
    public record CategoryPart(string Code, string Name, string DriveType);
    public record EquipmentPart(string Slot, string CategoryCode, string? BrandName, Guid? CertificateId, JsonElement? SeriList);
    public record CertificateFileRef(Guid CertificateId, string Path);

    public record TeknikDosyaSource(
        JsonElement Context, ProjectPart Project, CompanyPart? Company, List<ProjectFileRef> ProjectFiles,
        List<EngineerDocRef> EngineerDocs, List<CompanyDocRef> CompanyDocs, List<NotifiedBodyPart> NotifiedBodies,
        List<CategoryPart> EquipmentCategories, List<EquipmentPart> Equipment, List<CertificateFileRef> CertificateFiles);

    public static void MapPdfSourceEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/projects/{id:guid}/pdf-source").RequireAuthorization();

        g.MapGet("/", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var p = await db.Projects.AsNoTracking().VisibleTo(actor).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (p is null) return Results.NotFound();

            var context = await db.Database
                .SqlQuery<string>($"SELECT public.project_render_context({id})::text AS \"Value\"").SingleAsync(ct);
            var engineerIds = new[] { p.MakineMuhendisId, p.ElektrikMuhendisId }.OfType<Guid>().ToList();
            var equipment = await db.ProjectEquipments.AsNoTracking().Where(e => e.ProjectId == id)
                .Select(e => new { e.Slot, CategoryCode = e.Category.Code, BrandName = e.Brand != null ? e.Brand.Name : null, e.CertificateId, e.SeriList })
                .ToListAsync(ct);
            var certIds = equipment.Select(e => e.CertificateId).OfType<Guid>().Distinct().ToList();

            return Results.Ok(new TeknikDosyaSource(
                ParseJson(context),
                new ProjectPart(p.MakineMuhendisId, p.ElektrikMuhendisId, p.CompanyId, ParseJson(p.InputData), p.BinaAdi, p.TdNo),
                await db.Companies.AsNoTracking().Where(c => c.Id == p.CompanyId)
                    .Select(c => new CompanyPart(c.Phone, c.MobilePhone, c.Email)).SingleOrDefaultAsync(ct),
                await db.ProjectFiles.AsNoTracking().Where(f => f.ProjectId == id).OrderBy(f => f.SortOrder)
                    .Select(f => new ProjectFileRef(f.Kind, f.StoragePath, f.SortOrder)).ToListAsync(ct),
                await db.EngineerDocuments.AsNoTracking().Where(d => engineerIds.Contains(d.EngineerId) && d.StoragePath != null)
                    .Select(d => new EngineerDocRef(d.EngineerId, d.DocType, d.StoragePath!)).ToListAsync(ct),
                await db.CompanyDocuments.AsNoTracking().Where(d => d.CompanyId == p.CompanyId)
                    .OrderByDescending(d => d.IssueDate)
                    .Select(d => new CompanyDocRef(d.Id, d.DocType, d.StoragePath, d.BelgeNo, d.IssueDate, d.NotifiedBodyId)).ToListAsync(ct),
                await db.NotifiedBodies.AsNoTracking()
                    .Select(n => new NotifiedBodyPart(n.Id, n.Name, n.ShortName, n.IdentityNo, n.Address)).ToListAsync(ct),
                await db.EquipmentCategories.AsNoTracking()
                    .Select(c => new CategoryPart(c.Code, c.Name, c.DriveType)).ToListAsync(ct),
                equipment.Select(e => new EquipmentPart(e.Slot, e.CategoryCode, e.BrandName, e.CertificateId,
                    e.SeriList is null ? null : ParseJson(e.SeriList))).ToList(),
                await db.CertificateFiles.AsNoTracking().Where(f => f.IsCurrent && certIds.Contains(f.CertificateId))
                    .Select(f => new CertificateFileRef(f.CertificateId, f.StoragePath)).ToListAsync(ct)));
        });

        g.MapGet("/file", async (Guid id, string? bucket, string? path, Actor actor, AppDbContext db, StorageService storage,
            HttpContext http, CancellationToken ct) =>
        {
            if (string.IsNullOrEmpty(path) || bucket is not (FileEndpoints.DocumentsBucket or FileEndpoints.CertificatesBucket))
                return Results.NotFound();
            var p = await db.Projects.AsNoTracking().VisibleTo(actor)
                .Select(x => new { x.Id, x.CompanyId, x.MakineMuhendisId, x.ElektrikMuhendisId })
                .SingleOrDefaultAsync(x => x.Id == id, ct);
            if (p is null || !await BelongsToProjectAsync(db, p.Id, p.CompanyId, p.MakineMuhendisId, p.ElektrikMuhendisId, bucket, path, ct))
                return Results.NotFound();

            var obj = await storage.OpenReadAsync(bucket, path, ct);
            if (obj is not { } o) return Results.NotFound();
            // KRR-020: the stored Content-Type is whatever the uploader declared. Served from the app's own
            // origin it must never render, so always a nosniff download; the PDF route only needs the bytes.
            http.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.Stream(o.Body, "application/octet-stream", Path.GetFileName(path));
        });
    }

    private static async Task<bool> BelongsToProjectAsync(AppDbContext db, Guid projectId, Guid companyId, Guid? makine, Guid? elektrik,
        string bucket, string path, CancellationToken ct)
    {
        if (bucket == FileEndpoints.CertificatesBucket)
            return await db.CertificateFiles.AnyAsync(f => f.IsCurrent && f.StoragePath == path
                && db.ProjectEquipments.Any(e => e.ProjectId == projectId && e.CertificateId == f.CertificateId), ct);

        var engineerIds = new[] { makine, elektrik }.OfType<Guid>().ToList();
        return await db.ProjectFiles.AnyAsync(f => f.ProjectId == projectId && f.StoragePath == path, ct)
            || await db.EngineerDocuments.AnyAsync(d => d.StoragePath == path && engineerIds.Contains(d.EngineerId), ct)
            || await db.CompanyDocuments.AnyAsync(d => d.StoragePath == path && d.CompanyId == companyId, ct);
    }

    private static JsonElement ParseJson(string? json)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrEmpty(json) ? "{}" : json);
        return doc.RootElement.Clone();
    }
}
