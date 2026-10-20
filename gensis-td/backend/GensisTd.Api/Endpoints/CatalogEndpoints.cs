using GensisTd.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// Read-only reference data. Supabase allowed every signed-in user to read these tables
/// (p_*_read: auth.role() = 'authenticated'), so there is no row filter here.
/// </summary>
public static class CatalogEndpoints
{
    public record CompanyDto(
        Guid Id, string ShortName, string LegalName, string? Address, string? Phone, string? Fax, string? MobilePhone,
        string? Email, string? City, string? AuthorizedPerson, string? RegisteredBrand, string? IndustryRegNo,
        DateOnly? IndustryRegDate, DateOnly? HybDate, string? CeModule, string Category, string? Sector, bool IsActive);

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

        g.MapGet("/companies", (AppDbContext db, CancellationToken ct) =>
            db.Companies.AsNoTracking().OrderBy(c => EF.Functions.Collate(c.ShortName, Collations.Turkish)).Select(ToCompanyDto).ToListAsync(ct));

        g.MapGet("/companies/{id:guid}", async (Guid id, AppDbContext db, CancellationToken ct) =>
            await db.Companies.AsNoTracking().Where(c => c.Id == id).Select(ToCompanyDto).SingleOrDefaultAsync(ct)
                is { } company ? Results.Ok(company) : Results.NotFound());

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

    private static readonly System.Linq.Expressions.Expression<Func<Data.Entities.Company, CompanyDto>> ToCompanyDto = c => new CompanyDto(
        c.Id, c.ShortName, c.LegalName, c.Address, c.Phone, c.Fax, c.MobilePhone, c.Email, c.City, c.AuthorizedPerson,
        c.RegisteredBrand, c.IndustryRegNo, c.IndustryRegDate, c.HybDate, c.CeModule, c.Category, c.Sector, c.IsActive);
}
