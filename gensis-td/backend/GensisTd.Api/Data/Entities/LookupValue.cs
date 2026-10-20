using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class LookupValue
{
    public Guid Id { get; set; }

    public string ListKey { get; set; } = null!;

    public string Value { get; set; } = null!;

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }
}
