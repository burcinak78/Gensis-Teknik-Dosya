using Amazon.S3;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Storage;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Catalog management for staff (admin/actions.ts): equipment brands and models, certificates with their
/// PDF versions, ilgili idareler and notified bodies. Reads stay in <see cref="CatalogEndpoints"/>.
/// </summary>
public static class CatalogAdminEndpoints
{
    public const string CertificateFolder = "sertifika";

    public record BrandInput(Guid CategoryId, string? Name);
    public record ModelInput(Guid CategoryId, Guid? BrandId, string? NewBrand, string? ModelName, Guid? CertificateId, List<Guid>? CertIds);
    public record ModelUpdateInput(string? Name, Guid? CertificateId, List<Guid>? CertIds);
    public record CertificateInput(
        string? CertNo, Guid? NotifiedBodyId, DateOnly? IssueDate, DateOnly? ValidUntil, string? BelgeTipi, Guid? CategoryId,
        string? FirmaAdi, Guid? ModelId);
    public record FileNameInput(string? FileName);
    public record CertificateFileInput(string? Key, string? OriginalName);
    public record IlgiliIdareInput(string? Name, string? Address, short? ProvinceId, string? Suffix);
    public record NotifiedBodyInput(string? Name, string? IdentityNo, string? Address, string? ShortName, string? City, string? Country);

    public static void MapCatalogAdminEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/catalog").RequireAuthorization(Policies.Staff);

        // ---- Equipment ----
        g.MapPost("/equipment/brands", async (BrandInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (input.CategoryId == Guid.Empty || string.IsNullOrWhiteSpace(input.Name))
                return Invalid("name", "Kategori ve marka adı zorunlu.");
            var brand = new EquipmentBrand { Id = Guid.NewGuid(), CategoryId = input.CategoryId, Name = input.Name.Trim() };
            db.EquipmentBrands.Add(brand);
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            return Results.Ok(new { brand.Id, message = "Marka eklendi." });
        });

        g.MapPost("/equipment/models", async (ModelInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (input.CategoryId == Guid.Empty || string.IsNullOrWhiteSpace(input.ModelName))
                return Invalid("modelName", "Kategori ve model adı zorunlu.");
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var brandId = input.BrandId;
            if (brandId is null && !string.IsNullOrWhiteSpace(input.NewBrand))
            {
                var brand = new EquipmentBrand { Id = Guid.NewGuid(), CategoryId = input.CategoryId, Name = input.NewBrand.Trim() };
                db.EquipmentBrands.Add(brand);
                brandId = brand.Id;
            }
            if (brandId is null) return Invalid("brandId", "Marka seçin veya yeni marka girin.");
            var model = new EquipmentModel { Id = Guid.NewGuid(), BrandId = brandId.Value, Name = input.ModelName.Trim(), Specs = "{}" };
            if (await LinkCertificatesAsync(db, model, input.CertificateId, input.CertIds, ct) is { } bad) return bad;
            db.EquipmentModels.Add(model);
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            await tx.CommitAsync(ct);
            return Results.Ok(new { model.Id, message = "Ekipman modeli eklendi." });
        });

        g.MapPut("/equipment/models/{id:guid}", async (Guid id, ModelUpdateInput input, AppDbContext db, CancellationToken ct) =>
        {
            var model = await db.EquipmentModels.Include(m => m.Certificates).SingleOrDefaultAsync(m => m.Id == id, ct);
            if (model is null) return Results.NotFound();
            if (!string.IsNullOrWhiteSpace(input.Name)) model.Name = input.Name.Trim();
            model.Certificates.Clear();
            if (await LinkCertificatesAsync(db, model, input.CertificateId, input.CertIds, ct) is { } bad) return bad;
            model.UpdatedAt = DateTime.UtcNow;
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            return Results.Ok(new { message = "Model güncellendi." });
        });

