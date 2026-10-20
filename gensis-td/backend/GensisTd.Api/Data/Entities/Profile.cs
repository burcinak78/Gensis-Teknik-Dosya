using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class Profile
{
    public Guid Id { get; set; }

    public string? FullName { get; set; }

    public Guid? CompanyId { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();

    public virtual ICollection<CertificateFile> CertificateFiles { get; set; } = new List<CertificateFile>();

    public virtual Company? Company { get; set; }

    public virtual ICollection<CompanyDocument> CompanyDocuments { get; set; } = new List<CompanyDocument>();

    public virtual ICollection<DocumentTemplate> DocumentTemplates { get; set; } = new List<DocumentTemplate>();

    public virtual ICollection<DownloadLink> DownloadLinks { get; set; } = new List<DownloadLink>();

    public virtual ICollection<EngineerDocument> EngineerDocuments { get; set; } = new List<EngineerDocument>();

    public virtual ICollection<GeneratedFile> GeneratedFiles { get; set; } = new List<GeneratedFile>();

    public virtual User IdNavigation { get; set; } = null!;

    public virtual ICollection<ProjeOnay> ProjeOnays { get; set; } = new List<ProjeOnay>();

    public virtual ICollection<Project> ProjectAssignedEngineerNavigations { get; set; } = new List<Project>();

    public virtual ICollection<Project> ProjectCreatedByNavigations { get; set; } = new List<Project>();

    public virtual ICollection<ProjectFile> ProjectFiles { get; set; } = new List<ProjectFile>();

    public virtual ICollection<TakipProjeler> TakipProjelerCreatedByNavigations { get; set; } = new List<TakipProjeler>();

    public virtual ICollection<TakipProjeler> TakipProjelerProjeSorumlusus { get; set; } = new List<TakipProjeler>();
}
