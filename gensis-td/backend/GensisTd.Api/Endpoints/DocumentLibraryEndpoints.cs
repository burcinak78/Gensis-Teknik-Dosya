using System.Text.Json;
using Amazon.S3;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Storage;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Document library (z8qgvcc134): staff keep PDFs per company and document type; a project can use one in place
/// of the generated document. Everything here is staff only. Customers and accountants only ever receive a chosen
/// file inside their teknik dosya output, never its name, id or the other documents.
/// </summary>
public static class DocumentLibraryEndpoints
{
    public const string Folder = "library";
    public const string SonKontrol = "son_kontrol_formu";
    public static readonly string[] DocTypes =
        ["bakim_sozlesmesi", SonKontrol, "kullanma_bakim_klavuzu", "seyir_defteri", "egitim_tutanagi", "teslim_tutanagi"];

    public record UploadUrlRequest(Guid CompanyId, string? DocType, string? FileName);
    public record ConfirmRequest(Guid CompanyId, string? Key, string? OriginalName, bool IsDefault);
    public record DefaultRequest(bool IsDefault);
    public record LibraryItem(
        Guid Id, Guid CompanyId, string CompanyShortName, string DocType, string OriginalName, long SizeBytes, bool IsDefault,
        DateTime? ArchivedAt, DateTime UploadedAt, int UsedBy);
    public record ChoiceRequest(Guid? LibraryDocumentId);
    public record ChoiceOption(Guid Id, string FileName, bool IsDefault);
    public record ChoiceRow(string DocType, string Source, Guid? DocumentId, string? FileName, List<ChoiceOption> Options);
    public record ProjectChoices(bool Locked, List<ChoiceRow> Rows);

    public static void MapDocumentLibraryEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/document-library").RequireAuthorization(Policies.Staff);

        g.MapGet("/", async (Guid? companyId, string? docType, bool? archived, AppDbContext db, CancellationToken ct) =>
        {
            var q = db.LibraryDocuments.AsNoTracking().AsQueryable();
            if (companyId is { } c) q = q.Where(d => d.CompanyId == c);
            if (!string.IsNullOrEmpty(docType)) q = q.Where(d => d.DocType == docType);
            if (archived != true) q = q.Where(d => d.ArchivedAt == null);
            return await q.OrderBy(d => d.Company.ShortName).ThenBy(d => d.DocType).ThenByDescending(d => d.UploadedAt)
                .Select(d => new LibraryItem(d.Id, d.CompanyId, d.Company.ShortName, d.DocType, d.OriginalName, d.SizeBytes, d.IsDefault,
                    d.ArchivedAt, d.UploadedAt, db.ProjectDocumentChoices.Count(x => x.LibraryDocumentId == d.Id)))
                .ToListAsync(ct);
        });

        g.MapPost("/upload-url", async (UploadUrlRequest req, AppDbContext db, StorageService storage, CancellationToken ct) =>
        {
            if (req.DocType is null || !DocTypes.Contains(req.DocType)) return Invalid("docType", "Geçersiz doküman tipi.");
            if (!await db.Companies.AnyAsync(c => c.Id == req.CompanyId, ct)) return Results.NotFound();
            // The extension is always .pdf, whatever the uploaded name says.
            var key = UploadKeys.New(Folder, req.CompanyId, req.DocType, "dokuman.pdf", pending: false);
            var url = await storage.PresignAsync(FileEndpoints.DocumentsBucket, key, HttpVerb.PUT, UploadKeys.UploadLifetime, "application/pdf");
            return Results.Ok(new { key, url, contentType = "application/pdf", expiresAt = DateTime.UtcNow.Add(UploadKeys.UploadLifetime) });
        });

        g.MapPost("/", async (ConfirmRequest req, Actor actor, AppDbContext db, StorageService storage, CancellationToken ct) =>
        {
            if (!await db.Companies.AnyAsync(c => c.Id == req.CompanyId, ct)) return Results.NotFound();
            // Only a key issued for this company and a known type can be recorded.
            var docType = req.Key is null ? null : UploadKeys.KindOf(Folder, req.CompanyId, req.Key, pending: false);
            if (docType is null || !DocTypes.Contains(docType) || !req.Key!.EndsWith(".pdf", StringComparison.Ordinal))
                return Invalid("key", "Geçersiz dosya anahtarı.");
            if (await db.LibraryDocuments.AnyAsync(d => d.StoragePath == req.Key, ct)) return Results.Conflict();

            var size = await storage.SizeAsync(FileEndpoints.DocumentsBucket, req.Key, ct);
            if (size is null) return Invalid("key", "Dosya yüklenmemiş.");
            if (await RejectionAsync(storage, req.Key, size.Value, ct) is { } message)
            {
                await storage.DeleteAsync(FileEndpoints.DocumentsBucket, req.Key, ct);
                return Invalid("key", message);
            }

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            if (req.IsDefault) await ClearDefaultAsync(db, req.CompanyId, docType, ct);
            var doc = new LibraryDocument
            {
                Id = Guid.NewGuid(), CompanyId = req.CompanyId, DocType = docType, StoragePath = req.Key,
                OriginalName = CleanName(req.OriginalName), SizeBytes = size.Value, IsDefault = req.IsDefault,
                UploadedBy = actor.UserId, UploadedAt = DateTime.UtcNow,
            };
            db.LibraryDocuments.Add(doc);
            if (await SaveAsync(db, ct) is { } failed) return failed;
            await tx.CommitAsync(ct);
            return Results.Created($"/api/document-library/{doc.Id}", new { doc.Id });
        });

