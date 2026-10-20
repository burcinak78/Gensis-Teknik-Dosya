using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class ProjectFile
{
    public Guid Id { get; set; }

    public Guid ProjectId { get; set; }

    public string Kind { get; set; } = null!;

    public string StoragePath { get; set; } = null!;

    public string? OriginalName { get; set; }

    public string? BelgeNo { get; set; }

    public DateOnly? IssueDate { get; set; }

    public DateOnly? ValidUntil { get; set; }

    public Guid? NotifiedBodyId { get; set; }

    public DateOnly? ReportDate { get; set; }

    public string? FaturaNo { get; set; }

    public DateOnly? FaturaTarihi { get; set; }

    public string? ProjeNo { get; set; }

    public int SortOrder { get; set; }

    public Guid? UploadedBy { get; set; }

    public DateTime UploadedAt { get; set; }

    public virtual NotifiedBody? NotifiedBody { get; set; }

    public virtual Project Project { get; set; } = null!;

    public virtual Profile? UploadedByNavigation { get; set; }
}
