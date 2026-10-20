using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class TakipMuhasebe
{
    public Guid Id { get; set; }

    public Guid TakipId { get; set; }

    public DateOnly? FaturaTarihi { get; set; }

    public string? FaturaNo { get; set; }

    public bool CariyeIslendi { get; set; }

    public string? TeslimYontemi { get; set; }

    public string? KargoSirketi { get; set; }

    public string? KargoTakipNo { get; set; }

    public DateOnly? TeslimTarihi { get; set; }

    public Guid? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public virtual TakipProjeler Takip { get; set; } = null!;
}
