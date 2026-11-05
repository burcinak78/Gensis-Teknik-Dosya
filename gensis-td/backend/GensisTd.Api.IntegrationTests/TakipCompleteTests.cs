using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// Completing a Proje Takip job: the form is saved with PUT first, then /complete sends the job to accounting and
/// must keep what was saved (z8qgvcbyfh). Staff only; the finished project has to be uploaded.
/// </summary>
[Collection(ApiCollection.Name)]
public class TakipCompleteTests(ApiFixture api)
{
    private static readonly object Complete = new { tamamlanmaTarihi = "2026-11-05", teslimTipi = "dijital" };

    private static object Input(string? isAdi = null, string? ada = null, string? seriNo = null) => new
    {
        projeTipi = "mimari", companyId = CompanyA, faturaTipi = "faturasiz", tahminiTamamlanma = "2030-01-01",
        isAdi, ada, asansorSeriNo = seriNo,
    };

    private async Task<Guid> NewJobAsync(HttpClient staff)
    {
        var res = await staff.PostAsJsonAsync("/api/takip", Input());
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private Task AddFinishedProjectAsync(Guid id) => api.ExecAsync(
        "INSERT INTO takip_dokumanlar (takip_id, kind, storage_path) VALUES ($1, 'tamamlanan_proje', $2)", id, $"takip/{id}/bitti.dwg");

    [Fact]
    public async Task Values_saved_before_completing_are_kept()
    {
        var staff = await api.As(Staff);
        var id = await NewJobAsync(staff);
        await AddFinishedProjectAsync(id);

        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/takip/{id}", Input("Bina", "101", "SN-1")));
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("POST", $"/api/takip/{id}/complete", Complete));

        var row = (await staff.JsonAsync($"/api/takip/{id}")).GetProperty("row");
        Assert.Equal("TAMAMLANDI", row.GetProperty("durum").GetString());
        Assert.True(row.GetProperty("muhasebeyeGonderildi").GetBoolean());
        Assert.Equal("Bina", row.GetProperty("isAdi").GetString());
        Assert.Equal("101", row.GetProperty("ada").GetString());
        Assert.Equal("SN-1", row.GetProperty("asansorSeriNo").GetString());
    }

    [Fact]
    public async Task Completed_job_can_still_be_updated()
    {
        var staff = await api.As(Staff);
        var id = await NewJobAsync(staff);
        await AddFinishedProjectAsync(id);
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("POST", $"/api/takip/{id}/complete", Complete));

        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/takip/{id}", Input("Sonradan")));

