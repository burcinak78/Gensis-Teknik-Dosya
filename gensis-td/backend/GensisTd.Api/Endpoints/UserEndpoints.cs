using GensisTd.Api.Auth;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace GensisTd.Api.Endpoints;

/// <summary>
/// User management (admin/actions.ts createUser, updateUser, deleteUser): admin only. Sign-in data lives in
/// the users table (bcrypt) instead of Supabase Auth. Staff roles belong to Gensis's company
/// (GENSIS_COMPANY_ID); the live code looked it up by name and created it when missing.
/// </summary>
public static class UserEndpoints
{
    public const int MinPasswordLength = 10; // user decision (KRR-024); existing passwords keep working

    public record UserRow(Guid Id, string Email, string? FullName, AppRole Role, bool IsActive, Guid? CompanyId, string? CompanyShortName,
        DateTime? LastSignInAt);
    public record CreateUserInput(string? Email, string? Password, string? FullName, AppRole? Role, Guid? CompanyId);
    public record UpdateUserInput(string? FullName, AppRole? Role, Guid? CompanyId, bool IsActive, string? Password);

    public static void MapUserEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/users").RequireAuthorization(Policies.Admin);

        g.MapGet("/", (AppDbContext db, CancellationToken ct) =>
            db.Users.AsNoTracking().Where(u => u.Profile != null).OrderBy(u => u.Email)
                .Select(u => new UserRow(u.Id, u.Email, u.Profile!.FullName, u.Profile.Role, u.Profile.IsActive, u.Profile.CompanyId,
                    u.Profile.Company != null ? u.Profile.Company.ShortName : null, u.LastSignInAt))
                .ToListAsync(ct));

