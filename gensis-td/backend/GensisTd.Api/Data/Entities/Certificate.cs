using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

/// <summary>
/// Ürün sertifikaları (baş kayıt). PDF dosyaları certificate_files&apos;ta sürümlenir.
/// </summary>
public partial class Certificate
{
    public Guid Id { get; set; }

    public string CertNo { get; set; } = null!;

    public Guid? NotifiedBodyId { get; set; }

    public string? NotifiedBodyRaw { get; set; }

    public DateOnly? ValidUntil { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public DateOnly? IssueDate { get; set; }

    public string? BelgeTipi { get; set; }

    public Guid? CategoryId { get; set; }

    public string? FirmaAdi { get; set; }

    public virtual EquipmentCategory? Category { get; set; }

    public virtual CertificateFile? CertificateFile { get; set; }

    public virtual ICollection<EquipmentModel> EquipmentModels { get; set; } = new List<EquipmentModel>();

    public virtual NotifiedBody? NotifiedBody { get; set; }

    public virtual ICollection<ProjectEquipment> ProjectEquipments { get; set; } = new List<ProjectEquipment>();

    public virtual ICollection<EquipmentModel> Models { get; set; } = new List<EquipmentModel>();
}
