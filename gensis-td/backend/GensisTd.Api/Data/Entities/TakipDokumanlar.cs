using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class TakipDokumanlar
{
    public Guid Id { get; set; }

    public Guid TakipId { get; set; }

    public string Kind { get; set; } = null!;

    public string StoragePath { get; set; } = null!;

    public string? OriginalName { get; set; }

    public Guid? UploadedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual TakipProjeler Takip { get; set; } = null!;
}
