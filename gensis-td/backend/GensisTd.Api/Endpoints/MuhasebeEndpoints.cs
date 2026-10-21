using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using static GensisTd.Api.Endpoints.TakipEndpoints;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Muhasebe: invoices and deliveries of jobs sent to accounting (muhasebe/actions.ts saveMuhasebe).
/// Office roles read (gensis read-only, as before); admin and muhasebeci record. Lists every takip row,
/// including those a teknik dosya sent (with a TD number).
/// </summary>
public static class MuhasebeEndpoints
{
    public record MuhasebeRow(
        Guid Id, Guid TakipId, DateOnly? FaturaTarihi, string? FaturaNo, bool CariyeIslendi, string? TeslimYontemi,
        string? KargoSirketi, string? KargoTakipNo, DateOnly? TeslimTarihi, Guid? CreatedBy, DateTime CreatedAt, DateTime UpdatedAt);
    public record AccountingRow(TakipRow Row, MuhasebeRow? Muhasebe);
    public record MuhasebeInput(
        DateOnly? FaturaTarihi, string? FaturaNo, DateOnly? TeslimTarihi, string? TeslimYontemi, string? KargoSirketi, string? KargoTakipNo);

    public static void MapMuhasebeEndpoints(this WebApplication app)
    {
        app.MapGet("/api/muhasebe", async (AppDbContext db, CancellationToken ct) =>
        {
            var rows = await Rows(db.TakipProjelers.AsNoTracking().OrderByDescending(t => t.ProjeNo).ThenBy(t => t.CreatedAt).Take(5000))
                .ToListAsync(ct);
            var ids = rows.Select(r => r.Id).ToList();
            var muhasebe = await db.TakipMuhasebes.AsNoTracking().Where(m => ids.Contains(m.TakipId))
                .Select(m => new MuhasebeRow(m.Id, m.TakipId, m.FaturaTarihi, m.FaturaNo, m.CariyeIslendi, m.TeslimYontemi, m.KargoSirketi,
                    m.KargoTakipNo, m.TeslimTarihi, m.CreatedBy, m.CreatedAt, m.UpdatedAt))
                .ToDictionaryAsync(m => m.TakipId, ct);
            return rows.Select(r => new AccountingRow(r, muhasebe.GetValueOrDefault(r.Id)));
        }).RequireAuthorization(Policies.Office);

        // Invoice fields are optional. The job counts as delivered (cariye işlendi) once the delivery is
        // complete: a date, and for hard copies the method (and courier details when sent by courier).
        app.MapPut("/api/muhasebe/{takipId:guid}", async (Guid takipId, MuhasebeInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (input.TeslimYontemi is not (null or "elden" or "kargo"))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["teslimYontemi"] = ["Geçersiz teslim yöntemi."] });
            var takip = await db.TakipProjelers.SingleOrDefaultAsync(t => t.Id == takipId, ct);
            if (takip is null) return Results.NotFound();
            if (!takip.MuhasebeyeGonderildi)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["takip"] = ["Bu proje henüz muhasebeye gönderilmedi."] });

            // The delivery type comes from the job itself, not from the form.
            var hard = takip.TeslimTipi == "hard_copy";
            var yontem = hard ? input.TeslimYontemi : null;
            var kargo = yontem == "kargo";
            var kargoSirketi = kargo ? Clean(input.KargoSirketi) : null;
            var kargoTakipNo = kargo ? Clean(input.KargoTakipNo) : null;
            var teslimTamam = !hard || (yontem is not null && (!kargo || (kargoSirketi is not null && kargoTakipNo is not null)));
            var tamam = input.TeslimTarihi is not null && teslimTamam;

            var m = await db.TakipMuhasebes.SingleOrDefaultAsync(x => x.TakipId == takipId, ct)
                ?? db.TakipMuhasebes.Add(new TakipMuhasebe { Id = Guid.NewGuid(), TakipId = takipId }).Entity;
            m.FaturaTarihi = input.FaturaTarihi;
            m.FaturaNo = Clean(input.FaturaNo);
            m.CariyeIslendi = tamam;
            m.TeslimYontemi = yontem;
            m.KargoSirketi = kargoSirketi;
            m.KargoTakipNo = kargoTakipNo;
            m.TeslimTarihi = input.TeslimTarihi;
            m.CreatedBy = actor.UserId;
            m.UpdatedAt = DateTime.UtcNow;
            takip.MuhasebeDurumu = tamam ? "tamamlandi" : "bekliyor";
            takip.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { message = tamam ? "Kaydedildi — teslim edildi." : "Kaydedildi (eksik bilgi — işlem bekliyor)." });
        }).RequireAuthorization(Policies.Accounting);
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
