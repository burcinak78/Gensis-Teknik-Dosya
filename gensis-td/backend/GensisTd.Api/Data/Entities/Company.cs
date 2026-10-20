using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

/// <summary>
/// Firma antetleri / montaj-mimarlık firmaları (Firma sayfası).
/// </summary>
public partial class Company
{
    public Guid Id { get; set; }

    public string ShortName { get; set; } = null!;

    public string LegalName { get; set; } = null!;

    public string? Address { get; set; }

    public string? Phone { get; set; }

    public string? Fax { get; set; }

    public string? City { get; set; }

    public string? AuthorizedPerson { get; set; }

    public string? RegisteredBrand { get; set; }

    public string? IndustryRegNo { get; set; }

    public DateOnly? IndustryRegDate { get; set; }

    public DateOnly? HybDate { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? MobilePhone { get; set; }

    public string? CeModule { get; set; }

    public string? Email { get; set; }

    public string Category { get; set; } = null!;

    public string? Sector { get; set; }

    public Guid? MontajFirmaId { get; set; }

    public virtual ICollection<CompanyDocument> CompanyDocuments { get; set; } = new List<CompanyDocument>();

    public virtual ICollection<CompanyModuleCert> CompanyModuleCerts { get; set; } = new List<CompanyModuleCert>();

    public virtual ICollection<Engineer> Engineers { get; set; } = new List<Engineer>();

    public virtual ICollection<Company> InverseMontajFirma { get; set; } = new List<Company>();

    public virtual Company? MontajFirma { get; set; }

    public virtual ICollection<Profile> Profiles { get; set; } = new List<Profile>();

    public virtual ICollection<ProjeOnay> ProjeOnays { get; set; } = new List<ProjeOnay>();

    public virtual ICollection<Project> Projects { get; set; } = new List<Project>();

    public virtual Subscription? Subscription { get; set; }

    public virtual ICollection<TakipProjeler> TakipProjelerCompanies { get; set; } = new List<TakipProjeler>();

    public virtual ICollection<TakipProjeler> TakipProjelerMontajFirmas { get; set; } = new List<TakipProjeler>();

    public virtual ICollection<UsageRecord> UsageRecords { get; set; } = new List<UsageRecord>();
}
