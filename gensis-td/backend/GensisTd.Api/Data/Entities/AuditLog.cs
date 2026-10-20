using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class AuditLog
{
    public long Id { get; set; }

    public Guid? ActorId { get; set; }

    public string Action { get; set; } = null!;

    public string? EntityType { get; set; }

    public Guid? EntityId { get; set; }

    public string Metadata { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual Profile? Actor { get; set; }
}
