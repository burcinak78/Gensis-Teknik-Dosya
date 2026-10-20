using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class Province
{
    public short Id { get; set; }

    public string Name { get; set; } = null!;

    public virtual ICollection<District> Districts { get; set; } = new List<District>();

    public virtual ICollection<IlgiliIdareler> IlgiliIdarelers { get; set; } = new List<IlgiliIdareler>();

    public virtual ICollection<ProjeOnay> ProjeOnays { get; set; } = new List<ProjeOnay>();

    public virtual ICollection<Project> Projects { get; set; } = new List<Project>();
}
