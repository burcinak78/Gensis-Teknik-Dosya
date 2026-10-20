using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class EquipmentBrand
{
    public Guid Id { get; set; }

    public Guid CategoryId { get; set; }

    public string Name { get; set; } = null!;

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual EquipmentCategory Category { get; set; } = null!;

    public virtual ICollection<EquipmentModel> EquipmentModels { get; set; } = new List<EquipmentModel>();

    public virtual ICollection<ProjectEquipment> ProjectEquipments { get; set; } = new List<ProjectEquipment>();
}
