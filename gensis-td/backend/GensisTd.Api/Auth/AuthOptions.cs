namespace GensisTd.Api.Auth;

public class AuthOptions
{
    public const string CookieName = "gtd_session";

    // HMAC key for session tokens; at least 32 bytes. Comes from env (Auth__JwtSecret).
    public string JwtSecret { get; set; } = "";
    public int SessionHours { get; set; } = 12;
    // false only for local http; behind Cloudflare the site is https.
    public bool SecureCookie { get; set; } = true;
}
