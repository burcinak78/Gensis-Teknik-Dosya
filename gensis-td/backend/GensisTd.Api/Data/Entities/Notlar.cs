using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class Notlar
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public string Icerik { get; set; } = null!;

    public DateTime SayacBaslangic { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual User User { get; set; } = null!;
}
