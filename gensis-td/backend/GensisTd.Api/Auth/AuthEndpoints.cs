using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GensisTd.Api.Auth;

public static class AuthEndpoints
{
    public record LoginRequest(string Email, string Password);
    public record UserDto(Guid Id, string Email, string? FullName, AppRole Role, Guid? CompanyId)
    {
        public static UserDto From(User u, Profile p) => new(u.Id, u.Email, p.FullName, p.Role, p.CompanyId);
    }

    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString());

    public static void MapAuthEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/auth");

        g.MapPost("/login", async (LoginRequest req, AppDbContext db, TokenService tokens, IOptions<AuthOptions> opts,
            LoginThrottle throttle, HttpContext http) =>
        {
            if (string.IsNullOrWhiteSpace(req.Email) || req.Email.Length > 320 || string.IsNullOrEmpty(req.Password))
                return Results.BadRequest();

            var email = req.Email.Trim().ToLowerInvariant();
            var ip = http.Connection.RemoteIpAddress?.ToString();
            if (throttle.TryAcquire(email, ip) is { } wait)
            {
                http.Response.Headers.RetryAfter = ((int)Math.Ceiling(wait.TotalSeconds)).ToString();
                return Results.StatusCode(StatusCodes.Status429TooManyRequests);
            }

            var user = await db.Users.Include(u => u.Profile).SingleOrDefaultAsync(u => u.Email == email);
            // Same response for unknown email, wrong password and deactivated account.
            // Verify even when the user is missing so response time does not reveal which emails exist.
            // Migrated accounts that never set a password have an empty hash, which BCrypt cannot parse: same path.
            var hasPassword = !string.IsNullOrEmpty(user?.PasswordHash);
            var passwordOk = BCrypt.Net.BCrypt.Verify(req.Password, hasPassword ? user!.PasswordHash : DummyHash) && hasPassword;
            if (!passwordOk || user?.Profile is not { IsActive: true } profile)
                return Results.Unauthorized();

            throttle.Succeeded(email, ip);
            user.LastSignInAt = DateTime.UtcNow;
            await db.SaveChangesAsync();

            var (token, expires) = tokens.Issue(user);
            http.Response.Cookies.Append(AuthOptions.CookieName, token, new CookieOptions
            {
                HttpOnly = true,
                Secure = opts.Value.SecureCookie,
                SameSite = SameSiteMode.Lax,
                Path = "/",
                Expires = expires,
            });
            return Results.Ok(UserDto.From(user, profile));
        });

        g.MapPost("/logout", (HttpContext http) =>
        {
            http.Response.Cookies.Delete(AuthOptions.CookieName, new CookieOptions { Path = "/" });
            return Results.NoContent();
        });

        // ActorMiddleware has already rejected missing or inactive profiles.
        g.MapGet("/me", async (Actor actor, AppDbContext db) =>
        {
            var user = await db.Users.Include(u => u.Profile).SingleAsync(u => u.Id == actor.UserId);
            return Results.Ok(UserDto.From(user, user.Profile!));
        }).RequireAuthorization();
    }
}
