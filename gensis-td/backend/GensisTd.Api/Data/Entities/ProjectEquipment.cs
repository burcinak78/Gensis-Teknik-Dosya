using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class ProjectEquipment
{
    public Guid Id { get; set; }

    public Guid ProjectId { get; set; }

    public Guid CategoryId { get; set; }

    public string Slot { get; set; } = null!;

    public Guid? BrandId { get; set; }

    public Guid? ModelId { get; set; }

    public Guid? CertificateId { get; set; }

    public DateTime CreatedAt { get; set; }

    public string? SeriNo { get; set; }

    public string? SeriList { get; set; }

    public virtual EquipmentBrand? Brand { get; set; }

    public virtual EquipmentCategory Category { get; set; } = null!;

    public virtual Certificate? Certificate { get; set; }

    public virtual EquipmentModel? Model { get; set; }

    public virtual Project Project { get; set; } = null!;
}
