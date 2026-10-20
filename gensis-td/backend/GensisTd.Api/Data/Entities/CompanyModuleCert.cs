using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

/// <summary>
/// Firmanın modül bazlı CE belgeleri (B MR, B MRL, E, H).
/// </summary>
public partial class CompanyModuleCert
{
    public Guid Id { get; set; }

    public Guid CompanyId { get; set; }

    public string? BelgeNo { get; set; }

    public DateOnly? IssueDate { get; set; }

    public Guid? NotifiedBodyId { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual NotifiedBody? NotifiedBody { get; set; }
}
