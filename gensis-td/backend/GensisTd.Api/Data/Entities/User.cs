using System;
using System.Collections.Generic;

namespace GensisTd.Api.Data.Entities;

public partial class User
{
    public Guid Id { get; set; }

    public string Email { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public DateTime? LastSignInAt { get; set; }

    public virtual ICollection<Notlar> Notlars { get; set; } = new List<Notlar>();

    public virtual Profile? Profile { get; set; }
}
