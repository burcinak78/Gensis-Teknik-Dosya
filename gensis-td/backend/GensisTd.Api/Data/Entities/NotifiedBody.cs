using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

/// <summary>
/// CE onaylanmış kuruluşlar (Diğer Bilgiler sayfası).
/// </summary>
public partial class NotifiedBody
{
    public Guid Id { get; set; }

    public string? IdentityNo { get; set; }

    public string Name { get; set; } = null!;

    public string? Address { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? ShortName { get; set; }

    public string? City { get; set; }

    public string? Country { get; set; }

    public virtual ICollection<Certificate> Certificates { get; set; } = new List<Certificate>();

    public virtual ICollection<CompanyDocument> CompanyDocuments { get; set; } = new List<CompanyDocument>();

    public virtual ICollection<CompanyModuleCert> CompanyModuleCerts { get; set; } = new List<CompanyModuleCert>();

    public virtual ICollection<ProjectFile> ProjectFiles { get; set; } = new List<ProjectFile>();
}
