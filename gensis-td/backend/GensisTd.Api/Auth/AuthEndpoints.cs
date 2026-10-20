using System.Security.Claims;
using GensisTd.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GensisTd.Api.Auth;

public static class AuthEndpoints
{
    public record LoginRequest(string Email, string Password);
    public record UserDto(Guid Id, string Email);

    public static void MapAuthEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/auth");

        g.MapPost("/login", async (LoginRequest req, AppDbContext db, TokenService tokens, IOptions<AuthOptions> opts, HttpContext http) =>
        {
            var email = req.Email.Trim().ToLowerInvariant();
            var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email);
            // Same response for unknown email and wrong password.
            if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
                return Results.Unauthorized();

            user.LastSignInAt = DateTimeOffset.UtcNow;
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
            return Results.Ok(new UserDto(user.Id, user.Email));
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
            var user = await db.Users.FindAsync(id);
            return user is null ? Results.Unauthorized() : Results.Ok(new UserDto(user.Id, user.Email));
        }).RequireAuthorization();
    }
}