        g.MapPut("/{id:guid}", async (Guid id, DefaultRequest req, AppDbContext db, CancellationToken ct) =>
        {
            var doc = await db.LibraryDocuments.SingleOrDefaultAsync(d => d.Id == id && d.ArchivedAt == null, ct);
            if (doc is null) return Results.NotFound();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            // The previous default becomes a normal document. Projects keep what was pinned to them.
            if (req.IsDefault) await ClearDefaultAsync(db, doc.CompanyId, doc.DocType, ct);
            doc.IsDefault = req.IsDefault;
            if (await SaveAsync(db, ct) is { } failed) return failed;
            await tx.CommitAsync(ct);
            return Results.Ok(new { doc.Id, doc.IsDefault });
        });

        // A document in use is archived: it leaves the lists and stays in the projects that use it.
        g.MapDelete("/{id:guid}", async (Guid id, Actor actor, AppDbContext db, StorageService storage, ILoggerFactory logs, CancellationToken ct) =>
        {
            var log = logs.CreateLogger(nameof(DocumentLibraryEndpoints));
            var doc = await db.LibraryDocuments.SingleOrDefaultAsync(d => d.Id == id, ct);
            if (doc is null) return Results.NotFound();
            if (await db.ProjectDocumentChoices.AnyAsync(c => c.LibraryDocumentId == id, ct))
            {
                if (doc.ArchivedAt is null)
                {
                    doc.ArchivedAt = DateTime.UtcNow;
                    doc.ArchivedBy = actor.UserId;
                    doc.IsDefault = false;
                    await db.SaveChangesAsync(ct);
                }
                return Results.Ok(new { archived = true });
            }

            db.LibraryDocuments.Remove(doc);
            // A project may have chosen it since the check; the foreign key refuses the delete then.
            if (await SaveAsync(db, ct) is { } failed) return failed;
            // The row is gone, so who removed it is kept in the log. Ids only, never the file name.
            log.LogInformation("Library document {DocumentId} deleted by user {UserId}", id, actor.UserId);
            await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, [doc.StoragePath], log);
            return Results.Ok(new { archived = false });
        });

        var p = app.MapGroup("/api/projects/{id:guid}/document-choices").RequireAuthorization(Policies.Staff);

        p.MapGet("/", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var project = await db.Projects.AsNoTracking().VisibleTo(actor)
                .Select(x => new { x.Id, x.CompanyId, x.TdNo, x.InputData }).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (project is null) return Results.NotFound();

            var chosen = await db.ProjectDocumentChoices.AsNoTracking().Where(c => c.ProjectId == id)
                .Select(c => new { c.DocType, c.LibraryDocumentId, c.LibraryDocument.OriginalName }).ToListAsync(ct);
            var documents = await db.LibraryDocuments.AsNoTracking()
                .Where(d => d.CompanyId == project.CompanyId && d.ArchivedAt == null)
                .OrderByDescending(d => d.IsDefault).ThenByDescending(d => d.UploadedAt)
                .Select(d => new { d.DocType, d.Id, d.OriginalName, d.IsDefault }).ToListAsync(ct);
            var usesReport = await UsesModulGReportAsync(db, id, project.InputData, ct);

            var rows = DocTypes.Select(type =>
            {
                var c = chosen.SingleOrDefault(x => x.DocType == type);
                var source = type == SonKontrol && usesReport ? "modul_g_rapor" : c is not null ? "library" : "system";
                return new ChoiceRow(type, source, c?.LibraryDocumentId, c?.OriginalName,
                    documents.Where(d => d.DocType == type).Select(d => new ChoiceOption(d.Id, d.OriginalName, d.IsDefault)).ToList());
            }).ToList();
            return Results.Ok(new ProjectChoices(await IsPostedAsync(db, project.TdNo, ct), rows));
        });

        p.MapPut("/{docType}", async (Guid id, string docType, ChoiceRequest req, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (!DocTypes.Contains(docType)) return Invalid("docType", "Geçersiz doküman tipi.");
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var project = await db.Projects.VisibleTo(actor).Select(x => new { x.Id, x.CompanyId, x.TdNo, x.InputData })
                .SingleOrDefaultAsync(x => x.Id == id, ct);
            if (project is null) return Results.NotFound();
            if (await IsPostedAsync(db, project.TdNo, ct))
                return Results.Conflict(new { error = "Muhasebe teslim etti: bu teknik dosyanın belgeleri değiştirilemez." });
            if (docType == SonKontrol && await UsesModulGReportAsync(db, id, project.InputData, ct))
                return Results.Conflict(new { error = "Modül G raporu yüklü olduğu için Son Kontrol Formu yerine rapor kullanılır." });

            var row = await db.ProjectDocumentChoices.SingleOrDefaultAsync(c => c.ProjectId == id && c.DocType == docType, ct);
            if (req.LibraryDocumentId is not { } documentId)
            {
                if (row is not null) db.ProjectDocumentChoices.Remove(row);
            }
            else
            {
                if (!await db.LibraryDocuments.AnyAsync(d => d.Id == documentId && d.CompanyId == project.CompanyId
                    && d.DocType == docType && d.ArchivedAt == null, ct))
                    return Results.NotFound();
                if (row is null)
                {
                    row = new ProjectDocumentChoice { ProjectId = id, DocType = docType };
                    db.ProjectDocumentChoices.Add(row);
                }
                row.LibraryDocumentId = documentId;
                row.UpdatedBy = actor.UserId;
                row.UpdatedAt = DateTime.UtcNow;
            }
            if (await SaveAsync(db, ct) is { } failed) return failed;
            await tx.CommitAsync(ct);
            return Results.Ok(new { docType, libraryDocumentId = req.LibraryDocumentId });
        });
    }

    /// <summary>Pins the company's current defaults to a project; called from the same transaction that saves it.</summary>
    public static async Task PinDefaultsAsync(AppDbContext db, Guid projectId, Guid companyId, Guid userId, CancellationToken ct)
    {
        var defaults = await db.LibraryDocuments.AsNoTracking()
            .Where(d => d.CompanyId == companyId && d.IsDefault && d.ArchivedAt == null)
            .Select(d => new { d.Id, d.DocType }).ToListAsync(ct);
        var now = DateTime.UtcNow;
        db.ProjectDocumentChoices.AddRange(defaults.Select(d => new ProjectDocumentChoice
        {
            ProjectId = projectId, DocType = d.DocType, LibraryDocumentId = d.Id, UpdatedBy = userId, UpdatedAt = now,
        }));
    }

    /// <summary>Delivered by accounting. By TD number alone: TD numbers are never reused and this must survive a company move (KRR-034).</summary>
    public static Task<bool> IsPostedAsync(AppDbContext db, string? tdNo, CancellationToken ct) =>
        tdNo is null
            ? Task.FromResult(false)
            : db.TakipProjelers.AnyAsync(t => t.TdNo == tdNo && t.TakipMuhasebe != null && t.TakipMuhasebe.CariyeIslendi, ct);

    /// <summary>Same rule as the PDF route: module G selected and a report uploaded.</summary>
    private static async Task<bool> UsesModulGReportAsync(AppDbContext db, Guid projectId, string? inputData, CancellationToken ct)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrEmpty(inputData) ? "{}" : inputData);
        var isG = doc.RootElement.ValueKind == JsonValueKind.Object && doc.RootElement.TryGetProperty("modul_secim", out var m)
            && m.ValueKind == JsonValueKind.String && m.GetString() == "G";
        return isG && await db.ProjectFiles.AnyAsync(f => f.ProjectId == projectId && f.Kind == "modul_g_rapor", ct);
    }

    private static async Task<string?> RejectionAsync(StorageService storage, string key, long size, CancellationToken ct)
    {
        if (size > UploadKeys.MaxBytes) return "Dosya 50 MB'den büyük olamaz.";
        if (await storage.OpenReadAsync(FileEndpoints.DocumentsBucket, key, ct) is not { } obj) return "Dosya yüklenmemiş.";
        await using var body = obj.Body;
        return await PdfInspector.InspectAsync(body, ct: ct) switch
        {
            PdfInspection.NotPdf => "Yalnız PDF yüklenebilir.",
            PdfInspection.Encrypted => "Şifreli PDF yüklenemez.",
            _ => null,
        };
    }

    private static Task ClearDefaultAsync(AppDbContext db, Guid companyId, string docType, CancellationToken ct) =>
        db.LibraryDocuments.Where(d => d.CompanyId == companyId && d.DocType == docType && d.IsDefault)
            .ExecuteUpdateAsync(s => s.SetProperty(d => d.IsDefault, false), ct);

    /// <summary>Display name only: no path, no control characters, bounded. Never logged.</summary>
    public static string CleanName(string? name)
    {
        var file = (name ?? "").Replace('\\', '/').Split('/')[^1];
        var clean = new string(file.Where(c => !char.IsControl(c)).ToArray()).Trim();
        if (clean.Length > 200) clean = clean[^200..];
        return clean.Length == 0 ? "dokuman.pdf" : clean;
    }

    private static async Task<IResult?> SaveAsync(AppDbContext db, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return null;
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation or PostgresErrorCodes.UniqueViolation })
        {
            return Results.Conflict(new { error = "Kayıt aynı anda değişti; sayfayı yenileyip tekrar deneyin." });
        }
    }

    private static IResult Invalid(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });
}