        g.MapPost("/", async (CreateUserInput input, AppDbContext db, GensisCompany gensis, CancellationToken ct) =>
        {
            var email = input.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(input.Password))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["email"] = ["E-posta ve şifre zorunlu."] });
            if (input.Password.Length < MinPasswordLength)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["password"] = [$"Şifre en az {MinPasswordLength} karakter olmalı."] });
            if (input.Role is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["role"] = ["Geçersiz rol."] });
            if (await db.Users.AnyAsync(u => u.Email == email, ct))
                return Results.Conflict(new { error = "Bu e-posta ile bir kullanıcı zaten var." });
            if (await CompanyFor(input.Role.Value, input.CompanyId, db, gensis, ct) is not { } company) return BadCompany();

            var user = new User { Id = Guid.NewGuid(), Email = email, PasswordHash = BCrypt.Net.BCrypt.HashPassword(input.Password), CreatedAt = DateTime.UtcNow };
            db.Users.Add(user);
            db.Profiles.Add(new Profile
            {
                Id = user.Id, FullName = Clean(input.FullName) ?? email, Role = input.Role.Value, CompanyId = company.Id, IsActive = true,
            });
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { user.Id, message = "Kullanıcı oluşturuldu." });
        });

        g.MapPut("/{id:guid}", async (Guid id, UpdateUserInput input, AppDbContext db, GensisCompany gensis, CancellationToken ct) =>
        {
            if (input.Role is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["role"] = ["Geçersiz rol."] });
            if (!string.IsNullOrEmpty(input.Password) && input.Password.Length < MinPasswordLength)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["password"] = [$"Şifre en az {MinPasswordLength} karakter olmalı."] });
            var user = await db.Users.Include(u => u.Profile).SingleOrDefaultAsync(u => u.Id == id, ct);
            if (user?.Profile is not { } profile) return Results.NotFound();
            if (await CompanyFor(input.Role.Value, input.CompanyId, db, gensis, ct) is not { } company) return BadCompany();

            if (await WouldLeaveNoAdminAsync(db, id, input.Role.Value, input.IsActive, ct))
                return Results.Conflict(new { error = "Son aktif admin pasif yapılamaz ve rolü değiştirilemez." });

            // A new password or deactivation ends the user's open sessions (KRR-024).
            if (!string.IsNullOrEmpty(input.Password) || (profile.IsActive && !input.IsActive)) user.TokenVersion++;
            profile.FullName = Clean(input.FullName);
            profile.Role = input.Role.Value;
            profile.CompanyId = company.Id;
            profile.IsActive = input.IsActive;
            profile.UpdatedAt = DateTime.UtcNow;
            // Role, company and active state apply from the next request (ActorMiddleware reads the profile each time).
            if (!string.IsNullOrEmpty(input.Password)) user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(input.Password);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { message = "Kullanıcı güncellendi." });
        });

        // As before: references the live action cleared are cleared; anything else that points at the user
        // (teknik dosyas they created, files they uploaded) keeps the user, and the admin can deactivate instead.
        g.MapDelete("/{id:guid}", async (Guid id, Actor actor, AppDbContext db, CancellationToken ct) =>
        {
            if (id == actor.UserId) return Results.Conflict(new { error = "Kendi hesabınızı silemezsiniz." });
            if (!await db.Users.AnyAsync(u => u.Id == id, ct)) return Results.NotFound();
            if (await WouldLeaveNoAdminAsync(db, id, AppRole.Customer, false, ct))
                return Results.Conflict(new { error = "Son aktif admin silinemez." });
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await db.TakipProjelers.Where(t => t.ProjeSorumlusuId == id).ExecuteUpdateAsync(s => s.SetProperty(t => t.ProjeSorumlusuId, (Guid?)null), ct);
            await db.TakipProjelers.Where(t => t.CreatedBy == id).ExecuteUpdateAsync(s => s.SetProperty(t => t.CreatedBy, (Guid?)null), ct);
            await db.ProjeOnays.Where(p => p.CreatedBy == id).ExecuteUpdateAsync(s => s.SetProperty(p => p.CreatedBy, (Guid?)null), ct);
            await db.PendingChanges.Where(p => p.SubmittedBy == id).ExecuteUpdateAsync(s => s.SetProperty(p => p.SubmittedBy, (Guid?)null), ct);
            try
            {
                await db.Profiles.Where(p => p.Id == id).ExecuteDeleteAsync(ct);
                await db.Users.Where(u => u.Id == id).ExecuteDeleteAsync(ct);
            }
            catch (PostgresException pg) when (pg.SqlState == PostgresErrorCodes.ForeignKeyViolation)
            {
                return Results.Conflict(new { error = $"Kullanıcının bağlı kayıtları var ({pg.TableName}); silmek yerine pasif yapın." });
            }
            await tx.CommitAsync(ct);
            return Results.Ok(new { message = "Kullanıcı silindi." });
        });
    }

    /// <summary>True when the change (new role / active state) would leave no active admin (user decision).</summary>
    private static async Task<bool> WouldLeaveNoAdminAsync(AppDbContext db, Guid userId, AppRole newRole, bool newActive, CancellationToken ct)
    {
        if (newRole == AppRole.Admin && newActive) return false;
        var isActiveAdmin = await db.Profiles.AnyAsync(p => p.Id == userId && p.Role == AppRole.Admin && p.IsActive, ct);
        return isActiveAdmin && !await db.Profiles.AnyAsync(p => p.Id != userId && p.Role == AppRole.Admin && p.IsActive, ct);
    }

    private sealed record CompanyChoice(Guid? Id);

    /// <summary>Staff roles get Gensis's company; a customer gets the chosen company, which must exist (or none).</summary>
    private static async Task<CompanyChoice?> CompanyFor(AppRole role, Guid? companyId, AppDbContext db, GensisCompany gensis, CancellationToken ct)
    {
        if (role is AppRole.Admin or AppRole.Gensis or AppRole.Muhasebeci) return new CompanyChoice(gensis.Id);
        if (companyId is null) return new CompanyChoice(null);
        return await db.Companies.AnyAsync(c => c.Id == companyId, ct) ? new CompanyChoice(companyId) : null;
    }

    private static IResult BadCompany() =>
        Results.ValidationProblem(new Dictionary<string, string[]> { ["companyId"] = ["Firma bulunamadı."] });

    private static string? Clean(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();
}
