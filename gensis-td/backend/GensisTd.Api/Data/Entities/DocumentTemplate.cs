using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

/// <summary>
/// Her görünür belgenin sürümlenmiş şablonu.
/// </summary>
public partial class DocumentTemplate
{
    public Guid Id { get; set; }

    public string DocumentTypeCode { get; set; } = null!;

    public int Version { get; set; }

    public string? StoragePath { get; set; }

    public string? Body { get; set; }

    public bool IsCurrent { get; set; }

    public string? Notes { get; set; }

    public Guid? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Profile? CreatedByNavigation { get; set; }

    public virtual DocumentType DocumentTypeCodeNavigation { get; set; } = null!;

    public virtual ICollection<TemplateField> TemplateFields { get; set; } = new List<TemplateField>();
}
