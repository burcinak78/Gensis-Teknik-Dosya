using System.Text.Json;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>Teknik dosya projects. Every query goes through <see cref="AccessFilters"/>.</summary>
public static class ProjectEndpoints
{
    private static readonly TimeZoneInfo Istanbul = TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul");

    public record ProjectListItem(
        Guid Id, string DosyaNo, string? TdNo, ProjectStatus Status, string? BinaAdi, int? BeyanYukuKg, int? KatAdedi,
        DateTime CreatedAt, string? CompanyShortName, string AdaParsel, string SeriNo);

    public record ProjectStats(int Total, int ThisMonth, int Draft, int Delivered);

    public record ProjectEquipmentDto(
        Guid CategoryId, string Slot, Guid? BrandId, Guid? ModelId, Guid? CertificateId, string? SeriNo, JsonElement? SeriList);

    public record ProjectDetail(
        Guid Id, Guid CompanyId, string? CompanyShortName, Guid? CreatedBy, Guid? AssignedEngineer, string DosyaNo,
        DateOnly? DosyaTarihi, string? TdNo, ProjectStatus Status, ModuleType? CertificationModule, string? BinaAdi,
        string? MontajAdresi, short? ProvinceId, Guid? DistrictId, Guid? ElektrikMuhendisId, Guid? MakineMuhendisId,
        int? BeyanYukuKg, int? KisiSayisi, decimal? BeyanHizi, int? KatAdedi, int? DurakAdedi, int? ImalYili,
        JsonElement InputData, string? Notes, DateTime CreatedAt, DateTime UpdatedAt);

    public static void MapProjectEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/projects").RequireAuthorization();

        // Panel list: newest first. Only ada/parsel/seri no are taken from input_data, not the whole document.
        g.MapGet("/", async (Actor actor, AppDbContext db, ProjectStatus? status, int? limit, CancellationToken ct) =>
        {
            var q = db.Projects.AsNoTracking().VisibleTo(actor);
            if (status is not null) q = q.Where(p => p.Status == status);
            var rows = await q.OrderByDescending(p => p.CreatedAt).Take(Math.Clamp(limit ?? 100, 1, 500))
                .Select(p => new
                {
                    p.Id, p.DosyaNo, p.TdNo, p.Status, p.BinaAdi, p.BeyanYukuKg, p.KatAdedi, p.CreatedAt,
                    CompanyShortName = p.Company.ShortName, p.InputData,
                })
                .ToListAsync(ct);
            return rows.Select(p =>
            {
                var input = ReadInput(p.InputData);
                var adaParsel = string.Join(" / ", new[] { Text(input, "ada"), Text(input, "parsel") }.Where(s => s != ""));
                return new ProjectListItem(p.Id, p.DosyaNo, p.TdNo, p.Status, p.BinaAdi, p.BeyanYukuKg, p.KatAdedi,
                    p.CreatedAt, p.CompanyShortName, adaParsel, Text(input, "asansor_seri_no"));
            });
        });

        g.MapGet("/stats", async (Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var q = db.Projects.AsNoTracking().VisibleTo(actor);
            var monthStart = MonthStartUtc(DateTime.UtcNow);
            return new ProjectStats(
                await q.CountAsync(ct),
                await q.CountAsync(p => p.CreatedAt >= monthStart, ct),
                await q.CountAsync(p => p.Status == ProjectStatus.Draft, ct),
                await q.CountAsync(p => p.Status == ProjectStatus.Delivered, ct));
        });

        g.MapGet("/{id:guid}/render-context", RenderContextAsync);

        // Equipment rows for the edit wizard.
        g.MapGet("/{id:guid}/equipment", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (!await db.Projects.VisibleTo(actor).AnyAsync(p => p.Id == id, ct)) return Results.NotFound();
            var rows = await db.ProjectEquipments.AsNoTracking().Where(e => e.ProjectId == id)
                .Select(e => new { e.CategoryId, e.Slot, e.BrandId, e.ModelId, e.CertificateId, e.SeriNo, e.SeriList }).ToListAsync(ct);
            return Results.Ok(rows.Select(e => new ProjectEquipmentDto(e.CategoryId, e.Slot, e.BrandId, e.ModelId, e.CertificateId, e.SeriNo,
                e.SeriList is null ? null : ReadInput(e.SeriList))));
        });

        // Not visible and not existing look the same (404).
        g.MapGet("/{id:guid}", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var p = await db.Projects.AsNoTracking().VisibleTo(actor).Include(x => x.Company).SingleOrDefaultAsync(x => x.Id == id, ct);
            if (p is null) return Results.NotFound();
            return Results.Ok(new ProjectDetail(
                p.Id, p.CompanyId, p.Company.ShortName, p.CreatedBy, p.AssignedEngineer, p.DosyaNo, p.DosyaTarihi, p.TdNo,
                p.Status, p.CertificationModule, p.BinaAdi, p.MontajAdresi, p.ProvinceId, p.DistrictId, p.ElektrikMuhendisId,
                p.MakineMuhendisId, p.BeyanYukuKg, p.KisiSayisi, p.BeyanHizi, p.KatAdedi, p.DurakAdedi, p.ImalYili,
                ReadInput(p.InputData), p.Notes, p.CreatedAt, p.UpdatedAt));
        });
    }

    /// <summary>
    /// Data for the teknik dosya documents (public.project_render_context). KRR-011: in Supabase the
    /// function was SECURITY DEFINER and callable over RPC for any project id; here access is checked
    /// first and the function itself runs as SECURITY INVOKER (migration HardenDbFunctions).
    /// </summary>
    public static async Task<IResult> RenderContextAsync(Guid id, Actor actor, AppDbContext db, CancellationToken ct)
    {
        if (!await db.Projects.VisibleTo(actor).AnyAsync(p => p.Id == id, ct)) return Results.NotFound();
        var json = await db.Database
            .SqlQuery<string>($"SELECT public.project_render_context({id})::text AS \"Value\"")
            .SingleAsync(ct);
        return Results.Content(json, "application/json");
    }

    /// <summary>First instant of the current month in Turkey, as UTC.</summary>
    public static DateTime MonthStartUtc(DateTime utcNow)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(utcNow, Istanbul);
        return TimeZoneInfo.ConvertTimeToUtc(new DateTime(local.Year, local.Month, 1, 0, 0, 0, DateTimeKind.Unspecified), Istanbul);
    }

    private static JsonElement ReadInput(string json)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrEmpty(json) ? "{}" : json);
        return doc.RootElement.Clone();
    }

    // input_data values are user-entered; numbers and strings both occur.
    private static string Text(JsonElement input, string key) =>
        input.ValueKind == JsonValueKind.Object && input.TryGetProperty(key, out var v)
            ? v.ValueKind switch
            {
                JsonValueKind.String => v.GetString() ?? "",
                JsonValueKind.Number => v.GetRawText(),
                _ => "",
            }
            : "";
}
