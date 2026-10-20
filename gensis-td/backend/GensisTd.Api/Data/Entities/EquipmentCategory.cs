using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class EquipmentCategory
{
    public Guid Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public int SortOrder { get; set; }

    public DateTime CreatedAt { get; set; }

    public string DriveType { get; set; } = null!;

    public virtual ICollection<Certificate> Certificates { get; set; } = new List<Certificate>();

    public virtual ICollection<EquipmentBrand> EquipmentBrands { get; set; } = new List<EquipmentBrand>();

    public virtual ICollection<ProjectEquipment> ProjectEquipments { get; set; } = new List<ProjectEquipment>();
}
