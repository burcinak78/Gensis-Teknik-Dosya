using System.Text.Json;
using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Projects;
using GensisTd.Api.Storage;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Proje onay (avan proje dilekçesi) files: list, detail for the pages and PDFs, create and update
/// (proje-onay/yeni/actions.ts). Access as RLS p_proje_onay_*: staff all, customers their own company.
/// </summary>
public static class ProjeOnayEndpoints
{
    public record ProjeOnayInput(
        Guid CompanyId, string? DosyaNo, DateOnly? DilekceTarihi, short? ProvinceId, Guid? DistrictId, int? AsansorAdedi,
        string? YapiSahibi, string? MontajAdresi, string? Pafta, string? Ada, string? Parsel, int? BeyanYukuKg, int? KisiSayisi,
        decimal? BeyanHizi, int? DurakSayisi, Guid? MakineMuhendisId, Guid? ElektrikMuhendisId, Guid? IlgiliIdareId,
        JsonElement? InputData);

    public record ListItem(
        Guid Id, string? DosyaNo, string Status, string? YapiSahibi, int? BeyanYukuKg, int? DurakSayisi, DateOnly? DilekceTarihi,
        DateTime CreatedAt, JsonElement InputData, string? CompanyShortName);

    public record CompanyPart(string ShortName, string LegalName, string? Address, string? City, string? Phone, string? MobilePhone, string? Email);
    public record EngineerPart(string FullName, string? ChamberRegNo, string? Address, string? Phone);
    public record Detail(
        Guid Id, Guid CompanyId, string Status, string? DosyaNo, DateOnly? DilekceTarihi, short? ProvinceId, Guid? DistrictId,
        int? AsansorAdedi, string? YapiSahibi, string? MontajAdresi, string? Pafta, string? Ada, string? Parsel, int? BeyanYukuKg,
        int? KisiSayisi, decimal? BeyanHizi, int? DurakSayisi, Guid? MakineMuhendisId, Guid? ElektrikMuhendisId, Guid? IlgiliIdareId,
        JsonElement InputData, DateTime CreatedAt, DateTime UpdatedAt, CompanyPart Company, string? ProvinceName, string? DistrictName,
        EngineerPart? Makine, EngineerPart? Elektrik);

    public static readonly string[] FileKinds = ["imza_makine", "imza_elektrik", "logo"];

    public static void MapProjeOnayEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/proje-onay").RequireAuthorization();

        g.MapGet("/", async (Actor actor, AppDbContext db, int? limit, CancellationToken ct) =>
        {
            var rows = await db.ProjeOnays.AsNoTracking().VisibleTo(actor).OrderByDescending(r => r.CreatedAt)
                .Take(Math.Clamp(limit ?? 300, 1, 1000))
                .Select(r => new { r.Id, r.DosyaNo, r.Status, r.YapiSahibi, r.BeyanYukuKg, r.DurakSayisi, r.DilekceTarihi, r.CreatedAt, r.InputData, r.Company.ShortName })
                .ToListAsync(ct);
            return rows.Select(r => new ListItem(r.Id, r.DosyaNo, r.Status, r.YapiSahibi, r.BeyanYukuKg, r.DurakSayisi, r.DilekceTarihi,
                r.CreatedAt, Parse(r.InputData), r.ShortName));
        });

