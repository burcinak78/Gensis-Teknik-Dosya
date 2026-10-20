using System.Security.Claims;
using GensisTd.Api.Data;
using Microsoft.EntityFrameworkCore;
using NpgsqlTypes;

namespace GensisTd.Api.Auth;

/// <summary>
/// Loads the profile behind the session token on every request. A missing or deactivated profile
/// makes the request anonymous, so deactivation and role changes apply immediately instead of
/// when the 12-hour token expires. Role claims are added for policy checks.
/// </summary>
public static class ActorMiddleware
{
    public static IApplicationBuilder UseActor(this IApplicationBuilder app) => app.Use(async (http, next) =>
    {
        if (Guid.TryParse(http.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            var db = http.RequestServices.GetRequiredService<AppDbContext>();
            var profile = await db.Profiles.AsNoTracking()
                .Where(p => p.Id == userId)
                .Select(p => new { p.Role, p.CompanyId, p.IsActive })
                .SingleOrDefaultAsync(http.RequestAborted);

            if (profile is { IsActive: true })
            {
                var actor = new Actor(userId, profile.Role, profile.CompanyId);
                http.Items[typeof(Actor)] = actor;
                http.User.AddIdentity(new ClaimsIdentity([new Claim(ClaimTypes.Role, RoleName(actor.Role))]));
            }
            else
            {
                http.User = new ClaimsPrincipal(new ClaimsIdentity());
            }
        }
        await next();
    });

    // Same labels as the database enum ("admin", "gensis", ...).
    public static string RoleName(AppRole role) =>
        typeof(AppRole).GetField(role.ToString())!.GetCustomAttributes(typeof(PgNameAttribute), false)
            .Cast<PgNameAttribute>().Single().PgName;
}
