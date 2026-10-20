using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

/// <summary>
/// Teknik dosya projesi — input_data = Veri Girişi anlık görüntüsü.
/// </summary>
public partial class Project
{
    public Guid Id { get; set; }

    public Guid CompanyId { get; set; }

    public Guid? CreatedBy { get; set; }

    public Guid? AssignedEngineer { get; set; }

    public string DosyaNo { get; set; } = null!;

    public DateOnly? DosyaTarihi { get; set; }

    public string? BinaAdi { get; set; }

    public string? MontajAdresi { get; set; }

    public short? ProvinceId { get; set; }

    public Guid? DistrictId { get; set; }

    public Guid? ElektrikMuhendisId { get; set; }

    public Guid? MakineMuhendisId { get; set; }

    public int? BeyanYukuKg { get; set; }

    public int? KisiSayisi { get; set; }

    public decimal? BeyanHizi { get; set; }

    public int? KatAdedi { get; set; }

    public int? DurakAdedi { get; set; }

    public int? ImalYili { get; set; }

    public string InputData { get; set; } = null!;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? TdNo { get; set; }

    public virtual Profile? AssignedEngineerNavigation { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual Profile? CreatedByNavigation { get; set; }

    public virtual District? District { get; set; }

    public virtual Engineer? ElektrikMuhendis { get; set; }

    public virtual ICollection<EmailLog> EmailLogs { get; set; } = new List<EmailLog>();

    public virtual ICollection<GeneratedFile> GeneratedFiles { get; set; } = new List<GeneratedFile>();

    public virtual Engineer? MakineMuhendis { get; set; }

    public virtual ICollection<ProjectEquipment> ProjectEquipments { get; set; } = new List<ProjectEquipment>();

    public virtual ICollection<ProjectFile> ProjectFiles { get; set; } = new List<ProjectFile>();

    public virtual Province? Province { get; set; }

    public virtual ICollection<UsageRecord> UsageRecords { get; set; } = new List<UsageRecord>();
}
