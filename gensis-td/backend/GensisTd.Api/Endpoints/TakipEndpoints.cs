using Amazon.S3;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Storage;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Proje Takip: Gensis's internal job tracking (proje-takip/actions.ts). Office roles read (muhasebeci
/// read-only, as before); only staff write. Customers have no access. Rows created from a teknik dosya's
/// "muhasebeye gönder" (with a TD number) belong to accounting and are not listed here.
/// </summary>
public static class TakipEndpoints
{
    public static readonly string[] ProjeTipleri = ["mimari", "uygulama"];
    public static readonly string[] DocKinds =
        ["mimari_proje", "elektrik_projesi", "statik_projesi", "olcu_formu", "yapi_ruhsati", "diger", "tamamlanan_proje", "revize_proje"];
    // One file per kind: a new upload replaces the previous one. "diger" and "tamamlanan_proje" keep many.
    public static readonly string[] SingleKinds = ["mimari_proje", "elektrik_projesi", "statik_projesi", "olcu_formu", "yapi_ruhsati"];
    public const string Folder = "takip";
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    public record TakipRow(
        Guid Id, int ProjeNo, string ProjeTipi, DateOnly? SiparisTarihi, Guid? CompanyId, string? AdaParsel, string? IsAdi,
        int? AsansorSayisi, string? AsansorTipi, int? ProvinceId, string? DistrictId, string? IlAdi, string? IlceAdi, decimal? Fiyat,
        string? FaturaTipi, decimal? ToplamTutar, Guid? ProjeSorumlusuId, DateOnly? TahminiTamamlanma, string Durum,
        string? BekliyorAciklama, DateOnly? TamamlanmaTarihi, string? TeslimTipi, int? HardCopyAdedi, bool MuhasebeyeGonderildi,
        string? MuhasebeDurumu, Guid? CreatedBy, DateTime CreatedAt, DateTime UpdatedAt, string? Ada, string? Parsel, Guid? ParentId,
        string? RevNo, DateOnly? RevTarihi, string? RevAciklama, Guid? MontajFirmaId, string? TdNo, string? AsansorSeriNo);
    public record DocItem(Guid Id, Guid TakipId, string Kind, string? OriginalName, DateTime CreatedAt);
    public record MuhasebeItem(bool CariyeIslendi, DateOnly? TeslimTarihi);
    public record ListRow(TakipRow Row, List<DocItem> Docs, MuhasebeItem? Muhasebe);

    public record TakipInput(
        string? ProjeTipi, DateOnly? SiparisTarihi, Guid CompanyId, string? Ada, string? Parsel, string? IsAdi, int? AsansorSayisi,
        string? AsansorTipi, string? AsansorSeriNo, int? ProvinceId, string? DistrictId, string? IlAdi, string? IlceAdi, decimal? Fiyat,
        string? FaturaTipi, Guid? ProjeSorumlusuId, DateOnly? TahminiTamamlanma, Guid? MontajFirmaId);
    public record RevisionInput(string? RevNo, DateOnly? RevTarihi, decimal? Fiyat, string? FaturaTipi, string? RevAciklama);
    public record BekliyorInput(string? Aciklama);
    public record CompleteInput(DateOnly? TamamlanmaTarihi, string? TeslimTipi, int? HardCopyAdedi);
    public record UploadUrlRequest(string? Kind, string? FileName, string? ContentType);
    public record DocumentInput(string? Key, string? OriginalName);

