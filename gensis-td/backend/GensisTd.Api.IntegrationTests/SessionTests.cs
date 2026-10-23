using System.Net;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>The profile is loaded on every request (ActorMiddleware): deactivation and token version act at once (KRR-024).</summary>
[Collection(ApiCollection.Name)]
public class SessionTests(ApiFixture api)
{
    [Fact]
    public async Task Inactive_user_and_wrong_password_cannot_sign_in()
    {
        using var anon = api.Anonymous();
        Assert.Equal(HttpStatusCode.Unauthorized, await anon.SendAsync("POST", "/api/auth/login", new { email = Inactive, password = Password }));
        Assert.Equal(HttpStatusCode.Unauthorized, await anon.SendAsync("POST", "/api/auth/login", new { email = CustomerA, password = "yanlis-parola" }));
        Assert.Equal(HttpStatusCode.Unauthorized, await anon.SendAsync("POST", "/api/auth/login", new { email = "yok@it.test", password = Password }));
        // Empty hash (migrated account without a password): no password matches it, not even an empty one.
        Assert.Equal(HttpStatusCode.Unauthorized, await anon.SendAsync("POST", "/api/auth/login", new { email = NoPassword, password = Password }));
        Assert.Equal(HttpStatusCode.BadRequest, await anon.SendAsync("POST", "/api/auth/login", new { email = NoPassword, password = "" }));
    }

    [Fact]
    public async Task Deactivation_and_token_version_end_the_session_at_once()
    {
        try
        {
            using var c = await api.LoginAsync(SessionUser);
            var me = await c.JsonAsync("/api/auth/me");
            Assert.Equal(UserSession.ToString(), me.GetProperty("id").GetString());

            await api.ExecAsync("UPDATE profiles SET is_active = false WHERE id = $1", UserSession);
            Assert.Equal(HttpStatusCode.Unauthorized, await c.SendAsync("GET", "/api/auth/me"));
            Assert.Equal(HttpStatusCode.Unauthorized, await c.SendAsync("GET", $"/api/projects/{ProjectA}"));

            await api.ExecAsync("UPDATE profiles SET is_active = true WHERE id = $1", UserSession);
            Assert.Equal(HttpStatusCode.OK, await c.SendAsync("GET", "/api/auth/me"));

            // Password change / deactivation by the admin bumps the version: older tokens stop working.
            await api.ExecAsync("UPDATE users SET token_version = token_version + 1 WHERE id = $1", UserSession);
            Assert.Equal(HttpStatusCode.Unauthorized, await c.SendAsync("GET", "/api/auth/me"));

            using var fresh = await api.LoginAsync(SessionUser);
            Assert.Equal(HttpStatusCode.OK, await fresh.SendAsync("GET", "/api/auth/me"));
        }
        finally
        {
            await api.ExecAsync("UPDATE profiles SET is_active = true WHERE id = $1", UserSession);
        }
    }

    [Fact]
    public async Task Role_change_applies_to_the_next_request()
    {
        using var c = await api.LoginAsync(SessionUser);
        Assert.Equal(HttpStatusCode.NotFound, await c.SendAsync("GET", $"/api/projects/{ProjectB}"));
        try
        {
            await api.ExecAsync("UPDATE profiles SET role = 'gensis' WHERE id = $1", UserSession);
            Assert.Equal(HttpStatusCode.OK, await c.SendAsync("GET", $"/api/projects/{ProjectB}"));
        }
        finally
        {
            await api.ExecAsync("UPDATE profiles SET role = 'customer' WHERE id = $1", UserSession);
        }
        Assert.Equal(HttpStatusCode.NotFound, await c.SendAsync("GET", $"/api/projects/{ProjectB}"));
    }

    public static TheoryData<string> BadTokens => new()
    {
        // Valid shape, wrong key.
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwYzEifQ.c2lnbmF0dXJl",
        // alg=none, unsigned, otherwise a valid admin session.
        Unsigned(),
        // Right key, expired an hour ago (beyond the one-minute clock skew).
        Signed(DateTime.UtcNow.AddHours(-1)),
        // Right key, another issuer.
        Signed(DateTime.UtcNow.AddHours(1), issuer: "baska"),
    };

    [Theory, MemberData(nameof(BadTokens))]
    public async Task Bad_session_token_is_anonymous(string token)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, await WithToken(token, "/api/auth/me"));
        Assert.Equal(HttpStatusCode.Unauthorized, await WithToken(token, "/api/users"));
    }

    // Control for the cases above: the same token, valid, is accepted.
    [Fact]
    public async Task Valid_self_built_token_is_accepted()
    {
        Assert.Equal(HttpStatusCode.OK, await WithToken(Signed(DateTime.UtcNow.AddHours(1)), "/api/users"));
    }

    private async Task<HttpStatusCode> WithToken(string token, string path)
    {
        if (token.StartsWith(SignedMarker)) token = Sign(token[SignedMarker.Length..], api.JwtSecret);
        using var anon = api.Anonymous();
        using var req = new HttpRequestMessage(HttpMethod.Get, path);
        req.Headers.Add("Cookie", $"gtd_session={token}");
        using var res = await anon.SendAsync(req);
        return res.StatusCode;
    }

    private static string Payload(DateTime expires, string issuer) =>
        System.Text.Json.JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["sub"] = "00000000-0000-4000-8000-0000000000c1" /* admin */, ["tv"] = 0, ["iss"] = issuer, ["aud"] = "gensis-td",
            ["exp"] = new DateTimeOffset(expires).ToUnixTimeSeconds(),
        });

    private static string Unsigned() =>
        $"{B64("{\"alg\":\"none\",\"typ\":\"JWT\"}")}.{B64(Payload(DateTime.UtcNow.AddHours(1), "gensis-td"))}.";

    // TheoryData is built before the fixture exists, so signing waits until the test has the key.
    private const string SignedMarker = "sign:";

    private static string Signed(DateTime expires, string issuer = "gensis-td") =>
        SignedMarker + $"{B64("{\"alg\":\"HS256\",\"typ\":\"JWT\"}")}.{B64(Payload(expires, issuer))}";

    private static string Sign(string unsigned, string secret)
    {
        using var hmac = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(secret));
        return $"{unsigned}.{B64(hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(unsigned)))}";
    }

    private static string B64(string s) => B64(System.Text.Encoding.UTF8.GetBytes(s));

    private static string B64(byte[] b) => Convert.ToBase64String(b).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
