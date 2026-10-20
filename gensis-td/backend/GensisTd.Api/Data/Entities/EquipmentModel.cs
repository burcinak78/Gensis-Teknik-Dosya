using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class EquipmentModel
{
    public Guid Id { get; set; }

    public Guid BrandId { get; set; }

    public string Name { get; set; } = null!;

    public Guid? CertificateId { get; set; }

    public string Specs { get; set; } = null!;

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual EquipmentBrand Brand { get; set; } = null!;

    public virtual Certificate? Certificate { get; set; }

    public virtual ICollection<ProjectEquipment> ProjectEquipments { get; set; } = new List<ProjectEquipment>();

    public virtual ICollection<Certificate> Certificates { get; set; } = new List<Certificate>();
}
