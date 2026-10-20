using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class Engineer
{
    public Guid Id { get; set; }

    public string FullName { get; set; } = null!;

    public string? Title { get; set; }

    public string? ChamberRegNo { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid? CompanyId { get; set; }

    public string? Address { get; set; }

    public string? Phone { get; set; }

    public virtual Company? Company { get; set; }

    public virtual ICollection<EngineerDocument> EngineerDocuments { get; set; } = new List<EngineerDocument>();

    public virtual ICollection<ProjeOnay> ProjeOnayElektrikMuhendis { get; set; } = new List<ProjeOnay>();

    public virtual ICollection<ProjeOnay> ProjeOnayMakineMuhendis { get; set; } = new List<ProjeOnay>();

    public virtual ICollection<Project> ProjectElektrikMuhendis { get; set; } = new List<Project>();

    public virtual ICollection<Project> ProjectMakineMuhendis { get; set; } = new List<Project>();
}
