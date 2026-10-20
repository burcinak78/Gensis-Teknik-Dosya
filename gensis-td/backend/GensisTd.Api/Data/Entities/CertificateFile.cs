using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class CertificateFile
{
    public Guid Id { get; set; }

    public Guid CertificateId { get; set; }

    public int Version { get; set; }

    public string StoragePath { get; set; } = null!;

    public string? OriginalName { get; set; }

    public bool IsCurrent { get; set; }

    public Guid? UploadedBy { get; set; }

    public DateTime UploadedAt { get; set; }

    public virtual Certificate Certificate { get; set; } = null!;

    public virtual Profile? UploadedByNavigation { get; set; }
}
