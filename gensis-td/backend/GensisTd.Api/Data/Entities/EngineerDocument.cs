using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class EngineerDocument
{
    public Guid Id { get; set; }

    public Guid EngineerId { get; set; }

    public string DocType { get; set; } = null!;

    public string? StoragePath { get; set; }

    public string? OriginalName { get; set; }

    public DateOnly? ValidUntil { get; set; }

    public Guid? UploadedBy { get; set; }

    public DateTime UploadedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Engineer Engineer { get; set; } = null!;

    public virtual Profile? UploadedByNavigation { get; set; }
}
