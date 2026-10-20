using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class IlgiliIdareler
{
    public Guid Id { get; set; }

    public string Name { get; set; } = null!;

    public string? Address { get; set; }

    public DateTime CreatedAt { get; set; }

    public short? ProvinceId { get; set; }

    public string Suffix { get; set; } = null!;

    public virtual ICollection<ProjeOnay> ProjeOnays { get; set; } = new List<ProjeOnay>();

    public virtual Province? Province { get; set; }
}
