using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class DownloadLink
{
    public Guid Id { get; set; }

    public Guid GeneratedFileId { get; set; }

    public string Token { get; set; } = null!;

    public string? CreatedForEmail { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public int? MaxDownloads { get; set; }

    public int DownloadCount { get; set; }

    public bool IsRevoked { get; set; }

    public Guid? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Profile? CreatedByNavigation { get; set; }

    public virtual GeneratedFile GeneratedFile { get; set; } = null!;
}
