using System.Net;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>Role policies (Policies.cs) as each role meets them over HTTP.</summary>
[Collection(ApiCollection.Name)]
public class RoleTests(ApiFixture api)
{
    public static TheoryData<string, string> SignedInOnly => new()
    {
        { "GET", "/api/auth/me" },
        { "GET", "/api/projects" },
        { "GET", $"/api/projects/{ProjectA}" },
        { "POST", "/api/projects" },
        { "GET", "/api/catalog/companies" },
        { "GET", "/api/catalog/equipment" },
        { "GET", $"/api/files/project/{FileA}" },
        { "GET", "/api/proje-onay" },
        { "GET", "/api/engineers" },
        { "GET", "/api/notes" },
        { "GET", "/api/notifications" },
        { "GET", "/api/takip" },
        { "GET", "/api/muhasebe" },
        { "GET", "/api/users" },
        { "GET", "/api/pending-changes" },
    };

    [Theory, MemberData(nameof(SignedInOnly))]
    public async Task Anonymous_gets_401(string method, string path)
    {
        using var anon = api.Anonymous();
        Assert.Equal(HttpStatusCode.Unauthorized, await anon.SendAsync(method, path, method == "GET" ? null : new { }));
    }

    // (user, method, path, expected). Bodies are irrelevant: the policy answers before the endpoint runs.
    public static TheoryData<string, string, string, HttpStatusCode> Policy => new()
    {
        // Customer: no office, staff or admin screens.
        { CustomerA, "GET", "/api/takip", HttpStatusCode.Forbidden },
        { CustomerA, "POST", "/api/takip", HttpStatusCode.Forbidden },
        { CustomerA, "GET", $"/api/takip/{TakipB}", HttpStatusCode.Forbidden },
        { CustomerA, "GET", "/api/muhasebe", HttpStatusCode.Forbidden },
        { CustomerA, "PUT", $"/api/muhasebe/{TakipB}", HttpStatusCode.Forbidden },
        { CustomerA, "GET", $"/api/files/takip/{TakipB}", HttpStatusCode.Forbidden },
        { CustomerA, "GET", "/api/users", HttpStatusCode.Forbidden },
        { CustomerA, "POST", "/api/users", HttpStatusCode.Forbidden },
        { CustomerA, "GET", "/api/pending-changes", HttpStatusCode.Forbidden },
        { CustomerA, "POST", $"/api/pending-changes/{Guid.NewGuid()}/approve", HttpStatusCode.Forbidden },
        { CustomerA, "POST", "/api/companies", HttpStatusCode.Forbidden },
        { CustomerA, "DELETE", $"/api/companies/{CompanyA}", HttpStatusCode.Forbidden },
        { CustomerA, "DELETE", $"/api/companies/documents/{CompanyDocA}", HttpStatusCode.Forbidden },
        { CustomerA, "DELETE", $"/api/engineers/{EngineerA}", HttpStatusCode.Forbidden },
        { CustomerA, "DELETE", $"/api/engineers/documents/{EngineerDocA}", HttpStatusCode.Forbidden },
        { CustomerA, "GET", "/api/catalog/companies/names", HttpStatusCode.Forbidden },
        { CustomerA, "POST", "/api/catalog/ilgili-idareler", HttpStatusCode.Forbidden },
        { CustomerA, "POST", "/api/catalog/certificates", HttpStatusCode.Forbidden },
        { CustomerA, "POST", "/api/catalog/equipment/brands", HttpStatusCode.Forbidden },

        // Muhasebeci: reads takip and muhasebe, records invoices; no staff writes, no users.
        { Muhasebeci, "GET", "/api/takip", HttpStatusCode.OK },
        { Muhasebeci, "GET", $"/api/takip/{TakipB}", HttpStatusCode.OK },
        { Muhasebeci, "GET", "/api/muhasebe", HttpStatusCode.OK },
        { Muhasebeci, "GET", "/api/catalog/companies/names", HttpStatusCode.OK },
        { Muhasebeci, "POST", "/api/takip", HttpStatusCode.Forbidden },
        { Muhasebeci, "DELETE", $"/api/takip/{TakipB}", HttpStatusCode.Forbidden },
        { Muhasebeci, "GET", "/api/users", HttpStatusCode.Forbidden },
        { Muhasebeci, "GET", "/api/pending-changes", HttpStatusCode.Forbidden },
        { Muhasebeci, "POST", "/api/companies", HttpStatusCode.Forbidden },
        // Not staff: customers' projects stay hidden (p_projects_select).
        { Muhasebeci, "GET", $"/api/projects/{ProjectA}", HttpStatusCode.NotFound },

        // Gensis staff: every company's rows and the staff screens, but not users or invoices.
        { Staff, "GET", $"/api/projects/{ProjectB}", HttpStatusCode.OK },
        { Staff, "GET", $"/api/files/project/{FileB}", HttpStatusCode.Redirect },
        { Staff, "GET", "/api/takip", HttpStatusCode.OK },
        { Staff, "GET", "/api/pending-changes", HttpStatusCode.OK },
        { Staff, "GET", "/api/users", HttpStatusCode.Forbidden },
        { Staff, "PUT", $"/api/muhasebe/{TakipB}", HttpStatusCode.Forbidden },

        { Admin, "GET", "/api/users", HttpStatusCode.OK },
        { Admin, "GET", $"/api/projects/{ProjectB}", HttpStatusCode.OK },
    };