        g.MapGet("/{id:guid}", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var r = await db.ProjeOnays.AsNoTracking().VisibleTo(actor).Where(x => x.Id == id)
                .Select(x => new
                {
                    Row = x,
                    Company = new CompanyPart(x.Company.ShortName, x.Company.LegalName, x.Company.Address, x.Company.City, x.Company.Phone,
                        x.Company.MobilePhone, x.Company.Email),
                    ProvinceName = x.Province != null ? x.Province.Name : null,
                    DistrictName = x.District != null ? x.District.Name : null,
                    Makine = x.MakineMuhendis != null
                        ? new EngineerPart(x.MakineMuhendis.FullName, x.MakineMuhendis.ChamberRegNo, x.MakineMuhendis.Address, x.MakineMuhendis.Phone) : null,
                    Elektrik = x.ElektrikMuhendis != null
                        ? new EngineerPart(x.ElektrikMuhendis.FullName, x.ElektrikMuhendis.ChamberRegNo, x.ElektrikMuhendis.Address, x.ElektrikMuhendis.Phone) : null,
                })
                .SingleOrDefaultAsync(ct);
            if (r is null) return Results.NotFound();
            var x = r.Row;
            return Results.Ok(new Detail(x.Id, x.CompanyId, x.Status, x.DosyaNo, x.DilekceTarihi, x.ProvinceId, x.DistrictId, x.AsansorAdedi,
                x.YapiSahibi, x.MontajAdresi, x.Pafta, x.Ada, x.Parsel, x.BeyanYukuKg, x.KisiSayisi, x.BeyanHizi, x.DurakSayisi,
                x.MakineMuhendisId, x.ElektrikMuhendisId, x.IlgiliIdareId, Parse(x.InputData), x.CreatedAt, x.UpdatedAt, r.Company,
                r.ProvinceName, r.DistrictName, r.Makine, r.Elektrik));
        });

        g.MapPost("/", async (ProjeOnayInput input, Actor actor, AppDbContext db, GensisCompany gensis, CancellationToken ct) =>
        {
            if (await ValidateAsync(input, actor, db, gensis, ct) is { } invalid) return invalid;
            var row = new ProjeOnay { Id = Guid.NewGuid(), CreatedBy = actor.UserId, Status = "draft" };
            Apply(row, input);
            db.ProjeOnays.Add(row);
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            return Results.Created($"/api/proje-onay/{row.Id}", new { row.Id });
        });

        g.MapPut("/{id:guid}", async (Guid id, ProjeOnayInput input, Actor actor, AppDbContext db, GensisCompany gensis, CancellationToken ct) =>
        {
            var row = await db.ProjeOnays.VisibleTo(actor).SingleOrDefaultAsync(r => r.Id == id, ct);
            if (row is null) return Results.NotFound();
            if (await ValidateAsync(input, actor, db, gensis, ct) is { } invalid) return invalid;
            Apply(row, input);
            row.UpdatedAt = DateTime.UtcNow;
            if (await ProjectWriteEndpoints.SaveAsync(db, ct) is { } failed) return failed;
            return Results.Ok(new { row.Id });
        });

        // Signature and logo for the PDF. The path comes from the record itself, never from the client;
        // like pdf-source/file it is a nosniff download (KRR-020).
        g.MapGet("/{id:guid}/file", async (Guid id, string? kind, Actor actor, AppDbContext db, StorageService storage, HttpContext http,
            CancellationToken ct) =>
        {
            if (kind is null || !FileKinds.Contains(kind)) return Results.NotFound();
            var r = await db.ProjeOnays.AsNoTracking().VisibleTo(actor).Where(x => x.Id == id)
                .Select(x => new { x.CompanyId, x.MakineMuhendisId, x.ElektrikMuhendisId }).SingleOrDefaultAsync(ct);
            if (r is null) return Results.NotFound();
            var engineerId = kind == "imza_makine" ? r.MakineMuhendisId : kind == "imza_elektrik" ? r.ElektrikMuhendisId : null;
            var path = kind == "logo"
                ? await db.CompanyDocuments.Where(d => d.CompanyId == r.CompanyId && d.DocType == "logo" && d.StoragePath != null)
                    .OrderByDescending(d => d.UploadedAt).Select(d => d.StoragePath).FirstOrDefaultAsync(ct)
                : engineerId is { } eid
                    ? await db.EngineerDocuments.Where(d => d.EngineerId == eid && d.DocType == "imza").Select(d => d.StoragePath).FirstOrDefaultAsync(ct)
                    : null;
            if (path is null) return Results.NotFound();
            var obj = await storage.OpenReadAsync(FileEndpoints.DocumentsBucket, path, ct);
            if (obj is not { } o) return Results.NotFound();
            http.Response.Headers.XContentTypeOptions = "nosniff";
            return Results.Stream(o.Body, "application/octet-stream", Path.GetFileName(path));
        });
    }

    private static async Task<IResult?> ValidateAsync(ProjeOnayInput input, Actor actor, AppDbContext db, GensisCompany gensis, CancellationToken ct)
    {
        if (input.CompanyId == Guid.Empty)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["companyId"] = ["Firma seçilmedi."] });
        if (input.InputData is { ValueKind: not (JsonValueKind.Object or JsonValueKind.Null or JsonValueKind.Undefined) })
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["inputData"] = ["inputData bir JSON nesnesi olmalı."] });
        // RLS: staff, or a member of the file's company (also when moving it to another company).
        if (!actor.CanAccessCompany(input.CompanyId)) return Results.Forbid();
        return await EngineerRule.ValidateAsync(db, input.CompanyId, input.MakineMuhendisId, input.ElektrikMuhendisId, gensis.Id, ct);
    }

    private static void Apply(ProjeOnay r, ProjeOnayInput i)
    {
        r.CompanyId = i.CompanyId;
        r.DosyaNo = Clean(i.DosyaNo);
        r.DilekceTarihi = i.DilekceTarihi;
        r.ProvinceId = i.ProvinceId;
        r.DistrictId = i.DistrictId;
        r.AsansorAdedi = i.AsansorAdedi;
        r.YapiSahibi = Clean(i.YapiSahibi);
        r.MontajAdresi = Clean(i.MontajAdresi);
        r.Pafta = Clean(i.Pafta);
        r.Ada = Clean(i.Ada);
        r.Parsel = Clean(i.Parsel);
        r.BeyanYukuKg = i.BeyanYukuKg;
        r.KisiSayisi = i.KisiSayisi;
        r.BeyanHizi = i.BeyanHizi;
        r.DurakSayisi = i.DurakSayisi;
        r.MakineMuhendisId = i.MakineMuhendisId;
        r.ElektrikMuhendisId = i.ElektrikMuhendisId;
        r.IlgiliIdareId = i.IlgiliIdareId;
        r.InputData = i.InputData is { ValueKind: JsonValueKind.Object } d ? d.GetRawText() : "{}";
    }

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static JsonElement Parse(string? json)
    {
        using var doc = JsonDocument.Parse(string.IsNullOrEmpty(json) ? "{}" : json);
        return doc.RootElement.Clone();
    }
}
