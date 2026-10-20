using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class VProjectOverview
{
    public Guid? Id { get; set; }

    public string? DosyaNo { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string? Firma { get; set; }

    public string? Il { get; set; }

    public int? BeyanYukuKg { get; set; }

    public int? KatAdedi { get; set; }

    public int? DurakAdedi { get; set; }

    public string? Olusturan { get; set; }

    public long? UretilenDosya { get; set; }

    public DateTime? SonUretim { get; set; }
}