    [Theory, MemberData(nameof(Policy))]
    public async Task Role_policy(string user, string method, string path, HttpStatusCode expected)
    {
        var client = await api.As(user);
        Assert.Equal(expected, await client.SendAsync(method, path, method == "GET" || method == "DELETE" ? null : new { }));
    }

    [Fact]
    public async Task Accountant_reads_every_company_as_on_live()
    {
        // ADR-004 (user decision): the accountant reads all companies and engineers.
        var m = await api.As(Muhasebeci);
        var companies = (await m.JsonAsync("/api/catalog/companies")).Ids();
        Assert.Contains(CompanyA.ToString(), companies);
        Assert.Contains(CompanyB.ToString(), companies);
        var engineers = (await m.JsonAsync("/api/catalog/engineers")).GetProperty("engineers").Ids();
        Assert.Contains(EngineerB.ToString(), engineers);
        // Reading only: writes still go through VisibleTo.
        Assert.Equal(HttpStatusCode.NotFound, await m.SendAsync("PUT", $"/api/companies/{CompanyB}",
            new { shortName = "X", legalName = "X" }));
    }

    // A user without a company is a member of nothing (no `company_id = NULL` match).
    [Fact]
    public async Task User_without_company_sees_nothing_and_writes_nowhere()
    {
        var c = await api.As(NoCompany);
        Assert.Empty((await c.JsonAsync("/api/projects")).EnumerateArray());
        Assert.Empty((await c.JsonAsync("/api/proje-onay")).EnumerateArray());
        Assert.Empty((await c.JsonAsync("/api/catalog/companies")).EnumerateArray());
        Assert.Empty((await c.JsonAsync("/api/catalog/engineers")).GetProperty("engineers").EnumerateArray());
        Assert.Empty((await c.JsonAsync("/api/engineers")).EnumerateArray());
        Assert.Equal(HttpStatusCode.NotFound, await c.SendAsync("GET", $"/api/projects/{ProjectA}"));
        Assert.Equal(HttpStatusCode.Forbidden, await c.SendAsync("POST", "/api/projects",
            CrossCompanyTests.ProjectInput(CompanyA, "FIRMASIZ")));
        Assert.Equal(HttpStatusCode.Forbidden, await c.SendAsync("POST", "/api/engineers",
            new { fullName = "Firmasız", discipline = "makine" }));
    }
}