        g.MapDelete("/equipment/models/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var model = await db.EquipmentModels.Include(m => m.Certificates).SingleOrDefaultAsync(m => m.Id == id, ct);
            if (model is null) return Results.NotFound();
            model.Certificates.Clear();
            db.EquipmentModels.Remove(model);
            return await DeleteAsync(db, "Model silindi.", "Model projelerde kullanılıyor", ct);
        });

        // ---- Certificates ----
        // Saving an existing certificate number updates that certificate (as before).
        g.MapPost("/certificates", async (CertificateInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.CertNo)) return Invalid("certNo", "Sertifika no zorunlu.");
            var certNo = input.CertNo.Trim();
            var cert = await db.Certificates.SingleOrDefaultAsync(c => c.CertNo == certNo, ct)
                ?? db.Certificates.Add(new Certificate { Id = Guid.NewGuid(), CertNo = certNo }).Entity;
            ApplyCertificate(cert, input);
            if (input.ModelId is { } mid)
            {
                var model = await db.EquipmentModels.SingleOrDefaultAsync(m => m.Id == mid, ct);
                if (model is null) return Invalid("modelId", "Model bulunamadı.");
                model.CertificateId = cert.Id;
            }
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            return Results.Ok(new { cert.Id, message = "Sertifika kaydedildi." });
        });

        g.MapPut("/certificates/{id:guid}", async (Guid id, CertificateInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.CertNo)) return Invalid("certNo", "Sertifika no zorunlu.");
            var cert = await db.Certificates.SingleOrDefaultAsync(c => c.Id == id, ct);
            if (cert is null) return Results.NotFound();
            cert.CertNo = input.CertNo.Trim();
            ApplyCertificate(cert, input);
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            return Results.Ok(new { cert.Id, message = "Sertifika güncellendi." });
        });

        g.MapDelete("/certificates/{id:guid}", async (Guid id, AppDbContext db, StorageService storage, ILoggerFactory logs, CancellationToken ct) =>
        {
            if (!await db.Certificates.AnyAsync(c => c.Id == id, ct)) return Results.NotFound();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var paths = await db.CertificateFiles.Where(f => f.CertificateId == id).Select(f => f.StoragePath).ToListAsync(ct);
            await db.EquipmentModels.Where(m => m.CertificateId == id).ExecuteUpdateAsync(s => s.SetProperty(m => m.CertificateId, (Guid?)null), ct);
            await db.Database.ExecuteSqlAsync($"DELETE FROM public.model_certificates WHERE certificate_id = {id}", ct);
            await db.CertificateFiles.Where(f => f.CertificateId == id).ExecuteDeleteAsync(ct);
            try
            {
                await db.Certificates.Where(c => c.Id == id).ExecuteDeleteAsync(ct);
            }
            catch (PostgresException pg) when (pg.SqlState == PostgresErrorCodes.ForeignKeyViolation)
            {
                return Results.Conflict(new { error = $"Sertifika başka kayıtlarda kullanılıyor ({pg.TableName})." });
            }
            await tx.CommitAsync(ct);
            await storage.DeleteQuietlyAsync(FileEndpoints.CertificatesBucket, paths, logs.CreateLogger(nameof(CatalogAdminEndpoints)));
            return Results.Ok(new { message = "Sertifika silindi." });
        });

        // A new PDF becomes the certificate's current version; earlier versions stay on record.
        g.MapPost("/certificates/{id:guid}/files/upload-url", async (Guid id, FileNameInput input, AppDbContext db, StorageService storage,
            CancellationToken ct) =>
        {
            if (!await db.Certificates.AnyAsync(c => c.Id == id, ct)) return Results.NotFound();
            var key = UploadKeys.New(CertificateFolder, id, "pdf", input.FileName ?? "sertifika.pdf", pending: false);
            // Certificates are PDFs (as before); the signed type keeps the stored Content-Type a PDF.
            var url = await storage.PresignAsync(FileEndpoints.CertificatesBucket, key, HttpVerb.PUT, UploadKeys.UploadLifetime, "application/pdf");
            return Results.Ok(new { key, url, contentType = "application/pdf", expiresAt = DateTime.UtcNow.Add(UploadKeys.UploadLifetime) });
        });

        g.MapPost("/certificates/{id:guid}/files", async (Guid id, CertificateFileInput input, Actor actor, AppDbContext db,
            StorageService storage, CancellationToken ct) =>
        {
            if (!await db.Certificates.AnyAsync(c => c.Id == id, ct)) return Results.NotFound();
            if (input.Key is null || UploadKeys.KindOf(CertificateFolder, id, input.Key, pending: false) != "pdf")
                return Invalid("key", "Geçersiz dosya anahtarı.");
            if (await db.CertificateFiles.AnyAsync(f => f.StoragePath == input.Key, ct)) return Results.Conflict();
            var size = await storage.SizeAsync(FileEndpoints.CertificatesBucket, input.Key, ct);
            if (size is null) return Invalid("key", "Dosya yüklenmemiş.");
            if (size > UploadKeys.MaxBytes)
            {
                await storage.DeleteAsync(FileEndpoints.CertificatesBucket, input.Key, ct);
                return Invalid("key", "Dosya 50 MB'den büyük olamaz.");
            }
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            // Clear the current flag first: at most one current file per certificate.
            await db.CertificateFiles.Where(f => f.CertificateId == id && f.IsCurrent).ExecuteUpdateAsync(s => s.SetProperty(f => f.IsCurrent, false), ct);
            var version = await db.CertificateFiles.CountAsync(f => f.CertificateId == id, ct) + 1;
            db.CertificateFiles.Add(new CertificateFile
            {
                Id = Guid.NewGuid(), CertificateId = id, Version = version, StoragePath = input.Key,
                OriginalName = string.IsNullOrWhiteSpace(input.OriginalName) ? null : input.OriginalName.Trim(),
                IsCurrent = true, UploadedBy = actor.UserId, UploadedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Results.Ok(new { version, message = "Dosya yüklendi." });
        });

        // ---- İlgili idareler (create is in CatalogEndpoints for the proje onay wizard) ----
        g.MapPut("/ilgili-idareler/{id:guid}", async (Guid id, IlgiliIdareInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.Name)) return Invalid("name", "İlgili idare adı zorunlu.");
            var idare = await db.IlgiliIdarelers.SingleOrDefaultAsync(i => i.Id == id, ct);
            if (idare is null) return Results.NotFound();
            idare.Name = input.Name.Trim();
            idare.Address = Clean(input.Address);
            idare.ProvinceId = input.ProvinceId;
            idare.Suffix = Clean(input.Suffix) ?? "belediye";
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            return Results.Ok(new { message = "İlgili idare güncellendi." });
        });

        g.MapDelete("/ilgili-idareler/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (!await db.IlgiliIdarelers.AnyAsync(i => i.Id == id, ct)) return Results.NotFound();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.ProjeOnays.Where(p => p.IlgiliIdareId == id).ExecuteUpdateAsync(s => s.SetProperty(p => p.IlgiliIdareId, (Guid?)null), ct);
            try
            {
                await db.IlgiliIdarelers.Where(i => i.Id == id).ExecuteDeleteAsync(ct);
            }
            catch (PostgresException pg) when (pg.SqlState == PostgresErrorCodes.ForeignKeyViolation)
            {
                return Results.Conflict(new { error = $"İlgili idare başka kayıtlarda kullanılıyor ({pg.TableName})." });
            }
            await tx.CommitAsync(ct);
            return Results.Ok(new { message = "İlgili idare silindi." });
        });

        // ---- Notified bodies ----
        g.MapPost("/notified-bodies", async (NotifiedBodyInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.Name)) return Invalid("name", "Ticari ünvan zorunlu.");
            var nb = new NotifiedBody { Id = Guid.NewGuid() };
            ApplyNotifiedBody(nb, input);
            db.NotifiedBodies.Add(nb);
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            return Results.Ok(new { nb.Id, message = "Onaylanmış kuruluş eklendi." });
        });

        g.MapPut("/notified-bodies/{id:guid}", async (Guid id, NotifiedBodyInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.Name)) return Invalid("name", "Ticari ünvan zorunlu.");
            var nb = await db.NotifiedBodies.SingleOrDefaultAsync(n => n.Id == id, ct);
            if (nb is null) return Results.NotFound();
            ApplyNotifiedBody(nb, input);
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            return Results.Ok(new { nb.Id, message = "Onaylanmış kuruluş güncellendi." });
        });

        g.MapDelete("/notified-bodies/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            if (!await db.NotifiedBodies.AnyAsync(n => n.Id == id, ct)) return Results.NotFound();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.Certificates.Where(c => c.NotifiedBodyId == id).ExecuteUpdateAsync(s => s.SetProperty(c => c.NotifiedBodyId, (Guid?)null), ct);
            await db.CompanyDocuments.Where(d => d.NotifiedBodyId == id).ExecuteUpdateAsync(s => s.SetProperty(d => d.NotifiedBodyId, (Guid?)null), ct);
            try
            {
                await db.NotifiedBodies.Where(n => n.Id == id).ExecuteDeleteAsync(ct);
            }
            catch (PostgresException pg) when (pg.SqlState == PostgresErrorCodes.ForeignKeyViolation)
            {
                return Results.Conflict(new { error = $"Kuruluş başka kayıtlarda kullanılıyor ({pg.TableName})." });
            }
            await tx.CommitAsync(ct);
            return Results.Ok(new { message = "Onaylanmış kuruluş silindi." });
        });
    }

    /// <summary>The first linked certificate is the model's main one (as before); all are linked through model_certificates.</summary>
    private static async Task<IResult?> LinkCertificatesAsync(AppDbContext db, EquipmentModel model, Guid? certificateId, List<Guid>? certIds,
        CancellationToken ct)
    {
        var ids = (certIds ?? []).Where(i => i != Guid.Empty).Distinct().ToList();
        var certs = ids.Count == 0 ? [] : await db.Certificates.Where(c => ids.Contains(c.Id)).ToListAsync(ct);
        if (certs.Count != ids.Count) return Invalid("certIds", "Sertifika bulunamadı.");
        foreach (var c in certs) model.Certificates.Add(c);
        model.CertificateId = ids.Count > 0 ? ids[0] : certificateId;
        return null;
    }

    private static void ApplyCertificate(Certificate c, CertificateInput i)
    {
        c.NotifiedBodyId = i.NotifiedBodyId;
        c.IssueDate = i.IssueDate;
        c.ValidUntil = i.ValidUntil;
        c.BelgeTipi = Clean(i.BelgeTipi);
        c.CategoryId = i.CategoryId;
        c.FirmaAdi = Clean(i.FirmaAdi);
        c.UpdatedAt = DateTime.UtcNow;
    }

    private static void ApplyNotifiedBody(NotifiedBody nb, NotifiedBodyInput i)
    {
        nb.Name = i.Name!.Trim();
        nb.ShortName = Clean(i.ShortName) ?? nb.Name; // short name falls back to the title
        nb.IdentityNo = Clean(i.IdentityNo);
        nb.City = Clean(i.City);
        nb.Country = Clean(i.Country);
        nb.Address = Clean(i.Address);
    }

    private static async Task<IResult> DeleteAsync(AppDbContext db, string message, string inUse, CancellationToken ct)
    {
        try
        {
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { message });
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation } pg)
        {
            return Results.Conflict(new { error = $"{inUse} ({pg.TableName})." });
        }
    }

    private static IResult Invalid(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
