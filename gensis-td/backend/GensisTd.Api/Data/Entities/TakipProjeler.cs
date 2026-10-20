using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class TakipProjeler
{
    public Guid Id { get; set; }

    public int ProjeNo { get; set; }

    public string ProjeTipi { get; set; } = null!;

    public DateOnly? SiparisTarihi { get; set; }

    public Guid? CompanyId { get; set; }

    public string? AdaParsel { get; set; }

    public string? IsAdi { get; set; }

    public int? AsansorSayisi { get; set; }

    public string? AsansorTipi { get; set; }

    public int? ProvinceId { get; set; }

    public string? DistrictId { get; set; }

    public string? IlAdi { get; set; }

    public string? IlceAdi { get; set; }

    public decimal? Fiyat { get; set; }

    public string? FaturaTipi { get; set; }

    public decimal? ToplamTutar { get; set; }

    public Guid? ProjeSorumlusuId { get; set; }

    public DateOnly? TahminiTamamlanma { get; set; }

    public string Durum { get; set; } = null!;

    public string? BekliyorAciklama { get; set; }

    public DateOnly? TamamlanmaTarihi { get; set; }

    public string? TeslimTipi { get; set; }

    public int? HardCopyAdedi { get; set; }

    public bool MuhasebeyeGonderildi { get; set; }

    public string? MuhasebeDurumu { get; set; }

    public Guid? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public string? Ada { get; set; }

    public string? Parsel { get; set; }

    public Guid? ParentId { get; set; }

    public string? RevNo { get; set; }

    public DateOnly? RevTarihi { get; set; }

    public string? RevAciklama { get; set; }

    public Guid? MontajFirmaId { get; set; }

    public string? TdNo { get; set; }

    public string? AsansorSeriNo { get; set; }

    public virtual Company? Company { get; set; }

    public virtual Profile? CreatedByNavigation { get; set; }

    public virtual ICollection<TakipProjeler> InverseParent { get; set; } = new List<TakipProjeler>();

    public virtual Company? MontajFirma { get; set; }

    public virtual TakipProjeler? Parent { get; set; }

    public virtual Profile? ProjeSorumlusu { get; set; }

    public virtual ICollection<TakipDokumanlar> TakipDokumanlars { get; set; } = new List<TakipDokumanlar>();

    public virtual TakipMuhasebe? TakipMuhasebe { get; set; }
}
