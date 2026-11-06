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
        string? Category, string? Sector, string? ContactMobilePhone = null);

    public record UploadUrlRequest(string? DocType, string? FileName, string? ContentType);
    public record UploadUrl(string Key, string Url, string ContentType, DateTime ExpiresAt);

    public record CompanyDocumentInput(
        string? DocType, Guid? DocId, string? Key, string? OriginalName, string? BelgeNo, DateOnly? IssueDate,
        DateOnly? ValidUntil, Guid? NotifiedBodyId, string? SubType, Guid? ParentId);

    /// <summary>Pending: the change waits for approval; Id is the written row for staff.</summary>
    public record WriteResult(bool Pending, Guid? Id);

    public const string Folder = "musteri";
    public const string ContactMobileKey = "contact_mobile_phone";

    public static void MapCompanyWriteEndpoints(this WebApplication app)
    {
        // New company (admin/actions.ts createCompany): staff only, used by Müşteriler and the Proje Takip form.
        app.MapPost("/api/companies", async (CompanyInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.ShortName) || string.IsNullOrWhiteSpace(input.LegalName))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["shortName"] = ["Kısa ad ve ünvan zorunlu."] });
            if (InvalidContactMobile(input) is { } badMobile) return badMobile;
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
            paths.AddRange(await db.LibraryDocuments.Where(d => d.CompanyId == id).Select(d => d.StoragePath).ToListAsync(ct));

            await db.CompanyDocuments.Where(d => d.CompanyId == id).ExecuteDeleteAsync(ct);
            await db.EngineerDocuments.Where(d => engineerIds.Contains(d.EngineerId)).ExecuteDeleteAsync(ct);
            await db.Projects.Where(p => p.MakineMuhendisId != null && engineerIds.Contains(p.MakineMuhendisId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.MakineMuhendisId, (Guid?)null), ct);
            await db.Projects.Where(p => p.ElektrikMuhendisId != null && engineerIds.Contains(p.ElektrikMuhendisId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.ElektrikMuhendisId, (Guid?)null), ct);
            await db.Engineers.Where(e => engineerIds.Contains(e.Id)).ExecuteDeleteAsync(ct);
            await db.PendingChanges.Where(p => p.CompanyId == id).ExecuteDeleteAsync(ct);
            // The company's users lose it and are deactivated, so they can no longer sign in (user decision);
            // their open sessions end too (KRR-024).
            await db.Users.Where(u => u.Profile != null && u.Profile.CompanyId == id)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.TokenVersion, u => u.TokenVersion + 1), ct);
            await db.Profiles.Where(p => p.CompanyId == id).ExecuteUpdateAsync(s => s
                .SetProperty(p => p.CompanyId, (Guid?)null).SetProperty(p => p.IsActive, false), ct);
            try
            {
                await db.LibraryDocuments.Where(d => d.CompanyId == id).ExecuteDeleteAsync(ct);
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

        // Deletes a company document with its file. A Modül B document's "Ek" rows go with it (parent_id cascade), and now
        // their files too: before, the cascade left them in storage. Used by the edit form on save and by "Sil" (z8qgvcccd1).
        app.MapDelete("/api/companies/documents/{docId:guid}", async (Guid docId, AppDbContext db, StorageService storage,
            ILoggerFactory logs, CancellationToken ct) =>
        {
            var rows = await db.CompanyDocuments.Where(d => d.Id == docId || d.ParentId == docId).ToListAsync(ct);
            if (!rows.Any(d => d.Id == docId)) return Results.NotFound();
            var paths = rows.Select(d => d.StoragePath).OfType<string>().ToList();
            db.CompanyDocuments.RemoveRange(rows);
            await db.SaveChangesAsync(ct);
            // Files go once the rows are gone; a failed object delete leaves an orphan, never a row without a file.
            await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, paths, logs.CreateLogger(nameof(CompanyWriteEndpoints)));
            return Results.Ok(new { message = "Belge silindi." });
        }).RequireAuthorization(DeleteDocumentPolicy);

        var g = app.MapGroup("/api/companies/{id:guid}").RequireAuthorization();

        g.MapPut("/", async (Guid id, CompanyInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.ShortName) || string.IsNullOrWhiteSpace(input.LegalName))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["shortName"] = ["Kısa ad ve ünvan zorunlu."] });
            if (InvalidContactMobile(input) is { } badMobile) return badMobile;
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

        // Yönetim > Müşteriler > Düzenle "Sil" (z8qgvcccd1) asks this before DELETE /api/companies/documents/{docId}: how many
        // Ek rows go with it and how many teknik dosyalar will miss it. Nothing breaks: TDs read company documents when the
        // PDF is made, so the next PDF lacks it until a new one is uploaded (a chosen CE document must be chosen again).
        g.MapGet("/documents/{docId:guid}/usage", async (Guid id, Guid docId, AppDbContext db, CancellationToken ct) =>
        {
            var doc = await db.CompanyDocuments.AsNoTracking().Where(d => d.Id == docId && d.CompanyId == id)
                .Select(d => new { d.DocType }).SingleOrDefaultAsync(ct);
            if (doc is null) return Results.NotFound();
            var attachments = await db.CompanyDocuments.CountAsync(d => d.ParentId == docId, ct);
            return Results.Ok(new DocumentUsage(attachments, await ProjectsUsingAsync(db, id, docId, doc.DocType, ct)));
        }).RequireAuthorization(DeleteDocumentPolicy);
    }

    public record DocumentUsage(int Attachments, int Projects);

    /// <summary>
    /// Who may delete a company document from Yönetim (z8qgvcccd1): admin and gensis, the second exception to "no delete
    /// for gensis in Yönetim" after Dokümanlar (user decision 2026-11-06). Customers ("Firmam") cannot.
    /// </summary>
    public const string DeleteDocumentPolicy = Policies.Staff;

    /// <summary>
    /// Teknik dosyalar of the company whose next PDF would miss the document: for a CE document the files that chose
    /// it in their Belgeler step; for the other types (logo, imza sirküleri, sanayi sicil, TSE ...) every file of the
    /// company, as the PDF takes the company's newest one of that type.
    /// </summary>
    private static async Task<int> ProjectsUsingAsync(AppDbContext db, Guid companyId, Guid docId, string docType, CancellationToken ct) =>
        docType.StartsWith("ce")
            ? (await db.Database.SqlQuery<int>($"""
                SELECT count(*)::int AS "Value" FROM projects
                WHERE company_id = {companyId} AND jsonb_typeof(input_data->'modul_belge_ids') = 'array'
                  AND input_data->'modul_belge_ids' ? {docId.ToString()}
                """).ToListAsync(ct)).Single()
            : await db.Projects.CountAsync(p => p.CompanyId == companyId, ct);

    // Same columns and payload keys as the live action, so approval applies them unchanged.
    private static Dictionary<string, object?> Columns(CompanyInput input) => new()
    {
        ["short_name"] = input.ShortName!.Trim(), ["legal_name"] = input.LegalName!.Trim(),
        ["address"] = Clean(input.Address), ["phone"] = Clean(input.Phone), ["mobile_phone"] = Clean(input.MobilePhone),
        ["city"] = Clean(input.City), ["authorized_person"] = Clean(input.AuthorizedPerson),
        ["registered_brand"] = Clean(input.RegisteredBrand), ["industry_reg_no"] = Clean(input.IndustryRegNo),
        ["email"] = Clean(input.Email), ["ce_module"] = Clean(input.CeModule),
        ["category"] = Clean(input.Category) ?? "asansor", ["sector"] = Clean(input.Sector),
        [ContactMobileKey] = Clean(input.ContactMobilePhone),
    };

    // The value itself is never echoed.
    private static IResult? InvalidContactMobile(CompanyInput input) =>
        Clean(input.ContactMobilePhone) is { } v && (v.Length > 32 || !v.All(c => char.IsAsciiDigit(c) || c is ' ' or '+' or '(' or ')' or '-'))
            ? Results.ValidationProblem(new Dictionary<string, string[]> { ["contactMobilePhone"] = ["Cep telefonu geçersiz."] })
            : null;

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
        // Changes queued before this field existed have no key: they must not erase a newer value.
        if (cols.TryGetValue(ContactMobileKey, out var contactMobile)) c.ContactMobilePhone = (string?)contactMobile;
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
