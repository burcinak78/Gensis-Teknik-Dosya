namespace GensisTd.Api.Data;

// Replaces Supabase auth.users. Ids are kept as uuid so migrated users keep their ids.
public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? LastSignInAt { get; set; }
}
