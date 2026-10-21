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
    public record NotifiedBodyDto(Guid Id, string? IdentityNo, string Name, string? ShortName, string? Address, string? City, string? Country);
    public record IlgiliIdareDto(Guid Id, string Name, short? ProvinceId, string Suffix, string? Address);
    public record IlgiliIdareInput(string? Name, string? Address, short? ProvinceId, string? Suffix);
    public record CapacityDto(int BeyanYukuKg, int? KisiSayisi, int? KabinAgirlikKg, int? KarsiAgirlikKg);
    public record LookupDto(string ListKey, string Value, int SortOrder, bool IsActive);
    public record CompanyDocumentDto(
        Guid Id, Guid CompanyId, string DocType, string? SubType, Guid? ParentId, string? BelgeNo, DateOnly? IssueDate,
        DateOnly? ValidUntil, Guid? NotifiedBodyId, string? OriginalName, bool HasFile);
    public record EngineerDocumentDto(Guid Id, Guid EngineerId, string DocType, DateOnly? ValidUntil);
    public record DistrictDto(Guid Id, string Name);

    public record CategoryDto(Guid Id, string Code, string Name, int SortOrder, string DriveType);
    public record BrandDto(Guid Id, Guid CategoryId, string Name);
    public record ModelDto(Guid Id, Guid BrandId, string Name, Guid? CertificateId);
    public record ModelCertificateDto(Guid ModelId, Guid CertificateId);
    public record EquipmentCatalogDto(
        List<CategoryDto> Categories, List<BrandDto> Brands, List<ModelDto> Models, List<ModelCertificateDto> ModelCertificates);

    public record CertificateDto(
        Guid Id, string CertNo, Guid? NotifiedBodyId, DateOnly? IssueDate, DateOnly? ValidUntil,
        string? BelgeTipi, Guid? CategoryId, string? FirmaAdi, string? CurrentFileName);

    public static void MapCatalogEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/catalog").RequireAuthorization();

        g.MapGet("/companies", (Actor actor, AppDbContext db, CancellationToken ct) =>
            db.Companies.AsNoTracking().ReadableBy(actor).OrderBy(c => EF.Functions.Collate(c.ShortName, Collations.Turkish))
                .Select(ToCompanyDto).ToListAsync(ct));

        // Another company's id answers 404, same as a missing one.
        g.MapGet("/companies/{id:guid}", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
            await db.Companies.AsNoTracking().ReadableBy(actor).Where(c => c.Id == id).Select(ToCompanyDto).SingleOrDefaultAsync(ct)
                is { } company ? Results.Ok(company) : Results.NotFound());

        g.MapGet("/companies/names", (AppDbContext db, CancellationToken ct) =>
            db.Companies.AsNoTracking().OrderBy(c => EF.Functions.Collate(c.ShortName, Collations.Turkish))
                .Select(c => new CompanyNameDto(c.Id, c.ShortName, c.LegalName, c.City, c.Category)).ToListAsync(ct))
            .RequireAuthorization(Policies.Office);

        g.MapGet("/engineers", async (Actor actor, AppDbContext db, GensisCompany gensis, CancellationToken ct) =>
        {
            var gensisId = gensis.Id;
            var engineers = await db.Engineers.AsNoTracking().ReadableBy(actor, gensisId)
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

        g.MapGet("/notified-bodies", (AppDbContext db, CancellationToken ct) =>
            db.NotifiedBodies.AsNoTracking().OrderBy(n => EF.Functions.Collate(n.Name, Collations.Turkish))
                .Select(n => new NotifiedBodyDto(n.Id, n.IdentityNo, n.Name, n.ShortName, n.Address, n.City, n.Country)).ToListAsync(ct));

        g.MapGet("/ilgili-idareler", (AppDbContext db, CancellationToken ct) =>
            db.IlgiliIdarelers.AsNoTracking().OrderBy(i => EF.Functions.Collate(i.Name, Collations.Turkish))
                .Select(i => new IlgiliIdareDto(i.Id, i.Name, i.ProvinceId, i.Suffix, i.Address)).ToListAsync(ct));

        // New ilgili idare from the proje onay wizard (admin/actions.ts createIlgiliIdare): staff only.
        g.MapPost("/ilgili-idareler", async (IlgiliIdareInput input, AppDbContext db, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(input.Name))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["İlgili idare adı zorunlu."] });
            if (input.ProvinceId is { } pid && !await db.Provinces.AnyAsync(p => p.Id == pid, ct))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["provinceId"] = ["İl bulunamadı."] });
            var idare = new Data.Entities.IlgiliIdareler
            {
                Id = Guid.NewGuid(), Name = input.Name.Trim(), Address = string.IsNullOrWhiteSpace(input.Address) ? null : input.Address.Trim(),
                ProvinceId = input.ProvinceId, Suffix = string.IsNullOrWhiteSpace(input.Suffix) ? "belediye" : input.Suffix.Trim(),
            };
            db.IlgiliIdarelers.Add(idare);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/catalog/ilgili-idareler/{idare.Id}", new { idare.Id });
        }).RequireAuthorization(Policies.Staff);

        g.MapGet("/capacity", (AppDbContext db, CancellationToken ct) =>
            db.CapacityTables.AsNoTracking().OrderBy(c => c.BeyanYukuKg)
                .Select(c => new CapacityDto(c.BeyanYukuKg, c.KisiSayisi, c.KabinAgirlikKg, c.KarsiAgirlikKg)).ToListAsync(ct));

        g.MapGet("/lookups", (AppDbContext db, CancellationToken ct) =>
            db.LookupValues.AsNoTracking().OrderBy(l => l.ListKey).ThenBy(l => l.SortOrder)
                .Select(l => new LookupDto(l.ListKey, l.Value, l.SortOrder, l.IsActive)).ToListAsync(ct));

        // Company documents (p_company_docs_read): staff all, others their own company's. Metadata only; the file opens via /api/files/company/{id}.
        g.MapGet("/company-documents", (Actor actor, AppDbContext db, CancellationToken ct) =>
            db.CompanyDocuments.AsNoTracking().VisibleTo(actor)
                .Select(d => new CompanyDocumentDto(d.Id, d.CompanyId, d.DocType, d.SubType, d.ParentId, d.BelgeNo, d.IssueDate,
                    d.ValidUntil, d.NotifiedBodyId, d.OriginalName, d.StoragePath != null)).ToListAsync(ct));

        // Engineer documents (p_eng_docs_read): staff only, as in Supabase; customers get an empty list.
        g.MapGet("/engineer-documents", (Actor actor, AppDbContext db, CancellationToken ct) =>
            db.EngineerDocuments.AsNoTracking().VisibleTo(actor)
                .Select(d => new EngineerDocumentDto(d.Id, d.EngineerId, d.DocType, d.ValidUntil)).ToListAsync(ct));

        g.MapGet("/certificates", (AppDbContext db, CancellationToken ct) =>
            db.Certificates.AsNoTracking().OrderBy(c => c.CertNo)
                .Select(c => new CertificateDto(c.Id, c.CertNo, c.NotifiedBodyId, c.IssueDate, c.ValidUntil, c.BelgeTipi, c.CategoryId, c.FirmaAdi,
                    db.CertificateFiles.Where(f => f.CertificateId == c.Id && f.IsCurrent).Select(f => f.OriginalName).FirstOrDefault()))
                .ToListAsync(ct));
    }

    private static readonly System.Linq.Expressions.Expression<Func<Data.Entities.Company, CompanyDto>> ToCompanyDto = c => new CompanyDto(
        c.Id, c.ShortName, c.LegalName, c.Address, c.Phone, c.Fax, c.MobilePhone, c.Email, c.City, c.AuthorizedPerson,
        c.RegisteredBrand, c.IndustryRegNo, c.IndustryRegDate, c.HybDate, c.CeModule, c.Category, c.Sector, c.IsActive);
}
