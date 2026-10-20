using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class CapacityTable
{
    public int BeyanYukuKg { get; set; }

    public int? KisiSayisi { get; set; }

    public int? KabinAgirlikKg { get; set; }

    public int? KarsiAgirlikKg { get; set; }
}
