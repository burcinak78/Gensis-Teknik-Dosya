using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class VEquipmentCatalog
{
    public string? CategoryCode { get; set; }

    public string? CategoryName { get; set; }

    public Guid? BrandId { get; set; }

    public string? BrandName { get; set; }

    public Guid? ModelId { get; set; }

    public string? ModelName { get; set; }

    public string? CertificateNo { get; set; }

    public string? NotifiedBodyNo { get; set; }

    public string? NotifiedBodyName { get; set; }

    public string? CertificateCurrentFile { get; set; }
}
