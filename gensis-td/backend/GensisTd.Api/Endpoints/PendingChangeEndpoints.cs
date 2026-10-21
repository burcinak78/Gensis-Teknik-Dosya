using System.Globalization;
using System.Text.Json;
using Amazon.S3;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Storage;
using Microsoft.EntityFrameworkCore;
using static GensisTd.Api.Endpoints.CompanyWriteEndpoints;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// The Onaylar queue (admin/actions.ts approvePendingChange, rejectPendingChange): staff review
/// customers' changes. Approval re-checks everything against the current data, because the target
/// rows can change between submission and approval, then applies the change with the same code as a
/// staff write and moves the file out of pending/.
/// </summary>
public static class PendingChangeEndpoints
{
    public static readonly TimeSpan PreviewLifetime = TimeSpan.FromMinutes(30);

    public record PendingItem(
        Guid Id, string Kind, string? DocType, JsonElement Payload, string CompanyName, string? EngineerName, string Submitter,
        DateTime SubmittedAt, string? OriginalName, string? FileUrl, bool IsUpdate);
    public record RejectInput(string? Note);

    private sealed class Invalid(string message) : Exception(message);

    public static void MapPendingChangeEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/pending-changes").RequireAuthorization(Policies.Staff);

        g.MapGet("/", async (AppDbContext db, StorageService storage, CancellationToken ct) =>
        {
            var rows = await db.PendingChanges.AsNoTracking().Where(p => p.Status == "pending")
                .OrderByDescending(p => p.SubmittedAt).ToListAsync(ct);
            var companyIds = rows.Select(r => r.CompanyId).OfType<Guid>().Distinct().ToList();
            var engineerIds = rows.Select(r => r.EngineerId).OfType<Guid>().Distinct().ToList();
            var userIds = rows.Select(r => r.SubmittedBy).OfType<Guid>().Distinct().ToList();
            var companies = await db.Companies.Where(c => companyIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.ShortName, ct);
            var engineers = await db.Engineers.Where(e => engineerIds.Contains(e.Id)).ToDictionaryAsync(e => e.Id, e => e.FullName, ct);
            var users = await db.Profiles.Where(p => userIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.FullName, ct);

            var items = new List<PendingItem>();
            foreach (var r in rows)
            {
                var payload = Parse(r.Payload);
                items.Add(new PendingItem(
                    r.Id, r.Kind, r.DocType, payload,
                    r.CompanyId is { } c ? companies.GetValueOrDefault(c, "—") : "—",
                    r.EngineerId is { } e ? engineers.GetValueOrDefault(e, "—") : Str(payload, "full_name"),
                    r.SubmittedBy is { } u ? users.GetValueOrDefault(u) ?? "—" : "—",
                    r.SubmittedAt, r.OriginalName,
                    r.StoragePath is null ? null
                        : await storage.PresignAsync(FileEndpoints.DocumentsBucket, r.StoragePath, HttpVerb.GET, PreviewLifetime),
                    r.TargetId is not null));
            }
            return items;
        });

