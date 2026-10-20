using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class GeneratedFile
{
    public Guid Id { get; set; }

    public Guid ProjectId { get; set; }

    public string? DocumentCode { get; set; }

    public string StoragePath { get; set; } = null!;

    public long? FileSize { get; set; }

    public int? PageCount { get; set; }

    public int Version { get; set; }

    /// <summary>
    /// Üretim anındaki dondurulmuş referanslar — resmi belge sonradan değişmez.
    /// </summary>
    public string Snapshot { get; set; } = null!;

    public Guid? GeneratedBy { get; set; }

    public DateTime GeneratedAt { get; set; }

    public virtual DocumentType? DocumentCodeNavigation { get; set; }

    public virtual ICollection<DownloadLink> DownloadLinks { get; set; } = new List<DownloadLink>();

    public virtual Profile? GeneratedByNavigation { get; set; }

    public virtual Project Project { get; set; } = null!;
}
