using Amazon.S3;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Storage;
using Microsoft.EntityFrameworkCore;
using static GensisTd.Api.Endpoints.CompanyWriteEndpoints;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Engineers and their documents for the Mühendisler / Mühendislerim screens (admin/actions.ts
/// createEngineer, updateEngineer, uploadEngineerDocument). Staff write directly; a customer works
/// only on their own company's engineers and every change goes to pending_changes (ADR-003).
/// </summary>
public static class EngineerWriteEndpoints
{
    public record EngineerInput(
        string? FullName, EngineerDiscipline? Discipline, string? ChamberRegNo, Guid? CompanyId, string? Address, string? Phone);
    public record EngineerDto(
        Guid Id, string FullName, EngineerDiscipline Discipline, string? Title, string? ChamberRegNo, Guid? CompanyId,
        string? CompanyShortName, string? Address, string? Phone);
    public record EngineerDocDto(Guid Id, Guid EngineerId, string DocType, string? OriginalName, DateOnly? ValidUntil, bool HasFile);
    public record EngineerDocumentInput(string? DocType, string? Key, string? OriginalName, DateOnly? ValidUntil);

    public const string Folder = "muhendis";

    public static string TitleOf(EngineerDiscipline d) => d switch
    {
        EngineerDiscipline.Makine => "Mak.Müh.",
        EngineerDiscipline.Elektrik => "Elk.Müh.",
        EngineerDiscipline.ElektrikElektronik => "Elk./Elektronik Müh.",
        EngineerDiscipline.Mekatronik => "Mekatronik Müh.",
        _ => "",
    };

    public static void MapEngineerWriteEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/engineers").RequireAuthorization();

        // Full records (address, phone) for the management screens: staff all, customers their own company's.
        g.MapGet("/", (Actor actor, AppDbContext db, CancellationToken ct) =>
            Editable(db.Engineers.AsNoTracking(), actor).OrderBy(e => EF.Functions.Collate(e.FullName, Collations.Turkish))
                .Select(e => new EngineerDto(e.Id, e.FullName, e.Discipline, e.Title, e.ChamberRegNo, e.CompanyId,
                    e.Company != null ? e.Company.ShortName : null, e.Address, e.Phone))
                .ToListAsync(ct));

        // Their documents (live Mühendislerim showed a customer their own engineers' documents).
        g.MapGet("/documents", (Actor actor, AppDbContext db, CancellationToken ct) =>
            db.EngineerDocuments.AsNoTracking().Where(d => Editable(db.Engineers, actor).Any(e => e.Id == d.EngineerId))
                .Select(d => new EngineerDocDto(d.Id, d.EngineerId, d.DocType, d.OriginalName, d.ValidUntil, d.StoragePath != null))
                .ToListAsync(ct));

        g.MapPost("/", async (EngineerInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (Validate(input) is { } invalid) return invalid;
            if (!actor.IsStaff)
            {
                // A customer adds to their own company only, whatever the form says.
                if (actor.CompanyId is not { } own) return Results.Forbid();
                db.PendingChanges.Add(Pending(actor, "engineer_new", own, Payload(input, own)));
                await db.SaveChangesAsync(ct);
                return Results.Ok(new WriteResult(true, null));
            }
            if (input.CompanyId is { } cid && !await db.Companies.AnyAsync(c => c.Id == cid, ct))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["companyId"] = ["Firma bulunamadı."] });
            var engineer = new Engineer { Id = Guid.NewGuid(), IsActive = true };
            Apply(engineer, Payload(input, input.CompanyId));
            db.Engineers.Add(engineer);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new WriteResult(false, engineer.Id));
        });

        g.MapPut("/{id:guid}", async (Guid id, EngineerInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (Validate(input) is { } invalid) return invalid;
            var engineer = await Editable(db.Engineers, actor).SingleOrDefaultAsync(e => e.Id == id, ct);
            if (engineer is null) return Results.NotFound();
            if (!actor.IsStaff)
            {
                var change = Pending(actor, "engineer_edit", engineer.CompanyId, Payload(input, engineer.CompanyId));
                change.TargetId = id;
                change.EngineerId = id;
                db.PendingChanges.Add(change);
                await db.SaveChangesAsync(ct);
                return Results.Ok(new WriteResult(true, null));
            }
            if (input.CompanyId is { } cid && !await db.Companies.AnyAsync(c => c.Id == cid, ct))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["companyId"] = ["Firma bulunamadı."] });
            Apply(engineer, Payload(input, input.CompanyId));
            await db.SaveChangesAsync(ct);
            return Results.Ok(new WriteResult(false, id));
        });

        g.MapPost("/{id:guid}/documents/upload-url", async (Guid id, UploadUrlRequest req, Actor actor, AppDbContext db,
            StorageService storage, CancellationToken ct) =>
        {
            if (!UploadKeys.IsValidKind(req.DocType))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["docType"] = ["Geçersiz belge türü."] });
            if (!await Editable(db.Engineers, actor).AnyAsync(e => e.Id == id, ct)) return Results.NotFound();

            var key = UploadKeys.New(Folder, id, req.DocType!, req.FileName, pending: !actor.IsStaff);
            var contentType = string.IsNullOrWhiteSpace(req.ContentType) ? "application/octet-stream" : req.ContentType.Trim();
            var url = await storage.PresignAsync(FileEndpoints.DocumentsBucket, key, HttpVerb.PUT, UploadKeys.UploadLifetime, contentType);
            return Results.Ok(new UploadUrl(key, url, contentType, DateTime.UtcNow.Add(UploadKeys.UploadLifetime)));
        });

        g.MapPost("/{id:guid}/documents", async (Guid id, EngineerDocumentInput input, Actor actor, AppDbContext db,
            StorageService storage, ILoggerFactory logs, CancellationToken ct) =>
        {
            if (!UploadKeys.IsValidKind(input.DocType))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["docType"] = ["Geçersiz belge türü."] });
            var engineer = await Editable(db.Engineers, actor).AsNoTracking().SingleOrDefaultAsync(e => e.Id == id, ct);
            if (engineer is null) return Results.NotFound();
            if (await CheckUploadAsync(db, storage, Folder, id, input.DocType!, input.Key, actor.IsStaff, ct) is { } badFile)
                return badFile;

            if (!actor.IsStaff)
            {
                var change = Pending(actor, "engineer_doc", engineer.CompanyId, new() { ["valid_until"] = input.ValidUntil });
                change.EngineerId = id;
                change.DocType = input.DocType;
                change.StoragePath = input.Key;
                change.OriginalName = input.Key is null ? null : Clean(input.OriginalName);
                db.PendingChanges.Add(change);
                await db.SaveChangesAsync(ct);
                return Results.Ok(new WriteResult(true, null));
            }

            // One document per engineer and type (unique engineer_id, doc_type): update or add.
            var doc = await db.EngineerDocuments.SingleOrDefaultAsync(d => d.EngineerId == id && d.DocType == input.DocType, ct)
                ?? db.EngineerDocuments.Add(new EngineerDocument { Id = Guid.NewGuid(), EngineerId = id, DocType = input.DocType!, UploadedAt = DateTime.UtcNow }).Entity;
            var replaced = ApplyEngineerDocument(doc, input.ValidUntil, input.Key, Clean(input.OriginalName), actor.UserId);
            await db.SaveChangesAsync(ct);
            if (replaced is not null)
                await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, [replaced], logs.CreateLogger(nameof(EngineerWriteEndpoints)));
            return Results.Ok(new WriteResult(false, doc.Id));
        });
    }

    /// <summary>Engineers the actor may change: staff all, a customer their own company's (not Gensis's).</summary>
    public static IQueryable<Engineer> Editable(IQueryable<Engineer> q, Actor a) =>
        a.IsStaff ? q : a.CompanyId is { } cid ? q.Where(e => e.CompanyId == cid) : q.Where(_ => false);

    private static IResult? Validate(EngineerInput i)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(i.FullName)) errors["fullName"] = ["Ad Soyad zorunlu."];
        if (i.Discipline is null) errors["discipline"] = ["Mühendislik tipi seçin."];
        return errors.Count == 0 ? null : Results.ValidationProblem(errors);
    }

    // Payload keys as in the live action, so approval applies them unchanged.
    private static Dictionary<string, object?> Payload(EngineerInput i, Guid? companyId) => new()
    {
        ["full_name"] = i.FullName!.Trim(),
        ["discipline"] = PgNames.Of(i.Discipline!.Value),
        ["title"] = TitleOf(i.Discipline!.Value),
        ["chamber_reg_no"] = Clean(i.ChamberRegNo),
        ["company_id"] = companyId,
        ["address"] = Clean(i.Address),
        ["phone"] = Clean(i.Phone),
    };

    public static void Apply(Engineer e, IReadOnlyDictionary<string, object?> p)
    {
        e.FullName = (string)p["full_name"]!;
        e.Discipline = PgNames.Parse<EngineerDiscipline>((string)p["discipline"]!);
        e.Title = (string?)p["title"];
        e.ChamberRegNo = (string?)p["chamber_reg_no"];
        e.CompanyId = (Guid?)p["company_id"];
        e.Address = (string?)p["address"];
        e.Phone = (string?)p["phone"];
    }

    /// <summary>Applies validity and file; returns the previous file's key when a new file replaces it.</summary>
    public static string? ApplyEngineerDocument(EngineerDocument d, DateOnly? validUntil, string? key, string? originalName, Guid? uploadedBy)
    {
        d.ValidUntil = validUntil;
        d.UpdatedAt = DateTime.UtcNow;
        if (key is null) return null;
        var previous = d.StoragePath;
        d.StoragePath = key;
        d.OriginalName = originalName;
        d.UploadedBy = uploadedBy;
        d.UploadedAt = DateTime.UtcNow;
        return previous;
    }
}
