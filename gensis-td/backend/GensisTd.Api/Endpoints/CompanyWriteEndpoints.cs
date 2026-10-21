using System.Text.Json;
using Amazon.S3;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Storage;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Company card and company documents (admin/actions.ts updateCompany, uploadCompanyDocument).
/// Staff write directly; a customer may only change their own company, and the change goes to
/// pending_changes for staff approval (ADR-003). Customer files are stored under pending/ until then.
/// </summary>
public static class CompanyWriteEndpoints
{
    public record CompanyInput(
        string? ShortName, string? LegalName, string? Address, string? Phone, string? MobilePhone, string? City,
        string? AuthorizedPerson, string? RegisteredBrand, string? IndustryRegNo, string? Email, string? CeModule,
        string? Category, string? Sector);

    public record UploadUrlRequest(string? DocType, string? FileName, string? ContentType);
    public record UploadUrl(string Key, string Url, string ContentType, DateTime ExpiresAt);

    public record CompanyDocumentInput(
        string? DocType, Guid? DocId, string? Key, string? OriginalName, string? BelgeNo, DateOnly? IssueDate,
        DateOnly? ValidUntil, Guid? NotifiedBodyId, string? SubType, Guid? ParentId);

    /// <summary>Pending: the change waits for approval; Id is the written row for staff.</summary>
    public record WriteResult(bool Pending, Guid? Id);

    public const string Folder = "musteri";

