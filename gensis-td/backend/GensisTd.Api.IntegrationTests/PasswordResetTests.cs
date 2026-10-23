using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using GensisTd.Api.Auth;
using Microsoft.Extensions.DependencyInjection;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>"Şifremi unuttum": same answer for every address, links that work once, briefly and for the current password only.</summary>
[Collection(ApiCollection.Name)]
public partial class PasswordResetTests(ApiFixture api)
{
    private const string NewPassword = "Yeni-Parola-2026";

    private async Task<(HttpStatusCode, string)> RequestAsync(string email)
    {
        using var anon = api.Anonymous();
        using var res = await anon.PostAsJsonAsync("/api/auth/password-reset", new { email });
        return (res.StatusCode, await res.Content.ReadAsStringAsync());
    }

    private async Task<HttpStatusCode> ConfirmAsync(string? token, string password)
    {
        using var anon = api.Anonymous();
        return await anon.SendAsync("POST", "/api/auth/password-reset/confirm", new { token, password });
    }

    private static string TokenOf(Email.EmailMessage m)
    {
        var match = LinkPattern().Match(m.Text);
        Assert.True(match.Success, "no reset link in the e-mail");
        return match.Groups[1].Value;
    }

    private async Task<string> LinkTokenAsync(string email)
    {
        var before = api.Emails.To(email).Count();
        Assert.Equal(HttpStatusCode.Accepted, (await RequestAsync(email)).Item1);
        var sent = await api.Emails.WaitForAsync(email, before + 1);
        Assert.Equal(before + 1, sent.Count);
        return TokenOf(sent[^1]);
    }

    private async Task RestorePasswordAsync(Guid userId) =>
        await api.ExecAsync("UPDATE users SET password_hash = $1 WHERE id = $2", BCrypt.Net.BCrypt.HashPassword(Password, 4), userId);

    [Fact]
    public async Task Known_and_unknown_addresses_get_the_same_answer()
    {
        var unknown = await RequestAsync("kimse-yok@it.test");
        var inactive = await RequestAsync(Inactive);
        var known = await RequestAsync(ResetUser2);
        Assert.Equal(HttpStatusCode.Accepted, known.Item1);
        Assert.Equal(known, unknown);
        Assert.Equal(known, inactive);

        // The worker handles requests in order: once the known address has its e-mail, the others were skipped.
        await api.Emails.WaitForAsync(ResetUser2);
        Assert.Empty(api.Emails.To("kimse-yok@it.test"));
        Assert.Empty(api.Emails.To(Inactive));
        Assert.Equal(0L, await api.ScalarAsync<long>(
            "SELECT count(*) FROM password_reset_tokens t JOIN users u ON u.id = t.user_id WHERE u.email = $1", Inactive));
    }

    [Fact]
    public async Task Link_resets_the_password_once_and_ends_sessions()
    {
        using var oldSession = await api.LoginAsync(ResetUser);
        try
        {
            var token = await LinkTokenAsync(ResetUser);
            var mail = api.Emails.To(ResetUser).Last();
            Assert.Contains($"{ApiFixture.PublicUrl}/sifre-yenile#token={token}", mail.Text);
            Assert.Contains($"{ApiFixture.PublicUrl}/sifre-yenile#token={token}", mail.Html);
            // Only the hash is stored.
            Assert.Equal(0L, await api.ScalarAsync<long>(
                "SELECT count(*) FROM password_reset_tokens WHERE encode(token_hash, 'escape') LIKE '%' || $1 || '%'", token));

            Assert.Equal(HttpStatusCode.BadRequest, await ConfirmAsync(token, "123456789")); // 9 < 10
            Assert.Equal(HttpStatusCode.OK, await ConfirmAsync(token, NewPassword));
            Assert.Equal(HttpStatusCode.BadRequest, await ConfirmAsync(token, NewPassword + "2")); // once

            Assert.Equal(HttpStatusCode.Unauthorized, await oldSession.SendAsync("GET", "/api/auth/me"));
            using var anon = api.Anonymous();
            Assert.Equal(HttpStatusCode.Unauthorized, await anon.SendAsync("POST", "/api/auth/login", new { email = ResetUser, password = Password }));
            Assert.Equal(HttpStatusCode.OK, await anon.SendAsync("POST", "/api/auth/login", new { email = ResetUser, password = NewPassword }));
        }
        finally
        {
            await RestorePasswordAsync(UserReset);
        }
    }

