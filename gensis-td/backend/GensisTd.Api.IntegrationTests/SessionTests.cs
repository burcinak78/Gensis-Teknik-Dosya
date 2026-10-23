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

    [Fact]
    public async Task Forged_cookie_is_anonymous()
    {
        using var anon = api.Anonymous();
        using var req = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        // Valid shape, wrong key.
        req.Headers.Add("Cookie", "gtd_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwYzEifQ.c2lnbmF0dXJl");
        using var res = await anon.SendAsync(req);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }
}
