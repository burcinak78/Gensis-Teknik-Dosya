using System.Net;
using System.Net.Http.Json;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// "Muhasebeye gönder" from a teknik dosya (KRR-013, KRR-022): only the project's own takip rows (same TD number,
/// the project's company or none) are created, changed or removed; another company's row and a posted row never are.
/// </summary>
[Collection(ApiCollection.Name)]
public class MuhasebeLinkTests(ApiFixture api)
{
    private static readonly object Send = new { fiyat = 1000, faturaTipi = "faturali", teslimTipi = "dijital" };

    [Fact]
    public async Task Same_td_row_of_another_company_is_left_alone()
    {
        var alfa = await api.As(CustomerA);

        Assert.Equal(HttpStatusCode.OK, await alfa.SendAsync("PUT", $"/api/projects/{ProjectA2}/muhasebe", Send));
        // A new row for ALFA; BETA's row with the same TD number is unchanged.
        Assert.Equal(1L, await api.ScalarAsync<long>(
            "SELECT count(*) FROM takip_projeler WHERE td_no = $1 AND company_id = $2 AND fiyat = 1000", TdA2, CompanyA));
        Assert.Null(await api.ScalarAsync<decimal?>("SELECT fiyat FROM takip_projeler WHERE id = $1", TakipBOnTdA2));
        Assert.Equal(CompanyB, await api.ScalarAsync<Guid>("SELECT company_id FROM takip_projeler WHERE id = $1", TakipBOnTdA2));

        Assert.Equal(HttpStatusCode.NoContent, await alfa.SendAsync("DELETE", $"/api/projects/{ProjectA2}/muhasebe"));
        Assert.Equal(0L, await api.ScalarAsync<long>(
            "SELECT count(*) FROM takip_projeler WHERE td_no = $1 AND company_id = $2", TdA2, CompanyA));
        Assert.Equal(1L, await api.ScalarAsync<long>("SELECT count(*) FROM takip_projeler WHERE id = $1", TakipBOnTdA2));
    }

    [Fact]
    public async Task Posted_row_is_never_changed_or_removed()
    {
        var alfa = await api.As(CustomerA);

        Assert.Equal(HttpStatusCode.Conflict, await alfa.SendAsync("PUT", $"/api/projects/{ProjectA3}/muhasebe", Send));
        Assert.Null(await api.ScalarAsync<decimal?>("SELECT fiyat FROM takip_projeler WHERE id = $1", TakipPostedA3));

        Assert.Equal(HttpStatusCode.NoContent, await alfa.SendAsync("DELETE", $"/api/projects/{ProjectA3}/muhasebe"));
        Assert.Equal(1L, await api.ScalarAsync<long>("SELECT count(*) FROM takip_projeler WHERE id = $1", TakipPostedA3));
    }

    // Deleting a project takes its own unposted rows only.
    [Fact]
    public async Task Deleting_a_project_keeps_posted_and_foreign_rows()
    {
        var alfa = await api.As(CustomerA);
        var created = await alfa.PostAsJsonAsync("/api/projects", CrossCompanyTests.ProjectInput(CompanyA, "SILINECEK"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await created.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        var id = body.GetProperty("id").GetGuid();
        var td = body.GetProperty("tdNo").GetString()!;

        Assert.Equal(HttpStatusCode.OK, await alfa.SendAsync("PUT", $"/api/projects/{id}/muhasebe", Send));
        // Staff gave a row with this TD number to BETA earlier: it must survive the delete.
        await api.ExecAsync("""
            INSERT INTO takip_projeler (proje_no, proje_tipi, company_id, td_no) VALUES (90100, 'uygulama', $1, $2)
            """, CompanyB, td);

        Assert.Equal(HttpStatusCode.NoContent, await alfa.SendAsync("DELETE", $"/api/projects/{id}"));
        Assert.Equal(0L, await api.ScalarAsync<long>("SELECT count(*) FROM projects WHERE id = $1", id));
        Assert.Equal(0L, await api.ScalarAsync<long>("SELECT count(*) FROM takip_projeler WHERE td_no = $1 AND company_id = $2", td, CompanyA));
        Assert.Equal(1L, await api.ScalarAsync<long>("SELECT count(*) FROM takip_projeler WHERE td_no = $1 AND company_id = $2", td, CompanyB));
    }

    // The client cannot pick the TD number (KRR-013 td_no path): it is not part of the input.
    [Fact]
    public async Task Td_number_cannot_be_set_by_the_client()
    {
        var alfa = await api.As(CustomerA);
        Assert.Equal(HttpStatusCode.OK, await alfa.SendAsync("PUT", $"/api/projects/{ProjectA}",
            new { companyId = CompanyA, dosyaNo = "ALFA-1", makineMuhendisId = EngineerA, tdNo = TdB, inputData = new { } }));
        Assert.Equal(TdA, await api.ScalarAsync<string>("SELECT td_no FROM projects WHERE id = $1", ProjectA));

        var created = await alfa.PostAsJsonAsync("/api/projects", new { companyId = CompanyA, dosyaNo = "TD-SECME", tdNo = TdB });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var td = (await created.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>()).GetProperty("tdNo").GetString();
        Assert.NotEqual(TdB, td);
    }
}