    [Fact]
    public async Task Expired_wrong_or_superseded_links_do_not_work()
    {
        Assert.Equal(HttpStatusCode.BadRequest, await ConfirmAsync("uydurma-token", NewPassword));
        Assert.Equal(HttpStatusCode.BadRequest, await ConfirmAsync(null, NewPassword));

        var (expired, hash) = PasswordReset.NewToken();
        await api.ExecAsync("""
            INSERT INTO password_reset_tokens (user_id, token_hash, token_version, expires_at)
            SELECT id, $1, token_version, now() - interval '1 minute' FROM users WHERE id = $2
            """, hash, UserReset2);
        Assert.Equal(HttpStatusCode.BadRequest, await ConfirmAsync(expired, NewPassword));

        // Only the newest link works.
        var first = await LinkTokenAsync(ResetUser2);
        var second = await LinkTokenAsync(ResetUser2);
        Assert.Equal(HttpStatusCode.BadRequest, await ConfirmAsync(first, NewPassword));

        // A password change by the admin (token version) ends the open link.
        await api.ExecAsync("UPDATE users SET token_version = token_version + 1 WHERE id = $1", UserReset2);
        Assert.Equal(HttpStatusCode.BadRequest, await ConfirmAsync(second, NewPassword));

        using var anon = api.Anonymous();
        Assert.Equal(HttpStatusCode.OK, await anon.SendAsync("POST", "/api/auth/login", new { email = ResetUser2, password = Password }));
    }

    [Fact]
    public async Task Deactivated_user_cannot_use_an_open_link()
    {
        var token = await LinkTokenAsync(SessionUser);
        try
        {
            await api.ExecAsync("UPDATE profiles SET is_active = false WHERE id = $1", UserSession);
            Assert.Equal(HttpStatusCode.BadRequest, await ConfirmAsync(token, NewPassword));
        }
        finally
        {
            await api.ExecAsync("UPDATE profiles SET is_active = true WHERE id = $1", UserSession);
        }
        // Spent: does not work after reactivation either.
        Assert.Equal(HttpStatusCode.BadRequest, await ConfirmAsync(token, NewPassword));
    }

    [Fact]
    public async Task Requests_per_address_are_limited()
    {
        const string email = Muhasebeci;
        for (var i = 0; i < PasswordResetThrottle.MaxPerEmail + 2; i++)
            Assert.Equal(HttpStatusCode.Accepted, (await RequestAsync(email)).Item1);
        // A later address in the queue has arrived, so every request for this one has been handled.
        await LinkTokenAsync(CustomerB);
        Assert.Equal(PasswordResetThrottle.MaxPerEmail, api.Emails.To(email).Count());
    }

    [Fact]
    public async Task Old_spent_and_expired_links_are_cleaned_up()
    {
        var (_, oldHash) = PasswordReset.NewToken();
        var (_, freshHash) = PasswordReset.NewToken();
        await api.ExecAsync("""
            INSERT INTO password_reset_tokens (user_id, token_hash, token_version, expires_at, used_at) VALUES
                ($1, $2, 0, now() - interval '3 days', NULL),
                ($1, $3, 0, now() - interval '1 hour', now() - interval '2 hours')
            """, UserReset2, oldHash, freshHash);

        using var scope = api.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Data.AppDbContext>();
        await PasswordResetWorker.CleanupAsync(db, DateTime.UtcNow, CancellationToken.None);

        Assert.Equal(0L, await api.ScalarAsync<long>("SELECT count(*) FROM password_reset_tokens WHERE token_hash = $1", oldHash));
        // Spent two hours ago: kept for a day.
        Assert.Equal(1L, await api.ScalarAsync<long>("SELECT count(*) FROM password_reset_tokens WHERE token_hash = $1", freshHash));
    }

    [Fact]
    public async Task Malformed_request_is_400()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await RequestAsync("")).Item1);
        Assert.Equal(HttpStatusCode.BadRequest, (await RequestAsync("adres-degil")).Item1);
    }

    [GeneratedRegex(@"#token=([A-Za-z0-9_-]+)")]
    private static partial Regex LinkPattern();
}
