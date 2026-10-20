using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class Plan
{
    public Guid Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public decimal? PriceMonthly { get; set; }

    public decimal? PriceYearly { get; set; }

    public int? QuotaPerPeriod { get; set; }

    public decimal? OveragePrice { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();
}
