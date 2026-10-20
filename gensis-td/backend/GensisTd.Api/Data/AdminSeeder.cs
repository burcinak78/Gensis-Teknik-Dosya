using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Data;

// Creates the first user on an empty database (ADMIN_EMAIL / ADMIN_PASSWORD). Does nothing once any user exists.
public static class AdminSeeder
{
    public static async Task SeedAsync(AppDbContext db, IConfiguration config, ILogger logger)
    {
        var email = config["ADMIN_EMAIL"]?.Trim().ToLowerInvariant();
        var password = config["ADMIN_PASSWORD"];
        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password) || await db.Users.AnyAsync())
            return;

        db.Users.Add(new User { Email = email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(password) });
        await db.SaveChangesAsync();
        logger.LogInformation("Seeded first user {Email}", email);
    }
}
