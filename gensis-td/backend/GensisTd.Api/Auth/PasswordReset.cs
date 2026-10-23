using System.Net;
using System.Security.Cryptography;
using System.Threading.Channels;
using GensisTd.Api.Data;
using GensisTd.Api.Data.Entities;
using GensisTd.Api.Email;
using GensisTd.Api.Endpoints;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace GensisTd.Api.Auth;

/// <summary>
/// "Şifremi unuttum" (was Supabase resetPasswordForEmail + /sifre-yenile). The request always gets the same answer
/// and the lookup, token and e-mail happen in the background, so neither the answer nor its timing shows whether an
/// account exists. The link carries the token in the URL fragment (#token=...), which browsers do not send to the
/// server, so it stays out of proxy logs and Referer headers.
/// </summary>
public static class PasswordReset
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(1); // Supabase's default
    public const string PagePath = "/sifre-yenile";

    public record ResetRequest(string? Email);
    public record ResetConfirm(string? Token, string? Password);

    public static void AddPasswordReset(this IServiceCollection services, IConfiguration config)
    {
        services.Configure<EmailOptions>(config.GetSection("Email"));
        services.Configure<AppOptions>(config.GetSection("App"));
        services.AddHttpClient<IEmailSender, ResendEmailSender>(c => c.Timeout = TimeSpan.FromSeconds(20));
        services.AddSingleton<PasswordResetThrottle>();
        services.AddSingleton<PasswordResetQueue>();
        services.AddHostedService<PasswordResetWorker>();
    }

    public static void MapPasswordResetEndpoints(this WebApplication app)
    {
        var g = app.MapGroup("/api/auth/password-reset");

        g.MapPost("/", (ResetRequest req, PasswordResetThrottle throttle, PasswordResetQueue queue, HttpContext http) =>
        {
            var email = req.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(email) || email.Length > 320 || !email.Contains('@'))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["email"] = ["Geçerli bir e-posta adresi girin."] });
            // Over the limit (3 per e-mail, 10 per IP an hour): the same answer, nothing is sent.
            if (throttle.TryAcquire(email, http.Connection.RemoteIpAddress?.ToString()) is null)
                queue.TryAdd(email);
            return Results.Accepted(value: new { message = "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi." });
        });

        g.MapPost("/confirm", async (ResetConfirm req, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            if (string.IsNullOrEmpty(req.Password) || req.Password.Length < UserEndpoints.MinPasswordLength)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["password"] = [$"Şifre en az {UserEndpoints.MinPasswordLength} karakter olmalı."] });
            if (Hash(req.Token) is not { } hash) return Invalid();

            var now = clock.GetUtcNow().UtcDateTime;
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            // Taking the link and checking it is one statement, so two parallel uses cannot both succeed.
            var used = await db.PasswordResetTokens
                .Where(t => t.TokenHash == hash && t.UsedAt == null && t.ExpiresAt > now)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), ct);
            if (used == 0) return Invalid();
            var token = await db.PasswordResetTokens.AsNoTracking().SingleAsync(t => t.TokenHash == hash, ct);
            var user = await db.Users.Include(u => u.Profile).SingleAsync(u => u.Id == token.UserId, ct);
            if (user.Profile is not { IsActive: true } || user.TokenVersion != token.TokenVersion)
            {
                await tx.CommitAsync(ct); // the link is spent either way
                return Invalid();
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password);
            user.TokenVersion++; // signs out every session, and makes any other open link invalid
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Results.Ok(new { message = "Şifreniz güncellendi." });
        });
    }

    private static IResult Invalid() => Results.ValidationProblem(new Dictionary<string, string[]>
        { ["token"] = ["Bağlantı geçersiz ya da süresi dolmuş. Giriş ekranından yeni bağlantı isteyin."] });

    /// <summary>A new random token (base64url, 256 bits) and the hash that is stored.</summary>
    public static (string Token, byte[] Hash) NewToken()
    {
        var token = Base64Url(RandomNumberGenerator.GetBytes(32));
        return (token, SHA256.HashData(System.Text.Encoding.ASCII.GetBytes(token)));
    }

    public static byte[]? Hash(string? token) =>
        string.IsNullOrEmpty(token) || token.Length > 100 ? null : SHA256.HashData(System.Text.Encoding.ASCII.GetBytes(token));

    private static string Base64Url(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static EmailMessage Message(string to, string link)
    {
        var safe = WebUtility.HtmlEncode(link);
        var hours = (int)Lifetime.TotalHours;
        return new EmailMessage(to, "Şifre sıfırlama — Gensis Teknik Dosya",
            $"""
            <p>Merhaba,</p>
            <p>Gensis Teknik Dosya hesabınız için şifre sıfırlama isteği aldık. Yeni şifrenizi belirlemek için bağlantıya tıklayın:</p>
            <p><a href="{safe}">Şifremi sıfırla</a></p>
            <p>Bağlantı {hours} saat geçerlidir ve bir kez kullanılabilir. Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın; şifreniz değişmez.</p>
            """,
            $"Merhaba,\n\nGensis Teknik Dosya hesabınız için şifre sıfırlama isteği aldık. Yeni şifrenizi belirlemek için:\n{link}\n\n"
            + $"Bağlantı {hours} saat geçerlidir ve bir kez kullanılabilir. Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın.\n");
    }
}