        g.MapPost("/{id:guid}/approve", async (Guid id, Actor actor, AppDbContext db, StorageService storage, ILoggerFactory logs,
            CancellationToken ct) =>
        {
            var log = logs.CreateLogger(nameof(PendingChangeEndpoints));
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            // Lock the row so two reviewers cannot apply the same change twice.
            // ToListAsync: Single* would wrap the locking query in a subquery.
            var pc = (await db.PendingChanges.FromSql($"SELECT * FROM public.pending_changes WHERE id = {id} FOR UPDATE")
                .ToListAsync(ct)).SingleOrDefault();
            if (pc is null) return Results.NotFound();
            if (pc.Status != "pending") return Results.Conflict(new { error = "Bu kayıt zaten işlenmiş." });

            string? movedTo = null, replaced = null;
            try
            {
                var p = Parse(pc.Payload);
                switch (pc.Kind)
                {
                    case "company_edit":
                    {
                        var company = await db.Companies.SingleOrDefaultAsync(c => c.Id == pc.TargetId && c.Id == pc.CompanyId, ct)
                            ?? throw new Invalid("Hedef firma bulunamadı.");
                        ApplyCompanyEdit(company, new Dictionary<string, object?>
                        {
                            ["short_name"] = Str(p, "short_name") ?? throw new Invalid("Kısa ad eksik."),
                            ["legal_name"] = Str(p, "legal_name") ?? throw new Invalid("Ünvan eksik."),
                            ["address"] = Str(p, "address"), ["phone"] = Str(p, "phone"), ["mobile_phone"] = Str(p, "mobile_phone"),
                            ["city"] = Str(p, "city"), ["authorized_person"] = Str(p, "authorized_person"),
                            ["registered_brand"] = Str(p, "registered_brand"), ["industry_reg_no"] = Str(p, "industry_reg_no"),
                            ["email"] = Str(p, "email"), ["ce_module"] = Str(p, "ce_module"),
                            ["category"] = Str(p, "category") ?? "asansor", ["sector"] = Str(p, "sector"),
                        });
                        break;
                    }
                    case "engineer_new":
                    {
                        // The engineer always belongs to the submitting company, whatever the payload says.
                        var companyId = pc.CompanyId ?? throw new Invalid("Firma bilgisi eksik.");
                        if (!await db.Companies.AnyAsync(c => c.Id == companyId, ct)) throw new Invalid("Firma bulunamadı.");
                        var engineer = new Engineer { Id = Guid.NewGuid(), IsActive = true };
                        EngineerWriteEndpoints.Apply(engineer, EngineerPayload(p, companyId));
                        db.Engineers.Add(engineer);
                        break;
                    }
                    case "engineer_edit":
                    {
                        var companyId = pc.CompanyId ?? throw new Invalid("Firma bilgisi eksik.");
                        var engineer = await db.Engineers.SingleOrDefaultAsync(e => e.Id == pc.TargetId && e.CompanyId == companyId, ct)
                            ?? throw new Invalid("Mühendis bulunamadı ya da artık bu firmaya ait değil.");
                        EngineerWriteEndpoints.Apply(engineer, EngineerPayload(p, companyId));
                        break;
                    }
                    case "company_doc":
                    {
                        var companyId = pc.CompanyId ?? throw new Invalid("Firma bilgisi eksik.");
                        var docType = ValidKind(pc.DocType);
                        var parentId = GuidOf(p, "parent_id");
                        var nbId = GuidOf(p, "notified_body_id");
                        if (parentId is { } pid && !await db.CompanyDocuments.AnyAsync(d => d.Id == pid && d.CompanyId == companyId, ct))
                            throw new Invalid("Bağlı belge artık bu firmaya ait değil.");
                        if (nbId is { } nb && !await db.NotifiedBodies.AnyAsync(b => b.Id == nb, ct))
                            throw new Invalid("Onaylanmış kuruluş bulunamadı.");
                        var doc = pc.TargetId is { } target
                            ? await db.CompanyDocuments.SingleOrDefaultAsync(d => d.Id == target && d.CompanyId == companyId, ct)
                                ?? throw new Invalid("Belge bulunamadı ya da artık bu firmaya ait değil.")
                            : db.CompanyDocuments.Add(new CompanyDocument { Id = Guid.NewGuid(), CompanyId = companyId, UploadedAt = DateTime.UtcNow }).Entity;
                        movedTo = await MoveOutOfPendingAsync(storage, pc.StoragePath, CompanyWriteEndpoints.Folder, companyId, docType, ct);
                        var issueDate = DateOf(p, "issue_date");
                        replaced = ApplyCompanyDocument(doc, docType, new Dictionary<string, object?>
                        {
                            ["belge_no"] = Str(p, "belge_no"), ["issue_date"] = issueDate, ["valid_until"] = DateOf(p, "valid_until"),
                            ["notified_body_id"] = nbId, ["sub_type"] = Str(p, "sub_type"), ["parent_id"] = parentId,
                        }, movedTo, pc.OriginalName, pc.SubmittedBy);
                        await ApplyIssueDateToCompanyAsync(db, companyId, docType, issueDate, ct);
                        break;
                    }
                    case "engineer_doc":
                    {
                        var engineerId = pc.EngineerId ?? throw new Invalid("Mühendis bilgisi eksik.");
                        var companyId = pc.CompanyId ?? throw new Invalid("Firma bilgisi eksik.");
                        if (!await db.Engineers.AnyAsync(e => e.Id == engineerId && e.CompanyId == companyId, ct))
                            throw new Invalid("Mühendis bulunamadı ya da artık bu firmaya ait değil.");
                        var docType = ValidKind(pc.DocType);
                        movedTo = await MoveOutOfPendingAsync(storage, pc.StoragePath, EngineerWriteEndpoints.Folder, engineerId, docType, ct);
                        var doc = await db.EngineerDocuments.SingleOrDefaultAsync(d => d.EngineerId == engineerId && d.DocType == docType, ct)
                            ?? db.EngineerDocuments.Add(new EngineerDocument { Id = Guid.NewGuid(), EngineerId = engineerId, DocType = docType, UploadedAt = DateTime.UtcNow }).Entity;
                        replaced = EngineerWriteEndpoints.ApplyEngineerDocument(doc, DateOf(p, "valid_until"), movedTo, pc.OriginalName, pc.SubmittedBy);
                        break;
                    }
                    default:
                        throw new Invalid("Bilinmeyen değişiklik türü.");
                }

                pc.Status = "approved";
                pc.ReviewedBy = actor.UserId;
                pc.ReviewedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
                await tx.CommitAsync(ct);
            }
            catch (Invalid ex)
            {
                await tx.RollbackAsync(ct);
                if (movedTo is not null) await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, [movedTo], log);
                return Results.Conflict(new { error = ex.Message });
            }
            catch
            {
                if (movedTo is not null) await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, [movedTo], log);
                throw;
            }