    public static void MapTakipEndpoints(this WebApplication app)
    {
        var read = app.MapGroup("/api/takip").RequireAuthorization(Policies.Office);
        var write = app.MapGroup("/api/takip").RequireAuthorization(Policies.Staff);

        read.MapGet("/", async (AppDbContext db, CancellationToken ct) =>
        {
            // As before: opening the list moves overdue HAZIRLANIYOR jobs to BEKLIYOR (date in Turkey).
            var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Istanbul));
            await db.TakipProjelers.Where(t => t.Durum == "HAZIRLANIYOR" && t.TahminiTamamlanma < today)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.Durum, "BEKLIYOR"), ct);

            var rows = await Rows(db.TakipProjelers.AsNoTracking().Where(t => t.TdNo == null)
                .OrderByDescending(t => t.ProjeNo).ThenBy(t => t.CreatedAt).Take(5000)).ToListAsync(ct);
            var ids = rows.Select(r => r.Id).ToList();
            var docs = (await db.TakipDokumanlars.AsNoTracking().Where(d => ids.Contains(d.TakipId))
                .Select(d => new DocItem(d.Id, d.TakipId, d.Kind, d.OriginalName, d.CreatedAt)).ToListAsync(ct))
                .ToLookup(d => d.TakipId);
            var muhasebe = await db.TakipMuhasebes.AsNoTracking().Where(m => ids.Contains(m.TakipId))
                .ToDictionaryAsync(m => m.TakipId, m => new MuhasebeItem(m.CariyeIslendi, m.TeslimTarihi), ct);
            return rows.Select(r => new ListRow(r, docs[r.Id].ToList(), muhasebe.GetValueOrDefault(r.Id)));
        });

        read.MapGet("/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
        {
            var row = await Rows(db.TakipProjelers.AsNoTracking().Where(t => t.Id == id)).SingleOrDefaultAsync(ct);
            if (row is null) return Results.NotFound();
            var docs = await db.TakipDokumanlars.AsNoTracking().Where(d => d.TakipId == id)
                .Select(d => new DocItem(d.Id, d.TakipId, d.Kind, d.OriginalName, d.CreatedAt)).ToListAsync(ct);
            var m = await db.TakipMuhasebes.AsNoTracking().Where(x => x.TakipId == id)
                .Select(x => new MuhasebeItem(x.CariyeIslendi, x.TeslimTarihi)).SingleOrDefaultAsync(ct);
            return Results.Ok(new ListRow(row, docs, m));
        });

        // Gensis staff who can be put in charge of a job.
        read.MapGet("/sorumlular", (AppDbContext db, CancellationToken ct) =>
            db.Profiles.AsNoTracking().Where(p => p.Role == AppRole.Admin || p.Role == AppRole.Gensis)
                .OrderBy(p => EF.Functions.Collate(p.FullName!, Collations.Turkish))
                .Select(p => new { p.Id, p.FullName, p.Role }).ToListAsync(ct));

        // The number the next job will probably get (shown on the new-job form; not reserved).
        read.MapGet("/next-no", async (AppDbContext db, CancellationToken ct) =>
            new { NextNo = await db.TakipCounters.Where(c => c.Id == 1).Select(c => (int?)c.NextNo).SingleOrDefaultAsync(ct) });

        write.MapPost("/", async (TakipInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (Validate(input) is { } invalid) return invalid;
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var row = new TakipProjeler
            {
                Id = Guid.NewGuid(), ProjeNo = await ProjectMuhasebeEndpoints.NextTakipNoAsync(db, ct), Durum = "HAZIRLANIYOR",
                CreatedBy = actor.UserId,
            };
            Apply(row, input);
            db.TakipProjelers.Add(row);
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            await tx.CommitAsync(ct);
            return Results.Created($"/api/takip/{row.Id}", new { row.Id, row.ProjeNo });
        });

        write.MapPut("/{id:guid}", async (Guid id, TakipInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (Validate(input) is { } invalid) return invalid;
            var row = await db.TakipProjelers.SingleOrDefaultAsync(t => t.Id == id && t.TdNo == null, ct);
            if (row is null) return Results.NotFound();
            Apply(row, input);
            row.UpdatedAt = DateTime.UtcNow;
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            return Results.Ok(new { row.Id });
        });

        // A revision is a child of the root job (never of another revision) with the root's number and data.
        write.MapPost("/{id:guid}/revisions", async (Guid id, RevisionInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (input.FaturaTipi is not ("faturali" or "faturasiz"))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["faturaTipi"] = ["Geçersiz fatura tipi."] });
            var parent = await db.TakipProjelers.AsNoTracking().SingleOrDefaultAsync(t => t.Id == id && t.TdNo == null, ct);
            if (parent is null) return Results.NotFound();
            var rev = new TakipProjeler
            {
                Id = Guid.NewGuid(), ProjeNo = parent.ProjeNo, ParentId = parent.ParentId ?? parent.Id,
                RevNo = Clean(input.RevNo), RevTarihi = input.RevTarihi, RevAciklama = Clean(input.RevAciklama),
                ProjeTipi = parent.ProjeTipi, SiparisTarihi = parent.SiparisTarihi, CompanyId = parent.CompanyId, Ada = parent.Ada,
                Parsel = parent.Parsel, AdaParsel = parent.AdaParsel, IsAdi = parent.IsAdi, AsansorSayisi = parent.AsansorSayisi,
                AsansorTipi = parent.AsansorTipi, AsansorSeriNo = parent.AsansorSeriNo, ProvinceId = parent.ProvinceId,
                DistrictId = parent.DistrictId, IlAdi = parent.IlAdi, IlceAdi = parent.IlceAdi,
                Fiyat = input.Fiyat, FaturaTipi = input.FaturaTipi, ToplamTutar = Total(input.Fiyat, input.FaturaTipi),
                ProjeSorumlusuId = parent.ProjeSorumlusuId, Durum = "HAZIRLANIYOR", CreatedBy = actor.UserId,
            };
            db.TakipProjelers.Add(rev);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/takip/{rev.Id}", new { rev.Id, rev.ProjeNo });
        });

        write.MapPost("/{id:guid}/bekliyor", async (Guid id, BekliyorInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.Aciklama))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["aciklama"] = ["Açıklama zorunludur."] });
            var n = await db.TakipProjelers.Where(t => t.Id == id && t.TdNo == null).ExecuteUpdateAsync(s => s
                .SetProperty(t => t.Durum, "BEKLIYOR").SetProperty(t => t.BekliyorAciklama, input.Aciklama.Trim())
                .SetProperty(t => t.UpdatedAt, DateTime.UtcNow), ct);
            return n == 0 ? Results.NotFound() : Results.Ok(new { message = "Açıklama kaydedildi." });
        });

        // Complete the job and send it to accounting; the finished project must be uploaded first.
        write.MapPost("/{id:guid}/complete", async (Guid id, CompleteInput input, AppDbContext db, CancellationToken ct) =>
        {
            var errors = new Dictionary<string, string[]>();
            if (input.TamamlanmaTarihi is null) errors["tamamlanmaTarihi"] = ["Tamamlanma tarihi zorunludur."];
            if (input.TeslimTipi is not ("hard_copy" or "dijital")) errors["teslimTipi"] = ["Teslim tipi seçilmelidir."];
            else if (input.TeslimTipi == "hard_copy" && input.HardCopyAdedi is null or < 1) errors["hardCopyAdedi"] = ["Hard Copy adedi giriniz."];
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            var row = await db.TakipProjelers.SingleOrDefaultAsync(t => t.Id == id && t.TdNo == null, ct);
            if (row is null) return Results.NotFound();
            if (!await db.TakipDokumanlars.AnyAsync(d => d.TakipId == id && d.Kind == "tamamlanan_proje", ct))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["dokuman"] = ["Önce tamamlanan projeyi yükleyin."] });
            row.Durum = "TAMAMLANDI";
            row.TamamlanmaTarihi = input.TamamlanmaTarihi;
            row.TeslimTipi = input.TeslimTipi;
            row.HardCopyAdedi = input.TeslimTipi == "hard_copy" ? input.HardCopyAdedi : null;
            row.MuhasebeyeGonderildi = true;
            row.MuhasebeDurumu = "bekliyor";
            row.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { message = "Proje tamamlandı ve muhasebeye gönderildi." });
        });

        // Deletes the job with its revisions, documents and accounting row (cascade, as before, posted or not:
        // user decision). The number is not given back.
        write.MapDelete("/{id:guid}", async (Guid id, AppDbContext db, StorageService storage, ILoggerFactory logs, CancellationToken ct) =>
        {
            if (!await db.TakipProjelers.AnyAsync(t => t.Id == id && t.TdNo == null, ct)) return Results.NotFound();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var paths = await db.TakipDokumanlars.Where(d => d.TakipId == id || d.Takip.ParentId == id)
                .Select(d => d.StoragePath).ToListAsync(ct);
            await db.TakipProjelers.Where(t => t.Id == id).ExecuteDeleteAsync(ct);
            await tx.CommitAsync(ct);
            await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, paths, logs.CreateLogger(nameof(TakipEndpoints)));
            return Results.Ok(new { message = "Kayıt silindi." });
        });

        write.MapPost("/{id:guid}/documents/upload-url", async (Guid id, UploadUrlRequest req, AppDbContext db, StorageService storage,
            CancellationToken ct) =>
        {
            if (req.Kind is null || !DocKinds.Contains(req.Kind))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["kind"] = ["Geçersiz doküman türü."] });
            if (!await db.TakipProjelers.AnyAsync(t => t.Id == id && t.TdNo == null, ct)) return Results.NotFound();
            var key = UploadKeys.New(Folder, id, req.Kind, req.FileName, pending: false);
            var contentType = string.IsNullOrWhiteSpace(req.ContentType) ? "application/octet-stream" : req.ContentType.Trim();
            var url = await storage.PresignAsync(FileEndpoints.DocumentsBucket, key, HttpVerb.PUT, UploadKeys.UploadLifetime, contentType);
            return Results.Ok(new { key, url, contentType, expiresAt = DateTime.UtcNow.Add(UploadKeys.UploadLifetime) });
        });

        write.MapPost("/{id:guid}/documents", async (Guid id, DocumentInput input, Actor actor, AppDbContext db, StorageService storage,
            ILoggerFactory logs, CancellationToken ct) =>
        {
            if (!await db.TakipProjelers.AnyAsync(t => t.Id == id && t.TdNo == null, ct)) return Results.NotFound();
            var kind = input.Key is null ? null : UploadKeys.KindOf(Folder, id, input.Key, pending: false);
            if (kind is null || !DocKinds.Contains(kind))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["key"] = ["Geçersiz dosya anahtarı."] });
            if (await db.TakipDokumanlars.AnyAsync(d => d.StoragePath == input.Key, ct)) return Results.Conflict();
            var size = await storage.SizeAsync(FileEndpoints.DocumentsBucket, input.Key!, ct);
            if (size is null)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["key"] = ["Dosya yüklenmemiş."] });
            if (size > UploadKeys.MaxBytes)
            {
                await storage.DeleteAsync(FileEndpoints.DocumentsBucket, input.Key!, ct);
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["key"] = ["Dosya 50 MB'den büyük olamaz."] });
            }

            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var replaced = new List<string>();
            if (SingleKinds.Contains(kind))
            {
                var previous = await db.TakipDokumanlars.Where(d => d.TakipId == id && d.Kind == kind).ToListAsync(ct);
                replaced.AddRange(previous.Select(d => d.StoragePath));
                db.TakipDokumanlars.RemoveRange(previous);
            }
            var doc = new TakipDokumanlar
            {
                Id = Guid.NewGuid(), TakipId = id, Kind = kind, StoragePath = input.Key!, OriginalName = Clean(input.OriginalName),
                UploadedBy = actor.UserId,
            };
            db.TakipDokumanlars.Add(doc);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, replaced, logs.CreateLogger(nameof(TakipEndpoints)));
            return Results.Ok(new { doc.Id });
        });

        write.MapDelete("/documents/{docId:guid}", async (Guid docId, AppDbContext db, StorageService storage, ILoggerFactory logs,
            CancellationToken ct) =>
        {
            var doc = await db.TakipDokumanlars.SingleOrDefaultAsync(d => d.Id == docId, ct);
            if (doc is null) return Results.NotFound();
            db.TakipDokumanlars.Remove(doc);
            await db.SaveChangesAsync(ct);
            await storage.DeleteQuietlyAsync(FileEndpoints.DocumentsBucket, [doc.StoragePath], logs.CreateLogger(nameof(TakipEndpoints)));
            return Results.NoContent();
        });
    }

    private static IQueryable<TakipRow> Rows(IQueryable<TakipProjeler> q) => q.Select(t => new TakipRow(
        t.Id, t.ProjeNo, t.ProjeTipi, t.SiparisTarihi, t.CompanyId, t.AdaParsel, t.IsAdi, t.AsansorSayisi, t.AsansorTipi, t.ProvinceId,
        t.DistrictId, t.IlAdi, t.IlceAdi, t.Fiyat, t.FaturaTipi, t.ToplamTutar, t.ProjeSorumlusuId, t.TahminiTamamlanma, t.Durum,
        t.BekliyorAciklama, t.TamamlanmaTarihi, t.TeslimTipi, t.HardCopyAdedi, t.MuhasebeyeGonderildi, t.MuhasebeDurumu, t.CreatedBy,
        t.CreatedAt, t.UpdatedAt, t.Ada, t.Parsel, t.ParentId, t.RevNo, t.RevTarihi, t.RevAciklama, t.MontajFirmaId, t.TdNo, t.AsansorSeriNo));

    private static IResult? Validate(TakipInput i)
    {
        var errors = new Dictionary<string, string[]>();
        if (i.CompanyId == Guid.Empty) errors["companyId"] = ["Firma seçilmedi."];
        if (i.ProjeTipi is null || !ProjeTipleri.Contains(i.ProjeTipi)) errors["projeTipi"] = ["Proje tipi seçilmedi."];
        if (i.FaturaTipi is not ("faturali" or "faturasiz")) errors["faturaTipi"] = ["Geçersiz fatura tipi."];
        return errors.Count == 0 ? null : Results.ValidationProblem(errors);
    }

    private static void Apply(TakipProjeler t, TakipInput i)
    {
        t.ProjeTipi = i.ProjeTipi!;
        t.SiparisTarihi = i.SiparisTarihi;
        t.CompanyId = i.CompanyId;
        t.Ada = Clean(i.Ada);
        t.Parsel = Clean(i.Parsel);
        t.AdaParsel = string.Join(" / ", new[] { t.Ada, t.Parsel }.Where(s => s != null)) is { Length: > 0 } ap ? ap : null;
        t.IsAdi = Clean(i.IsAdi);
        t.AsansorSayisi = i.AsansorSayisi;
        t.AsansorTipi = Clean(i.AsansorTipi);
        t.AsansorSeriNo = Clean(i.AsansorSeriNo);
        t.ProvinceId = i.ProvinceId;
        t.DistrictId = Clean(i.DistrictId);
        t.IlAdi = Clean(i.IlAdi);
        t.IlceAdi = Clean(i.IlceAdi);
        t.Fiyat = i.Fiyat;
        t.FaturaTipi = i.FaturaTipi;
        t.ToplamTutar = Total(i.Fiyat, i.FaturaTipi);
        t.ProjeSorumlusuId = i.ProjeSorumlusuId;
        t.TahminiTamamlanma = i.TahminiTamamlanma;
        t.MontajFirmaId = i.MontajFirmaId;
    }

    // Faturalı: price + 20% VAT.
    private static decimal? Total(decimal? fiyat, string? faturaTipi) =>
        fiyat is null ? null : faturaTipi == "faturali" ? Math.Round(fiyat.Value * 1.2m, 2) : fiyat;

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
