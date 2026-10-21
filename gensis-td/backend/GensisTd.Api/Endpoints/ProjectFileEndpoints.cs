using System.Text.RegularExpressions;
using Amazon.S3;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Storage;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Files attached to a project (yeni/actions.ts uploadProjectFile, deleteProjectFile).
/// Upload is two steps so the file goes from the browser straight to storage:
/// 1. POST upload-url: access check, the server picks the key and signs a PUT for it.
/// 2. POST files: the server checks the object exists under that project and records it.
/// An upload that is never confirmed leaves an unreferenced object and no row.
/// </summary>
public static partial class ProjectFileEndpoints
{
    public static readonly string[] Kinds =
        ["yapi_ruhsati", "modul_g_belge", "modul_g_rapor", "fatura", "periyodik_kontrol", "asansor_projesi"];
    public const long MaxBytes = 50 * 1024 * 1024;
    public static readonly TimeSpan UploadLifetime = TimeSpan.FromMinutes(10);

    public record UploadUrlRequest(string? Kind, string? FileName, string? ContentType);
    public record UploadUrl(string Key, string Url, string ContentType, DateTime ExpiresAt);

    public record ProjectFileInput(
        string? Key, string? OriginalName, string? BelgeNo, DateOnly? IssueDate, DateOnly? ValidUntil, Guid? NotifiedBodyId,
        DateOnly? ReportDate, string? FaturaNo, DateOnly? FaturaTarihi, string? ProjeNo);

    public record ProjectFileDto(
        Guid Id, string Kind, string? OriginalName, string? BelgeNo, DateOnly? IssueDate, DateOnly? ValidUntil, Guid? NotifiedBodyId,
        DateOnly? ReportDate, string? FaturaNo, DateOnly? FaturaTarihi, string? ProjeNo, int SortOrder, DateTime UploadedAt);

    public static void MapProjectFileEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/projects/{projectId:guid}/files").RequireAuthorization();

        g.MapGet("/", async (Guid projectId, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (!await db.Projects.VisibleTo(actor).AnyAsync(p => p.Id == projectId, ct)) return Results.NotFound();
            return Results.Ok(await db.ProjectFiles.AsNoTracking().Where(f => f.ProjectId == projectId)
                .OrderBy(f => f.Kind).ThenBy(f => f.SortOrder).ThenBy(f => f.UploadedAt)
                .Select(f => new ProjectFileDto(f.Id, f.Kind, f.OriginalName, f.BelgeNo, f.IssueDate, f.ValidUntil, f.NotifiedBodyId,
                    f.ReportDate, f.FaturaNo, f.FaturaTarihi, f.ProjeNo, f.SortOrder, f.UploadedAt))
                .ToListAsync(ct));
        });

        g.MapPost("/upload-url", async (Guid projectId, UploadUrlRequest req, Actor actor, AppDbContext db, StorageService storage, CancellationToken ct) =>
        {
            if (req.Kind is null || !Kinds.Contains(req.Kind))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["kind"] = ["Geçersiz dosya türü."] });
            if (!await db.Projects.VisibleTo(actor).AnyAsync(p => p.Id == projectId, ct)) return Results.NotFound();

