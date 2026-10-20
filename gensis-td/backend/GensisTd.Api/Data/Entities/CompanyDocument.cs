using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class CompanyDocument
{
    public Guid Id { get; set; }

    public Guid CompanyId { get; set; }

    public string DocType { get; set; } = null!;

    public string? BelgeNo { get; set; }

    public string? StoragePath { get; set; }

    public string? OriginalName { get; set; }

    public DateOnly? IssueDate { get; set; }

    public DateOnly? ValidUntil { get; set; }

    public Guid? NotifiedBodyId { get; set; }

    public Guid? UploadedBy { get; set; }

    public DateTime UploadedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid? ParentId { get; set; }

    public string? SubType { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual ICollection<CompanyDocument> InverseParent { get; set; } = new List<CompanyDocument>();

    public virtual NotifiedBody? NotifiedBody { get; set; }

    public virtual CompanyDocument? Parent { get; set; }

    public virtual Profile? UploadedByNavigation { get; set; }
}
