using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Personal notes (notlar), expiring-document notifications (bildirimler) and the menu counters
/// (lib/bildirimSayisi, onaySayisi, takipSayisi). Dates are Turkey dates.
/// </summary>
public static class NotificationEndpoints
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");
    public const int WarnDays = 30;

    public record NoteDto(Guid Id, string Icerik, DateTime SayacBaslangic, DateTime CreatedAt);
    public record NoteInput(string? Icerik);

    public record CompanyDocAlert(Guid Id, Guid CompanyId, string Firma, string DocType, string? BelgeNo, DateOnly ValidUntil);
    public record EngineerDocAlert(Guid Id, Guid EngineerId, string Ad, EngineerDiscipline Brans, string DocType, DateOnly ValidUntil);
    public record CertificateAlert(Guid Id, string? Kategori, string? BelgeTipi, string CertNo, string? Firma, DateOnly ValidUntil);
    public record Notifications(List<CompanyDocAlert> Musteri, List<EngineerDocAlert> Muhendis, List<CertificateAlert> Ekipman);
    public record Counters(int Bildirim, int Onay, int Takip, int Muhasebe);

    public static DateOnly Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Istanbul));

    public static void MapNotificationEndpoints(this WebApplication app)
    {
        // ---- Notes: each user's own (notlar_* policies, staff included) ----
        var notes = app.MapGroup("/api/notes").RequireAuthorization();

        notes.MapGet("/", (Actor actor, AppDbContext db, CancellationToken ct) =>
            db.Notlars.AsNoTracking().OwnedBy(actor).OrderByDescending(n => n.CreatedAt)
                .Select(n => new NoteDto(n.Id, n.Icerik, n.SayacBaslangic, n.CreatedAt)).ToListAsync(ct));

        notes.MapPost("/", async (NoteInput input, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.Icerik))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["icerik"] = ["Not boş olamaz."] });
            var now = DateTime.UtcNow;
            var note = new Notlar { Id = Guid.NewGuid(), UserId = actor.UserId, Icerik = input.Icerik.Trim(), SayacBaslangic = now, CreatedAt = now };
            db.Notlars.Add(note);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { note.Id, message = "Not eklendi." });
        });

        // Snoozing restarts the note's counter.
        notes.MapPost("/{id:guid}/snooze", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
            await db.Notlars.OwnedBy(actor).Where(n => n.Id == id)
                .ExecuteUpdateAsync(s => s.SetProperty(n => n.SayacBaslangic, DateTime.UtcNow), ct) == 0
                ? Results.NotFound()
                : Results.Ok(new { message = "Not ertelendi." }));

        notes.MapDelete("/{id:guid}", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
            await db.Notlars.OwnedBy(actor).Where(n => n.Id == id).ExecuteDeleteAsync(ct) == 0
                ? Results.NotFound()
                : Results.Ok(new { message = "Not silindi." }));

        // ---- Expiring documents: valid until within 30 days or already expired (no date: not listed) ----
        app.MapGet("/api/notifications", async (Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var cutoff = Today().AddDays(WarnDays);
            var musteri = await CompanyDocs(db, actor, cutoff).OrderBy(d => d.ValidUntil)
                .Select(d => new CompanyDocAlert(d.Id, d.CompanyId, d.Company.ShortName, d.DocType, d.BelgeNo, d.ValidUntil!.Value))
                .ToListAsync(ct);
            var muhendis = await EngineerDocs(db, actor, cutoff).OrderBy(d => d.ValidUntil)
                .Select(d => new EngineerDocAlert(d.Id, d.EngineerId, d.Engineer.FullName, d.Engineer.Discipline, d.DocType, d.ValidUntil!.Value))
                .ToListAsync(ct);
            var ekipman = actor.IsStaff
                ? await ExpiringCertificates(db, cutoff).OrderBy(c => c.ValidUntil)
                    .Select(c => new CertificateAlert(c.Id, c.Category != null ? c.Category.Name : null, c.BelgeTipi, c.CertNo, c.FirmaAdi, c.ValidUntil!.Value))
                    .ToListAsync(ct)
                : [];
            return new Notifications(musteri, muhendis, ekipman);
        }).RequireAuthorization();

        // ---- Menu counters, as the layout showed them ----
        app.MapGet("/api/me/counters", async (Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var today = Today();
            var cutoff = today.AddDays(WarnDays);
            var bildirim = await CompanyDocs(db, actor, cutoff).CountAsync(ct) + await EngineerDocs(db, actor, cutoff).CountAsync(ct)
                + (actor.IsStaff ? await ExpiringCertificates(db, cutoff).CountAsync(ct) : 0);
            var onay = actor.IsStaff ? await db.PendingChanges.CountAsync(p => p.Status == "pending", ct) : 0;
            // Jobs the user is in charge of that are due today or overdue.
            var takip = actor.IsStaff
                ? await db.TakipProjelers.CountAsync(t => t.ProjeSorumlusuId == actor.UserId && t.Durum != "TAMAMLANDI"
                    && t.TahminiTamamlanma != null && t.TahminiTamamlanma <= today, ct)
                : 0;
            var muhasebe = actor.Role is AppRole.Admin or AppRole.Muhasebeci
                ? await db.TakipProjelers.CountAsync(t => t.MuhasebeyeGonderildi && (t.MuhasebeDurumu == null || t.MuhasebeDurumu != "tamamlandi"), ct)
                : 0;
            return new Counters(bildirim, onay, takip, muhasebe);
        }).RequireAuthorization();
    }

    private static IQueryable<CompanyDocument> CompanyDocs(AppDbContext db, Actor actor, DateOnly cutoff) =>
        db.CompanyDocuments.AsNoTracking().VisibleTo(actor).Where(d => d.ValidUntil != null && d.ValidUntil <= cutoff);

    // Staff: all; others: their own company's engineers (as the live page filtered).
    private static IQueryable<EngineerDocument> EngineerDocs(AppDbContext db, Actor actor, DateOnly cutoff)
    {
        var q = db.EngineerDocuments.AsNoTracking().Where(d => d.ValidUntil != null && d.ValidUntil <= cutoff);
        return actor.IsStaff ? q : actor.CompanyId is { } cid ? q.Where(d => d.Engineer.CompanyId == cid) : q.Where(_ => false);
    }

    private static IQueryable<Certificate> ExpiringCertificates(AppDbContext db, DateOnly cutoff) =>
        db.Certificates.AsNoTracking().Where(c => c.ValidUntil != null && c.ValidUntil <= cutoff);
}