            var key = NewKey(projectId, req.Kind, req.FileName);
            var contentType = string.IsNullOrWhiteSpace(req.ContentType) ? "application/octet-stream" : req.ContentType.Trim();
            var expires = DateTime.UtcNow.Add(UploadLifetime);
            var url = await storage.PresignAsync(FileEndpoints.DocumentsBucket, key, HttpVerb.PUT, UploadLifetime, contentType);
            return Results.Ok(new UploadUrl(key, url, contentType, expires));
        });

        g.MapPost("/", async (Guid projectId, ProjectFileInput input, Actor actor, AppDbContext db, StorageService storage, CancellationToken ct) =>
        {
            if (!await db.Projects.VisibleTo(actor).AnyAsync(p => p.Id == projectId, ct)) return Results.NotFound();

            // Only a key issued for this project (step 1) can be recorded, so nobody can attach another project's object.
            var kind = input.Key is null ? null : KindOf(projectId, input.Key);
            if (kind is null)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["key"] = ["Geçersiz dosya anahtarı."] });
            if (await db.ProjectFiles.AnyAsync(f => f.StoragePath == input.Key, ct))
                return Results.Conflict();
            if (input.NotifiedBodyId is { } nb && !await db.NotifiedBodies.AnyAsync(b => b.Id == nb, ct))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["notifiedBodyId"] = ["Onaylanmış kuruluş bulunamadı."] });

            var size = await storage.SizeAsync(FileEndpoints.DocumentsBucket, input.Key!, ct);
            if (size is null)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["key"] = ["Dosya yüklenmemiş."] });
            if (size > MaxBytes)
            {
                await storage.DeleteAsync(FileEndpoints.DocumentsBucket, input.Key!, ct);
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["key"] = ["Dosya 50 MB'den büyük olamaz."] });
            }

            var file = new ProjectFile
            {
                Id = Guid.NewGuid(),
                ProjectId = projectId,
                Kind = kind,
                StoragePath = input.Key!,
                OriginalName = Clean(input.OriginalName),
                // Appended within the project and kind, as before (sort_order = current count).
                SortOrder = await db.ProjectFiles.CountAsync(f => f.ProjectId == projectId && f.Kind == kind, ct),
                BelgeNo = Clean(input.BelgeNo),
                IssueDate = input.IssueDate,
                ValidUntil = input.ValidUntil,
                NotifiedBodyId = input.NotifiedBodyId,
                ReportDate = input.ReportDate,
                FaturaNo = Clean(input.FaturaNo),
                FaturaTarihi = input.FaturaTarihi,
                ProjeNo = Clean(input.ProjeNo),
                UploadedBy = actor.UserId,
                UploadedAt = DateTime.UtcNow,
            };
            db.ProjectFiles.Add(file);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/files/project/{file.Id}", new { file.Id });
        });

        g.MapDelete("/{fileId:guid}", async (Guid projectId, Guid fileId, Actor actor, AppDbContext db, StorageService storage,
            ILoggerFactory logs, CancellationToken ct) =>
        {
            var file = await db.ProjectFiles.VisibleTo(actor).SingleOrDefaultAsync(f => f.Id == fileId && f.ProjectId == projectId, ct);
            if (file is null) return Results.NotFound();
            db.ProjectFiles.Remove(file);
            await db.SaveChangesAsync(ct);
            await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, [file.StoragePath], logs.CreateLogger(nameof(ProjectFileEndpoints)));
            return Results.NoContent();
        });
    }

    // Same layout as the live app: proje/{projectId}/{kind}-{uuid}.{ext}
    public static string NewKey(Guid projectId, string kind, string? fileName)
    {
        var ext = Path.GetExtension(fileName ?? "").TrimStart('.').ToLowerInvariant();
        ext = NonAlnum().Replace(ext, "");
        if (ext.Length is 0 or > 10) ext = "bin";
        return $"proje/{projectId}/{kind}-{Guid.NewGuid()}.{ext}";
    }

    /// <summary>The kind encoded in a key issued for this project, or null if the key was not issued by NewKey for it.</summary>
    public static string? KindOf(Guid projectId, string key)
    {
        var m = KeyPattern().Match(key);
        return m.Success && m.Groups["project"].Value == projectId.ToString() && Kinds.Contains(m.Groups["kind"].Value)
            ? m.Groups["kind"].Value
            : null;
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    [GeneratedRegex("[^a-z0-9]")]
    private static partial Regex NonAlnum();

    [GeneratedRegex(@"^proje/(?<project>[0-9a-f-]{36})/(?<kind>[a-z_]+)-[0-9a-f-]{36}\.[a-z0-9]{1,10}$")]
    private static partial Regex KeyPattern();
}
