using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class EmailLog
{
    public long Id { get; set; }

    public string ToEmail { get; set; } = null!;

    public string? Template { get; set; }

    public Guid? ProjectId { get; set; }

    public string? ProviderId { get; set; }

    public string? Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual Project? Project { get; set; }
}
