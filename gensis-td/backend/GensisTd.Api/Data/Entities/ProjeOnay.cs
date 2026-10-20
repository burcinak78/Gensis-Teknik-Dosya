using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class ProjeOnay
{
    public Guid Id { get; set; }

    public Guid CompanyId { get; set; }

    public Guid? CreatedBy { get; set; }

    public string Status { get; set; } = null!;

    public string? DosyaNo { get; set; }

    public DateOnly? DilekceTarihi { get; set; }

    public short? ProvinceId { get; set; }

    public Guid? DistrictId { get; set; }

    public int? AsansorAdedi { get; set; }

    public string? YapiSahibi { get; set; }

    public string? MontajAdresi { get; set; }

    public string? Pafta { get; set; }

    public string? Ada { get; set; }

    public string? Parsel { get; set; }

    public int? BeyanYukuKg { get; set; }

    public int? KisiSayisi { get; set; }

    public decimal? BeyanHizi { get; set; }

    public int? DurakSayisi { get; set; }

    public Guid? MakineMuhendisId { get; set; }

    public Guid? ElektrikMuhendisId { get; set; }

    public string InputData { get; set; } = null!;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public Guid? IlgiliIdareId { get; set; }

    public virtual Company Company { get; set; } = null!;

    public virtual Profile? CreatedByNavigation { get; set; }

    public virtual District? District { get; set; }

    public virtual Engineer? ElektrikMuhendis { get; set; }

    public virtual IlgiliIdareler? IlgiliIdare { get; set; }

    public virtual Engineer? MakineMuhendis { get; set; }

    public virtual Province? Province { get; set; }
}
