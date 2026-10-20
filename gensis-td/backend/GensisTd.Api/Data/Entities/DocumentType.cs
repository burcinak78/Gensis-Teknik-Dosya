using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

/// <summary>
/// Teknik dosyayı oluşturan görünür alt belgeler (1..17 görünür set).
/// </summary>
public partial class DocumentType
{
    public Guid Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual DocumentTemplate? DocumentTemplate { get; set; }

    public virtual ICollection<GeneratedFile> GeneratedFiles { get; set; } = new List<GeneratedFile>();
}
