using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class UsageRecord
{
    public Guid Id { get; set; }

    public Guid? SubscriptionId { get; set; }

    public Guid CompanyId { get; set; }

    public Guid? ProjectId { get; set; }

    public int Quantity { get; set; }

    public bool IsOverage { get; set; }

    public DateTime OccurredAt { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual Project? Project { get; set; }

    public virtual Subscription? Subscription { get; set; }
}
