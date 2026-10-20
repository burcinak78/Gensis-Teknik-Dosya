using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class Subscription
{
    public Guid Id { get; set; }

    public Guid CompanyId { get; set; }

    public Guid PlanId { get; set; }

    public DateOnly CurrentPeriodStart { get; set; }

    public DateOnly? CurrentPeriodEnd { get; set; }

    public int? QuotaPerPeriod { get; set; }

    public int FilesUsed { get; set; }

    public bool IsInternal { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual Plan Plan { get; set; } = null!;

    public virtual ICollection<UsageRecord> UsageRecords { get; set; } = new List<UsageRecord>();
}
