using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

/// <summary>
/// Her belge alanının veri kaynağı eşlemesi (Excel referanslarının DB karşılığı).
/// </summary>
public partial class TemplateField
{
    public Guid Id { get; set; }

    public Guid TemplateId { get; set; }

    public string FieldKey { get; set; } = null!;

    public string? Label { get; set; }

    public string? SourceKey { get; set; }

    public string Config { get; set; } = null!;

    public string? FormatPattern { get; set; }

    public string? DefaultValue { get; set; }

    public bool IsRequired { get; set; }

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual DocumentTemplate Template { get; set; } = null!;
}