            // After commit: the pending copy and a replaced file are no longer referenced.
            var orphans = new[] { movedTo is null ? null : pc.StoragePath, replaced }.OfType<string>().ToList();
            await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, orphans, log);
            return Results.Ok(new { message = "Onaylandı." });
        });

        g.MapPost("/{id:guid}/reject", async (Guid id, RejectInput? input, Actor actor, AppDbContext db, StorageService storage,
            ILoggerFactory logs, CancellationToken ct) =>
        {
            var changed = await db.PendingChanges.Where(p => p.Id == id && p.Status == "pending").ExecuteUpdateAsync(s => s
                .SetProperty(p => p.Status, "rejected")
                .SetProperty(p => p.Note, Clean(input?.Note))
                .SetProperty(p => p.ReviewedBy, actor.UserId)
                .SetProperty(p => p.ReviewedAt, DateTime.UtcNow), ct);
            if (changed == 0)
                return await db.PendingChanges.AnyAsync(p => p.Id == id, ct)
                    ? Results.Conflict(new { error = "Bu kayıt zaten işlenmiş." })
                    : Results.NotFound();
            var path = await db.PendingChanges.Where(p => p.Id == id).Select(p => p.StoragePath).SingleAsync(ct);
            if (path is not null && path.StartsWith(UploadKeys.PendingPrefix))
                await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, [path], logs.CreateLogger(nameof(PendingChangeEndpoints)));
            return Results.Ok(new { message = "Reddedildi." });
        });
    }

    /// <summary>
    /// Re-validates the stored key (issued for this owner and kind under pending/) and copies it to its
    /// final place. Returns the final key, or null when the change has no file.
    /// </summary>
    private static async Task<string?> MoveOutOfPendingAsync(StorageService storage, string? key, string folder, Guid ownerId,
        string docType, CancellationToken ct)
    {
        if (key is null) return null;
        if (UploadKeys.KindOf(folder, ownerId, key, pending: true) != docType) throw new Invalid("Dosya anahtarı geçersiz.");
        if (await storage.SizeAsync(FileEndpoints.DocumentsBucket, key, ct) is null) throw new Invalid("Dosya bulunamadı.");
        var final = key[UploadKeys.PendingPrefix.Length..];
        await storage.CopyAsync(FileEndpoints.DocumentsBucket, key, final, ct);
        return final;
    }

    private static string ValidKind(string? kind) => UploadKeys.IsValidKind(kind) ? kind! : throw new Invalid("Belge türü geçersiz.");

    private static Dictionary<string, object?> EngineerPayload(JsonElement p, Guid companyId)
    {
        var discipline = Str(p, "discipline") ?? throw new Invalid("Mühendislik tipi eksik.");
        var parsed = Enum.GetValues<EngineerDiscipline>().FirstOrDefault(d => PgNames.Of(d) == discipline);
        if (PgNames.Of(parsed) != discipline) throw new Invalid("Mühendislik tipi geçersiz.");
        return new()
        {
            ["full_name"] = Str(p, "full_name") ?? throw new Invalid("Ad Soyad eksik."),
            ["discipline"] = discipline,
            ["title"] = EngineerWriteEndpoints.TitleOf(parsed),
            ["chamber_reg_no"] = Str(p, "chamber_reg_no"),
            ["company_id"] = companyId,
            ["address"] = Str(p, "address"),
            ["phone"] = Str(p, "phone"),
        };
    }

    private static JsonElement Parse(string json)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrEmpty(json) ? "{}" : json);
        return doc.RootElement.Clone();
    }

    private static string? Str(JsonElement p, string name) =>
        p.ValueKind == JsonValueKind.Object && p.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? Clean(v.GetString())
            : null;

    private static DateOnly? DateOf(JsonElement p, string name) =>
        Str(p, name) is { } s ? DateOnly.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) ? d : throw new Invalid($"Geçersiz tarih: {name}") : null;

    private static Guid? GuidOf(JsonElement p, string name) =>
        Str(p, name) is { } s ? Guid.TryParse(s, out var g) ? g : throw new Invalid($"Geçersiz kimlik: {name}") : null;
}