        var row = (await staff.JsonAsync($"/api/takip/{id}")).GetProperty("row");
        Assert.Equal("Sonradan", row.GetProperty("isAdi").GetString());
        Assert.Equal("TAMAMLANDI", row.GetProperty("durum").GetString());
    }

    [Fact]
    public async Task Update_saves_completion_details_without_completing()
    {
        var staff = await api.As(Staff);
        var id = await NewJobAsync(staff);

        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/takip/{id}", new
        {
            projeTipi = "mimari", companyId = CompanyA, faturaTipi = "faturasiz", tahminiTamamlanma = "2030-01-01",
            tamamlanmaTarihi = "2026-11-03", teslimTipi = "hard_copy", hardCopyAdedi = 3,
        }));

        var row = (await staff.JsonAsync($"/api/takip/{id}")).GetProperty("row");
        Assert.Equal("HAZIRLANIYOR", row.GetProperty("durum").GetString());
        Assert.False(row.GetProperty("muhasebeyeGonderildi").GetBoolean());
        Assert.Equal("2026-11-03", row.GetProperty("tamamlanmaTarihi").GetString());
        Assert.Equal("hard_copy", row.GetProperty("teslimTipi").GetString());
        Assert.Equal(3, row.GetProperty("hardCopyAdedi").GetInt32());
    }

    [Fact]
    public async Task Update_cannot_change_the_details_of_a_completed_job()
    {
        var staff = await api.As(Staff);
        var id = await NewJobAsync(staff);
        await AddFinishedProjectAsync(id);
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("POST", $"/api/takip/{id}/complete", Complete));

        // The form does not send them for a completed job, and a client that does (or omits them) changes nothing.
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/takip/{id}", Input("Sonradan")));
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/takip/{id}", new
        {
            projeTipi = "mimari", companyId = CompanyA, faturaTipi = "faturasiz", tamamlanmaTarihi = "2020-01-01", teslimTipi = "hard_copy", hardCopyAdedi = 9,
        }));

        var row = (await staff.JsonAsync($"/api/takip/{id}")).GetProperty("row");
        Assert.Equal("2026-11-05", row.GetProperty("tamamlanmaTarihi").GetString());
        Assert.Equal("dijital", row.GetProperty("teslimTipi").GetString());
        Assert.Equal(JsonValueKind.Null, row.GetProperty("hardCopyAdedi").ValueKind);
    }

    // Older records have the names without ids; the form sends them back and they must stay.
    [Fact]
    public async Task Province_and_district_names_without_ids_are_kept()
    {
        var staff = await api.As(Staff);
        var id = await NewJobAsync(staff);

        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/takip/{id}", new
        {
            projeTipi = "mimari", companyId = CompanyA, faturaTipi = "faturasiz", ilAdi = "Eski İl", ilceAdi = "Eski İlçe",
        }));

        var row = (await staff.JsonAsync($"/api/takip/{id}")).GetProperty("row");
        Assert.Equal("Eski İl", row.GetProperty("ilAdi").GetString());
        Assert.Equal("Eski İlçe", row.GetProperty("ilceAdi").GetString());
        Assert.Equal(JsonValueKind.Null, row.GetProperty("provinceId").ValueKind);
    }

    [Theory]
    [InlineData("kargo", null)]
    [InlineData("hard_copy", 0)]
    public async Task Update_rejects_invalid_completion_details(string teslimTipi, int? adet)
    {
        var staff = await api.As(Staff);
        var id = await NewJobAsync(staff);
        Assert.Equal(HttpStatusCode.BadRequest, await staff.SendAsync("PUT", $"/api/takip/{id}", new
        {
            projeTipi = "mimari", companyId = CompanyA, faturaTipi = "faturasiz", teslimTipi, hardCopyAdedi = adet,
        }));
    }

    [Fact]
    public async Task Completing_needs_the_finished_project()
    {
        var staff = await api.As(Staff);
        var id = await NewJobAsync(staff);

        Assert.Equal(HttpStatusCode.BadRequest, await staff.SendAsync("POST", $"/api/takip/{id}/complete", Complete));
        Assert.Equal("HAZIRLANIYOR", await api.ScalarAsync<string>("SELECT durum FROM takip_projeler WHERE id = $1", id));
    }

    [Fact]
    public async Task Only_staff_can_complete_and_td_rows_are_not_completed_here()
    {
        var staff = await api.As(Staff);
        var id = await NewJobAsync(staff);
        await AddFinishedProjectAsync(id);

        Assert.Equal(HttpStatusCode.Forbidden, await (await api.As(CustomerA)).SendAsync("POST", $"/api/takip/{id}/complete", Complete));
        Assert.Equal(HttpStatusCode.Forbidden, await (await api.As(Muhasebeci)).SendAsync("POST", $"/api/takip/{id}/complete", Complete));
        Assert.Equal("HAZIRLANIYOR", await api.ScalarAsync<string>("SELECT durum FROM takip_projeler WHERE id = $1", id));

        // A row a teknik dosya sent to accounting (with a TD number) is not a Proje Takip job.
        Assert.Equal(HttpStatusCode.NotFound, await staff.SendAsync("POST", $"/api/takip/{TakipB}/complete", Complete));
    }
}
