namespace GensisTd.Api.Data.Entities;

/// <summary>
/// One "Şifremi unuttum" link. Only the SHA-256 of the token is stored. A link works once, until it expires, and
/// only while the user's token version is the one it was issued for (a password change or deactivation ends it).
/// Code-first: Supabase kept these in auth.users.
/// </summary>
public class PasswordResetToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public byte[] TokenHash { get; set; } = [];
    public int TokenVersion { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}
