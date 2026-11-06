using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// Company lock on the edit screens (z8qgvccb0e): a saved teknik dosya's "Montaj / Mimarlık Firması" and a Proje
/// Takip job's "Firma" change only by an admin. Gensis staff get 403 with a message; creating stays free.
/// </summary>
[Collection(ApiCollection.Name)]
public class CompanyLockTests(ApiFixture api)
{
    private static object Td(Guid company, string dosyaNo) => new { companyId = company, dosyaNo, inputData = new { } };

    private static object Job(Guid company) => new
    {
        projeTipi = "mimari", companyId = company, faturaTipi = "faturasiz", tahminiTamamlanma = "2030-01-01",
    };

    private static async Task<(HttpStatusCode Status, string Body)> PutAsync(HttpClient c, string path, object body)
    {
        using var res = await c.PutAsJsonAsync(path, body);
        return (res.StatusCode, await res.Content.ReadAsStringAsync());
    }

    private static async Task<Guid> CreateAsync(HttpClient c, string path, object body)
    {
        using var res = await c.PostAsJsonAsync(path, body);
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task Teknik_dosya_company_changes_by_admin_only()
    {
        var staff = await api.As(Staff);
        var no = $"LOCK-{Guid.NewGuid():N}";
        // Creating for any company stays free for staff.
        var project = await CreateAsync(staff, "/api/projects", Td(CompanyA, no));

        var (status, body) = await PutAsync(staff, $"/api/projects/{project}", Td(CompanyB, no));
        Assert.Equal(HttpStatusCode.Forbidden, status);
        Assert.Contains("yalnız yönetici", body);
        Assert.Equal(CompanyA, await api.ScalarAsync<Guid>("SELECT company_id FROM projects WHERE id = $1", project));

        // Other fields still save when the company stays.
        Assert.Equal(HttpStatusCode.OK, (await PutAsync(staff, $"/api/projects/{project}", Td(CompanyA, no + "-2"))).Status);

        Assert.Equal(HttpStatusCode.OK, (await PutAsync(await api.As(Admin), $"/api/projects/{project}", Td(CompanyB, no))).Status);
        Assert.Equal(CompanyB, await api.ScalarAsync<Guid>("SELECT company_id FROM projects WHERE id = $1", project));
    }

    [Fact]
    public async Task Customer_cannot_move_own_teknik_dosya()
    {
        var alfa = await api.As(CustomerA);
        var no = $"LOCK-{Guid.NewGuid():N}";
        var project = await CreateAsync(alfa, "/api/projects", Td(CompanyA, no));
        Assert.Equal(HttpStatusCode.Forbidden, (await PutAsync(alfa, $"/api/projects/{project}", Td(CompanyB, no))).Status);
        Assert.Equal(HttpStatusCode.OK, (await PutAsync(alfa, $"/api/projects/{project}", Td(CompanyA, no))).Status);
    }

    [Fact]
    public async Task Proje_takip_firma_changes_by_admin_only()
    {
        var staff = await api.As(Staff);
        var job = await CreateAsync(staff, "/api/takip", Job(CompanyA));

        var (status, body) = await PutAsync(staff, $"/api/takip/{job}", Job(CompanyB));
        Assert.Equal(HttpStatusCode.Forbidden, status);
        Assert.Contains("yalnız yönetici", body);
        Assert.Equal(CompanyA, await api.ScalarAsync<Guid>("SELECT company_id FROM takip_projeler WHERE id = $1", job));

        Assert.Equal(HttpStatusCode.OK, (await PutAsync(staff, $"/api/takip/{job}", Job(CompanyA))).Status);
        Assert.Equal(HttpStatusCode.OK, (await PutAsync(await api.As(Admin), $"/api/takip/{job}", Job(CompanyB))).Status);
        Assert.Equal(CompanyB, await api.ScalarAsync<Guid>("SELECT company_id FROM takip_projeler WHERE id = $1", job));
        // The accountant reads Proje Takip but writes nothing (unchanged rule).
        Assert.Equal(HttpStatusCode.Forbidden, (await PutAsync(await api.As(Muhasebeci), $"/api/takip/{job}", Job(CompanyA))).Status);
    }
}