public class AppOptions
{
    // The site's public address, for links in e-mails (App__PublicUrl), e.g. https://dosyalift.com.
    public string PublicUrl { get; set; } = "";
}

public sealed class PasswordResetThrottle(TimeProvider clock) : AttemptThrottle(clock, MaxPerEmail, MaxPerIp, Window)
{
    public const int MaxPerEmail = 3;
    public const int MaxPerIp = 10;
    public static readonly TimeSpan Window = TimeSpan.FromHours(1);
}

/// <summary>Requests waiting for the worker. Bounded: a flood is dropped instead of filling memory.</summary>
public sealed class PasswordResetQueue
{
    private readonly Channel<string> _channel = Channel.CreateBounded<string>(
        new BoundedChannelOptions(200) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });

    public bool TryAdd(string email) => _channel.Writer.TryWrite(email);

    public ChannelReader<string> Reader => _channel.Reader;
}

public sealed class PasswordResetWorker(
    PasswordResetQueue queue, IServiceScopeFactory scopes, IOptions<EmailOptions> email, IOptions<AppOptions> app,
    TimeProvider clock, ILogger<PasswordResetWorker> logger) : BackgroundService
{
    // Spent and expired links are kept a day (for support questions), then removed.
    public static readonly TimeSpan Retention = TimeSpan.FromDays(1);
    private static readonly TimeSpan CleanupEvery = TimeSpan.FromHours(6);

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!email.Value.IsConfigured || string.IsNullOrEmpty(app.Value.PublicUrl))
            logger.LogWarning("Password reset e-mail is not configured (Email__ResendApiKey, Email__From, App__PublicUrl)");
        return Task.WhenAll(SendLoopAsync(stoppingToken), CleanupLoopAsync(stoppingToken));
    }

    private async Task CleanupLoopAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(CleanupEvery, clock);
        do
        {
            try
            {
                using var scope = scopes.CreateScope();
                await CleanupAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>(), clock.GetUtcNow().UtcDateTime, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning("Password reset cleanup failed: {Error}", ex.Message);
            }
        } while (await timer.WaitForNextTickAsync(ct).ConfigureAwait(false));
    }

    public static Task<int> CleanupAsync(AppDbContext db, DateTime now, CancellationToken ct)
    {
        var cutoff = now - Retention;
        return db.PasswordResetTokens.Where(t => t.ExpiresAt < cutoff || t.UsedAt < cutoff).ExecuteDeleteAsync(ct);
    }

    private async Task SendLoopAsync(CancellationToken stoppingToken)
    {
        await foreach (var address in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await HandleAsync(address, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // No address in the log: it would show who has an account.
                logger.LogError("Password reset e-mail failed: {Error}", ex.Message);
            }
        }
    }

    private async Task HandleAsync(string address, CancellationToken ct)
    {
        if (!email.Value.IsConfigured || string.IsNullOrEmpty(app.Value.PublicUrl)) return;
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.AsNoTracking().Where(u => u.Email == address && u.Profile != null && u.Profile.IsActive)
            .Select(u => new { u.Id, u.Email, u.TokenVersion }).SingleOrDefaultAsync(ct);
        if (user is null) return;

        var now = clock.GetUtcNow().UtcDateTime;
        var (token, hash) = PasswordReset.NewToken();
        // Only the newest link works.
        await db.PasswordResetTokens.Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.UsedAt, now), ct);
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(), UserId = user.Id, TokenHash = hash, TokenVersion = user.TokenVersion,
            CreatedAt = now, ExpiresAt = now + PasswordReset.Lifetime,
        });
        await db.SaveChangesAsync(ct);

        var link = $"{app.Value.PublicUrl.TrimEnd('/')}{PasswordReset.PagePath}#token={token}";
        await scope.ServiceProvider.GetRequiredService<IEmailSender>().SendAsync(PasswordReset.Message(user.Email, link), ct);
    }
}
