using System.Security.Claims;
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

        g.MapPost("/login", async (LoginRequest req, AppDbContext db, TokenService tokens, IOptions<AuthOptions> opts, HttpContext http) =>
        {
            var email = req.Email.Trim().ToLowerInvariant();
            var user = await db.Users.Include(u => u.Profile).SingleOrDefaultAsync(u => u.Email == email);
            // Same response for unknown email, wrong password and deactivated account.
            // Verify even when the user is missing so response time does not reveal which emails exist.
            var passwordOk = BCrypt.Net.BCrypt.Verify(req.Password, user?.PasswordHash ?? DummyHash);
            if (!passwordOk || user?.Profile is not { IsActive: true } profile)
                return Results.Unauthorized();

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

        g.MapGet("/me", async (ClaimsPrincipal principal, AppDbContext db) =>
        {
            if (!Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
                return Results.Unauthorized();
            var user = await db.Users.Include(u => u.Profile).SingleOrDefaultAsync(u => u.Id == id);
            return user?.Profile is { IsActive: true } profile ? Results.Ok(UserDto.From(user, profile)) : Results.Unauthorized();
        }).RequireAuthorization();
    }
}
