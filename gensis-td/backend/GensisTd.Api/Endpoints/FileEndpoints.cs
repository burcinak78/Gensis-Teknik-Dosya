using Amazon.S3;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Storage;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Opens stored files: access check, then a redirect to a short-lived presigned URL.
/// Replaces the Next.js routes app/api/belge/* with the same access rules; a file the user
/// may not see answers 404 like a missing one.
/// </summary>
public static class FileEndpoints
{
    public const string DocumentsBucket = "documents";
    public const string CertificatesBucket = "certificates";
    public static readonly TimeSpan LinkLifetime = TimeSpan.FromSeconds(120);

    public static void MapFileEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/files").RequireAuthorization();

        // belge/proje: whoever can see the project.
        g.MapGet("/project/{id:guid}", async (Guid id, Actor actor, AppDbContext db, StorageService storage, CancellationToken ct) =>
            await RedirectAsync(storage, DocumentsBucket,
                await db.ProjectFiles.AsNoTracking().VisibleTo(actor).Where(f => f.Id == id).Select(f => f.StoragePath).SingleOrDefaultAsync(ct)));

        // belge/musteri: staff or a member of the document's company.
        g.MapGet("/company/{id:guid}", async (Guid id, Actor actor, AppDbContext db, StorageService storage, CancellationToken ct) =>
            await RedirectAsync(storage, DocumentsBucket,
                await db.CompanyDocuments.AsNoTracking().VisibleTo(actor).Where(d => d.Id == id).Select(d => d.StoragePath).SingleOrDefaultAsync(ct)));

        // belge/muhendis: staff or a member of the engineer's company. Wider than EngineerDocument.VisibleTo
        // (Supabase RLS, staff only) because the live route opened them with the service key after this check.
        g.MapGet("/engineer/{id:guid}", async (Guid id, Actor actor, AppDbContext db, StorageService storage, CancellationToken ct) =>
        {
            var doc = await db.EngineerDocuments.AsNoTracking().Where(d => d.Id == id)
                .Select(d => new { d.StoragePath, d.Engineer.CompanyId }).SingleOrDefaultAsync(ct);
            return await RedirectAsync(storage, DocumentsBucket,
                doc is not null && (actor.IsStaff || actor.IsCompanyMember(doc.CompanyId)) ? doc.StoragePath : null);
        });

        // belge/sertifika: equipment certificates are shared reference data; id is the certificate, not the file.
        g.MapGet("/certificate/{certificateId:guid}", async (Guid certificateId, AppDbContext db, StorageService storage, CancellationToken ct) =>
            await RedirectAsync(storage, CertificatesBucket,
                await db.CertificateFiles.AsNoTracking().Where(f => f.CertificateId == certificateId && f.IsCurrent)
                    .Select(f => f.StoragePath).SingleOrDefaultAsync(ct)));

        // belge/takip: office roles only.
        g.MapGet("/takip/{id:guid}", async (Guid id, AppDbContext db, StorageService storage, CancellationToken ct) =>
            await RedirectAsync(storage, DocumentsBucket,
                await db.TakipDokumanlars.AsNoTracking().Where(d => d.Id == id).Select(d => d.StoragePath).SingleOrDefaultAsync(ct)))
            .RequireAuthorization(Policies.Office);
    }

    private static async Task<IResult> RedirectAsync(StorageService storage, string bucket, string? key) =>
        string.IsNullOrEmpty(key)
            ? Results.NotFound()
            : Results.Redirect(await storage.PresignAsync(bucket, key, HttpVerb.GET, LinkLifetime));
}