    public static void MapCompanyWriteEndpoints(this WebApplication app)
    {
        // New company (admin/actions.ts createCompany): staff only, used by Müşteriler and the Proje Takip form.
        app.MapPost("/api/companies", async (CompanyInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.ShortName) || string.IsNullOrWhiteSpace(input.LegalName))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["shortName"] = ["Kısa ad ve ünvan zorunlu."] });
            var company = new Company { Id = Guid.NewGuid() };
            ApplyCompanyEdit(company, Columns(input));
            db.Companies.Add(company);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new WriteResult(false, company.Id));
        }).RequireAuthorization(Policies.Staff);

        // Staff only (admin/actions.ts deleteCompany). A company with teknik dosya or proje onay files is not deleted,
        // and neither is Gensis's own company (its engineers are every customer's default).
        app.MapDelete("/api/companies/{id:guid}", async (Guid id, AppDbContext db, GensisCompany gensis, StorageService storage,
            ILoggerFactory logs, CancellationToken ct) =>
        {
            if (!await db.Companies.AnyAsync(c => c.Id == id, ct)) return Results.NotFound();
            if (id == gensis.Id) return Results.Conflict(new { error = "Gensis firması silinemez." });
            if (await db.Projects.AnyAsync(p => p.CompanyId == id, ct))
                return Results.Conflict(new { error = "Bu firmanın teknik dosyaları var; önce onları silin." });
            if (await db.ProjeOnays.AnyAsync(p => p.CompanyId == id, ct))
                return Results.Conflict(new { error = "Bu firmanın proje onay dosyaları var; önce onları silin." });

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var engineerIds = await db.Engineers.Where(e => e.CompanyId == id).Select(e => e.Id).ToListAsync(ct);
            var paths = await db.CompanyDocuments.Where(d => d.CompanyId == id && d.StoragePath != null).Select(d => d.StoragePath!).ToListAsync(ct);
            paths.AddRange(await db.EngineerDocuments.Where(d => engineerIds.Contains(d.EngineerId) && d.StoragePath != null)
                .Select(d => d.StoragePath!).ToListAsync(ct));
            paths.AddRange(await db.PendingChanges.Where(p => p.CompanyId == id && p.StoragePath != null && p.Status == "pending")
                .Select(p => p.StoragePath!).ToListAsync(ct));

            await db.CompanyDocuments.Where(d => d.CompanyId == id).ExecuteDeleteAsync(ct);
            await db.EngineerDocuments.Where(d => engineerIds.Contains(d.EngineerId)).ExecuteDeleteAsync(ct);
            await db.Projects.Where(p => p.MakineMuhendisId != null && engineerIds.Contains(p.MakineMuhendisId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.MakineMuhendisId, (Guid?)null), ct);
            await db.Projects.Where(p => p.ElektrikMuhendisId != null && engineerIds.Contains(p.ElektrikMuhendisId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.ElektrikMuhendisId, (Guid?)null), ct);
            await db.Engineers.Where(e => engineerIds.Contains(e.Id)).ExecuteDeleteAsync(ct);
            await db.PendingChanges.Where(p => p.CompanyId == id).ExecuteDeleteAsync(ct);
            // The company's users lose it and are deactivated, so they can no longer sign in (user decision).
            await db.Profiles.Where(p => p.CompanyId == id).ExecuteUpdateAsync(s => s
                .SetProperty(p => p.CompanyId, (Guid?)null).SetProperty(p => p.IsActive, false), ct);
            try
            {
                await db.Companies.Where(c => c.Id == id).ExecuteDeleteAsync(ct);
            }
            catch (Npgsql.PostgresException pg) when (pg.SqlState == Npgsql.PostgresErrorCodes.ForeignKeyViolation)
            {
                return Results.Conflict(new { error = $"Firma başka kayıtlarda kullanılıyor ({pg.TableName})." });
            }
            await tx.CommitAsync(ct);
            await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, paths, logs.CreateLogger(nameof(CompanyWriteEndpoints)));
            return Results.Ok(new { message = "Müşteri, belgeleri ve bağlı mühendisleri silindi." });
        }).RequireAuthorization(Policies.Staff);

        app.MapDelete("/api/companies/documents/{docId:guid}", async (Guid docId, AppDbContext db, StorageService storage,
            ILoggerFactory logs, CancellationToken ct) =>
        {
            var doc = await db.CompanyDocuments.SingleOrDefaultAsync(d => d.Id == docId, ct);
            if (doc is null) return Results.NotFound();
            db.CompanyDocuments.Remove(doc);
            await db.SaveChangesAsync(ct);
            if (doc.StoragePath is { } path)
                await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, [path], logs.CreateLogger(nameof(CompanyWriteEndpoints)));
            return Results.Ok(new { message = "Belge silindi." });
        }).RequireAuthorization(Policies.Staff);

        var g = app.MapGroup("/api/companies/{id:guid}").RequireAuthorization();

        g.MapPut("/", async (Guid id, CompanyInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.ShortName) || string.IsNullOrWhiteSpace(input.LegalName))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["shortName"] = ["Kısa ad ve ünvan zorunlu."] });
            var company = await db.Companies.VisibleTo(actor).SingleOrDefaultAsync(c => c.Id == id, ct);
            if (company is null) return Results.NotFound();

            var cols = Columns(input);
            if (!actor.IsStaff)
            {
                var change = Pending(actor, "company_edit", id, cols);
                change.TargetId = id;
                db.PendingChanges.Add(change);
                await db.SaveChangesAsync(ct);
                return Results.Ok(new WriteResult(true, null));
            }

            ApplyCompanyEdit(company, cols);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new WriteResult(false, id));
        });

        g.MapPost("/documents/upload-url", async (Guid id, UploadUrlRequest req, Actor actor, AppDbContext db, StorageService storage,
            CancellationToken ct) =>
        {
            if (!UploadKeys.IsValidKind(req.DocType))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["docType"] = ["Geçersiz belge türü."] });
            if (!await db.Companies.VisibleTo(actor).AnyAsync(c => c.Id == id, ct)) return Results.NotFound();

            var key = UploadKeys.New(Folder, id, req.DocType!, req.FileName, pending: !actor.IsStaff);
            var contentType = string.IsNullOrWhiteSpace(req.ContentType) ? "application/octet-stream" : req.ContentType.Trim();
            var url = await storage.PresignAsync(FileEndpoints.DocumentsBucket, key, HttpVerb.PUT, UploadKeys.UploadLifetime, contentType);
            return Results.Ok(new UploadUrl(key, url, contentType, DateTime.UtcNow.Add(UploadKeys.UploadLifetime)));
        });

        g.MapPost("/documents", async (Guid id, CompanyDocumentInput input, Actor actor, AppDbContext db, StorageService storage,
            ILoggerFactory logs, CancellationToken ct) =>
        {
            if (!UploadKeys.IsValidKind(input.DocType))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["docType"] = ["Geçersiz belge türü."] });
            if (!await db.Companies.VisibleTo(actor).AnyAsync(c => c.Id == id, ct)) return Results.NotFound();

            // Ids that the change will touch on approval must belong to this company.
            if (input.DocId is { } docId && !await db.CompanyDocuments.AnyAsync(d => d.Id == docId && d.CompanyId == id, ct))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["docId"] = ["Belge bulunamadı."] });
            if (input.ParentId is { } parentId && !await db.CompanyDocuments.AnyAsync(d => d.Id == parentId && d.CompanyId == id, ct))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["parentId"] = ["Bağlı belge bulunamadı."] });
            if (input.NotifiedBodyId is { } nb && !await db.NotifiedBodies.AnyAsync(b => b.Id == nb, ct))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["notifiedBodyId"] = ["Onaylanmış kuruluş bulunamadı."] });
            if (await CheckUploadAsync(db, storage, Folder, id, input.DocType!, input.Key, actor.IsStaff, ct) is { } badFile)
                return badFile;

            var payload = new Dictionary<string, object?>
            {
                ["belge_no"] = Clean(input.BelgeNo), ["issue_date"] = input.IssueDate, ["valid_until"] = input.ValidUntil,
                ["notified_body_id"] = input.NotifiedBodyId, ["sub_type"] = Clean(input.SubType), ["parent_id"] = input.ParentId,
            };
            if (!actor.IsStaff)
            {
                var change = Pending(actor, "company_doc", id, payload);
                change.TargetId = input.DocId;
                change.DocType = input.DocType;
                change.StoragePath = input.Key;
                change.OriginalName = input.Key is null ? null : Clean(input.OriginalName);
                db.PendingChanges.Add(change);
                await db.SaveChangesAsync(ct);
                return Results.Ok(new WriteResult(true, null));
            }

            var doc = input.DocId is { } existing
                ? await db.CompanyDocuments.SingleAsync(d => d.Id == existing, ct)
                : db.CompanyDocuments.Add(new CompanyDocument { Id = Guid.NewGuid(), CompanyId = id, UploadedAt = DateTime.UtcNow }).Entity;
            var replaced = ApplyCompanyDocument(doc, input.DocType!, payload, input.Key, Clean(input.OriginalName), actor.UserId);
            await ApplyIssueDateToCompanyAsync(db, id, input.DocType!, input.IssueDate, ct);
            await db.SaveChangesAsync(ct);
            if (replaced is not null)
                await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, [replaced], logs.CreateLogger(nameof(CompanyWriteEndpoints)));
            return Results.Ok(new WriteResult(false, doc.Id));
        });
    }

    // Same columns and payload keys as the live action, so approval applies them unchanged.
    private static Dictionary<string, object?> Columns(CompanyInput input) => new()
    {
        ["short_name"] = input.ShortName!.Trim(), ["legal_name"] = input.LegalName!.Trim(),
        ["address"] = Clean(input.Address), ["phone"] = Clean(input.Phone), ["mobile_phone"] = Clean(input.MobilePhone),
        ["city"] = Clean(input.City), ["authorized_person"] = Clean(input.AuthorizedPerson),
        ["registered_brand"] = Clean(input.RegisteredBrand), ["industry_reg_no"] = Clean(input.IndustryRegNo),
        ["email"] = Clean(input.Email), ["ce_module"] = Clean(input.CeModule),
        ["category"] = Clean(input.Category) ?? "asansor", ["sector"] = Clean(input.Sector),
    };

    public static PendingChange Pending(Actor actor, string kind, Guid? companyId, Dictionary<string, object?> payload) => new()
    {
        Id = Guid.NewGuid(),
        Kind = kind,
        CompanyId = companyId,
        Payload = JsonSerializer.Serialize(payload),
        Status = "pending",
        SubmittedBy = actor.UserId,
        SubmittedAt = DateTime.UtcNow,
    };

    /// <summary>
    /// The uploaded object (optional) must be a key issued for this owner and kind, under pending/ for
    /// customers, exist, be at most 50 MB, and not be used by another row yet.
    /// </summary>
    public static async Task<IResult?> CheckUploadAsync(AppDbContext db, StorageService storage, string folder, Guid ownerId,
        string kind, string? key, bool staff, CancellationToken ct)
    {
        if (key is null) return null;
        if (UploadKeys.KindOf(folder, ownerId, key, pending: !staff) != kind)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["key"] = ["Geçersiz dosya anahtarı."] });
        if (await db.CompanyDocuments.AnyAsync(d => d.StoragePath == key, ct)
            || await db.EngineerDocuments.AnyAsync(d => d.StoragePath == key, ct)
            || await db.PendingChanges.AnyAsync(p => p.StoragePath == key, ct))
            return Results.Conflict();
        var size = await storage.SizeAsync(FileEndpoints.DocumentsBucket, key, ct);
        if (size is null)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["key"] = ["Dosya yüklenmemiş."] });
        if (size > UploadKeys.MaxBytes)
        {
            await storage.DeleteAsync(FileEndpoints.DocumentsBucket, key, ct);
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["key"] = ["Dosya 50 MB'den büyük olamaz."] });
        }
        return null;
    }

    public static void ApplyCompanyEdit(Company c, IReadOnlyDictionary<string, object?> cols)
    {
        c.ShortName = (string)cols["short_name"]!;
        c.LegalName = (string)cols["legal_name"]!;
        c.Address = (string?)cols["address"];
        c.Phone = (string?)cols["phone"];
        c.MobilePhone = (string?)cols["mobile_phone"];
        c.City = (string?)cols["city"];
        c.AuthorizedPerson = (string?)cols["authorized_person"];
        c.RegisteredBrand = (string?)cols["registered_brand"];
        c.IndustryRegNo = (string?)cols["industry_reg_no"];
        c.Email = (string?)cols["email"];
        c.CeModule = (string?)cols["ce_module"];
        c.Category = (string)cols["category"]!;
        c.Sector = (string?)cols["sector"];
    }

    /// <summary>Applies the document fields; returns the previous file's key when a new file replaces it.</summary>
    public static string? ApplyCompanyDocument(CompanyDocument d, string docType, IReadOnlyDictionary<string, object?> p,
        string? key, string? originalName, Guid? uploadedBy)
    {
        d.DocType = docType;
        d.BelgeNo = (string?)p["belge_no"];
        d.IssueDate = (DateOnly?)p["issue_date"];
        d.ValidUntil = (DateOnly?)p["valid_until"];
        d.NotifiedBodyId = (Guid?)p["notified_body_id"];
        d.SubType = (string?)p["sub_type"];
        d.ParentId = (Guid?)p["parent_id"];
        if (key is null) return null;
        var previous = d.StoragePath;
        d.StoragePath = key;
        d.OriginalName = originalName;
        d.UploadedBy = uploadedBy;
        d.UploadedAt = DateTime.UtcNow;
        return previous;
    }

    // Issue dates of these documents are shown on the company card and in the documents (as before).
    public static async Task ApplyIssueDateToCompanyAsync(AppDbContext db, Guid companyId, string docType, DateOnly? issueDate, CancellationToken ct)
    {
        if (issueDate is null || docType is not ("sanayi_sicil" or "tse_hyb")) return;
        var company = await db.Companies.SingleAsync(c => c.Id == companyId, ct);
        if (docType == "sanayi_sicil") company.IndustryRegDate = issueDate;
        else company.HybDate = issueDate;
    }

    public static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
