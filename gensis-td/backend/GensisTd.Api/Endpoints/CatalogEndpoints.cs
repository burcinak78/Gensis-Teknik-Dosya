using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Read-only reference data. Supabase allowed every signed-in user to read these tables
/// (p_*_read: auth.role() = 'authenticated'). Companies and engineers are narrowed with
/// AccessFilters (KRR-014); the rest is shared reference data with no row filter.
/// </summary>
public static class CatalogEndpoints
{
    public record CompanyDto(
        Guid Id, string ShortName, string LegalName, string? Address, string? Phone, string? Fax, string? MobilePhone,
        string? Email, string? City, string? AuthorizedPerson, string? RegisteredBrand, string? IndustryRegNo,
        DateOnly? IndustryRegDate, DateOnly? HybDate, string? CeModule, string Category, string? Sector, bool IsActive);

    // Office screens (proje takip, muhasebe) list every company by name; no contact data.
    public record CompanyNameDto(Guid Id, string ShortName, string LegalName, string? City, string Category);

    public record EngineerDto(Guid Id, string FullName, EngineerDiscipline Discipline, string? ChamberRegNo, Guid? CompanyId);
    public record EngineersDto(Guid? GensisCompanyId, List<EngineerDto> Engineers);

    public record ProvinceDto(short Id, string Name);
    public record DistrictDto(Guid Id, string Name);

    public record CategoryDto(Guid Id, string Code, string Name, int SortOrder, string DriveType);
    public record BrandDto(Guid Id, Guid CategoryId, string Name);
    public record ModelDto(Guid Id, Guid BrandId, string Name, Guid? CertificateId);
    public record ModelCertificateDto(Guid ModelId, Guid CertificateId);
    public record EquipmentCatalogDto(
        List<CategoryDto> Categories, List<BrandDto> Brands, List<ModelDto> Models, List<ModelCertificateDto> ModelCertificates);

    public record CertificateDto(
        Guid Id, string CertNo, Guid? NotifiedBodyId, DateOnly? IssueDate, DateOnly? ValidUntil,
        string? BelgeTipi, Guid? CategoryId, string? FirmaAdi);

    public static void MapCatalogEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/catalog").RequireAuthorization();

        g.MapGet("/companies", (Actor actor, AppDbContext db, CancellationToken ct) =>
            db.Companies.AsNoTracking().VisibleTo(actor).OrderBy(c => EF.Functions.Collate(c.ShortName, Collations.Turkish))
                .Select(ToCompanyDto).ToListAsync(ct));

        // Another company's id answers 404, same as a missing one.
        g.MapGet("/companies/{id:guid}", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
            await db.Companies.AsNoTracking().VisibleTo(actor).Where(c => c.Id == id).Select(ToCompanyDto).SingleOrDefaultAsync(ct)
                is { } company ? Results.Ok(company) : Results.NotFound());

        g.MapGet("/companies/names", (AppDbContext db, CancellationToken ct) =>
            db.Companies.AsNoTracking().OrderBy(c => EF.Functions.Collate(c.ShortName, Collations.Turkish))
                .Select(c => new CompanyNameDto(c.Id, c.ShortName, c.LegalName, c.City, c.Category)).ToListAsync(ct))
            .RequireAuthorization(Policies.Office);

        g.MapGet("/engineers", async (Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            var gensisId = await GensisCompanyIdAsync(db, ct);
            var engineers = await db.Engineers.AsNoTracking().VisibleTo(actor, gensisId)
                .OrderBy(e => EF.Functions.Collate(e.FullName, Collations.Turkish))
                .Select(e => new EngineerDto(e.Id, e.FullName, e.Discipline, e.ChamberRegNo, e.CompanyId)).ToListAsync(ct);
            return new EngineersDto(gensisId, engineers);
        });

        g.MapGet("/provinces", (AppDbContext db, CancellationToken ct) =>
            db.Provinces.AsNoTracking().OrderBy(p => EF.Functions.Collate(p.Name, Collations.Turkish)).Select(p => new ProvinceDto(p.Id, p.Name)).ToListAsync(ct));

        g.MapGet("/provinces/{id:int}/districts", (short id, AppDbContext db, CancellationToken ct) =>
            db.Districts.AsNoTracking().Where(d => d.ProvinceId == id).OrderBy(d => EF.Functions.Collate(d.Name, Collations.Turkish))
                .Select(d => new DistrictDto(d.Id, d.Name)).ToListAsync(ct));

        // Everything the equipment pickers need in one round trip (categories → brands → models).
        g.MapGet("/equipment", async (AppDbContext db, CancellationToken ct) => new EquipmentCatalogDto(
            await db.EquipmentCategories.AsNoTracking().OrderBy(c => c.SortOrder)
                .Select(c => new CategoryDto(c.Id, c.Code, c.Name, c.SortOrder, c.DriveType)).ToListAsync(ct),
            await db.EquipmentBrands.AsNoTracking().OrderBy(b => EF.Functions.Collate(b.Name, Collations.Turkish))
                .Select(b => new BrandDto(b.Id, b.CategoryId, b.Name)).ToListAsync(ct),
            await db.EquipmentModels.AsNoTracking().OrderBy(m => EF.Functions.Collate(m.Name, Collations.Turkish))
                .Select(m => new ModelDto(m.Id, m.BrandId, m.Name, m.CertificateId)).ToListAsync(ct),
            await db.EquipmentModels.AsNoTracking()
                .SelectMany(m => m.Certificates.Select(c => new ModelCertificateDto(m.Id, c.Id))).ToListAsync(ct)));

        g.MapGet("/certificates", (AppDbContext db, CancellationToken ct) =>
            db.Certificates.AsNoTracking().OrderBy(c => c.CertNo)
                .Select(c => new CertificateDto(c.Id, c.CertNo, c.NotifiedBodyId, c.IssueDate, c.ValidUntil, c.BelgeTipi, c.CategoryId, c.FirmaAdi))
                .ToListAsync(ct));
    }

    // Gensis's own company record, found by name as the frontend does (first match in name order).
    public static Task<Guid?> GensisCompanyIdAsync(AppDbContext db, CancellationToken ct) =>
        db.Companies.AsNoTracking().Where(c => EF.Functions.ILike(c.ShortName, "%gensis%"))
            .OrderBy(c => EF.Functions.Collate(c.ShortName, Collations.Turkish)).Select(c => (Guid?)c.Id).FirstOrDefaultAsync(ct);

    private static readonly System.Linq.Expressions.Expression<Func<Data.Entities.Company, CompanyDto>> ToCompanyDto = c => new CompanyDto(
        c.Id, c.ShortName, c.LegalName, c.Address, c.Phone, c.Fax, c.MobilePhone, c.Email, c.City, c.AuthorizedPerson,
        c.RegisteredBrand, c.IndustryRegNo, c.IndustryRegDate, c.HybDate, c.CeModule, c.Category, c.Sector, c.IsActive);
}
