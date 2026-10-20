using GensisTd.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace GensisTd.Api.Data;

// Creates the first admin on an empty database (ADMIN_EMAIL / ADMIN_PASSWORD). Does nothing once any user exists.
public static class AdminSeeder
{
    public static async Task SeedAsync(AppDbContext db, IConfiguration config, ILogger logger)
    {
        var email = config["ADMIN_EMAIL"]?.Trim().ToLowerInvariant();
        var password = config["ADMIN_PASSWORD"];
        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password) || await db.Users.AnyAsync())
            return;

        // Supabase created the profile with a trigger on auth.users (handle_new_user); here it is explicit.
        var user = new User { Id = Guid.NewGuid(), Email = email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(password) };
        db.Users.Add(user);
        db.Profiles.Add(new Profile { Id = user.Id, FullName = email, Role = AppRole.Admin });
        await db.SaveChangesAsync();
        logger.LogInformation("Seeded first admin {Email}", email);
    }
}
