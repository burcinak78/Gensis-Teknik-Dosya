using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class District
{
    public Guid Id { get; set; }

    public short ProvinceId { get; set; }

    public string Name { get; set; } = null!;

    public virtual ICollection<ProjeOnay> ProjeOnays { get; set; } = new List<ProjeOnay>();

    public virtual ICollection<Project> Projects { get; set; } = new List<Project>();

    public virtual Province Province { get; set; } = null!;
}
