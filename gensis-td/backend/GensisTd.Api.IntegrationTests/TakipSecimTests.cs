using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// TD wizard "Proje No" from Proje Takip (z8qgvcc7xf): which completed jobs each role may pick, their linked
/// documents, and the projects.takip_id link (same company only). Customers only see jobs of their own company,
/// not jobs where they are the montaj firm (user decision 2026-11-06).
/// </summary>
[Collection(ApiCollection.Name)]
public class TakipSecimTests(ApiFixture api)
{
    private static int _no = 70000;

    /// <summary>A takip row; returns its id. Every test makes its own rows with fresh numbers.</summary>
    private async Task<Guid> JobAsync(Guid company, string durum = "TAMAMLANDI", Guid? parent = null, Guid? montaj = null,
        int? asansorSayisi = 2, string? districtId = null)
    {
        var id = Guid.NewGuid();
        await api.ExecAsync("""
            INSERT INTO takip_projeler (id, proje_no, proje_tipi, company_id, montaj_firma_id, durum, parent_id, asansor_sayisi,
                is_adi, ada, parsel, province_id, district_id, fiyat, bekliyor_aciklama)
            VALUES ($1, $2, 'uygulama', $3, $4, $5, $6, $7, 'Bina', '101', '5', 34, $8, 12345, 'iç not')
            """, id, Interlocked.Increment(ref _no), company, (object?)montaj ?? DBNull.Value, durum, (object?)parent ?? DBNull.Value,
            (object?)asansorSayisi ?? DBNull.Value, (object?)districtId ?? DBNull.Value);
        return id;
    }

    private async Task<Guid> DocAsync(Guid takip, string kind, DateTime? at = null)
    {
        var id = Guid.NewGuid();
        await api.ExecAsync("INSERT INTO takip_dokumanlar (id, takip_id, kind, storage_path, original_name, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
            id, takip, kind, $"takip/{takip}/{kind}-{id}.pdf", $"{kind}.pdf", at ?? DateTime.UtcNow);
        return id;
    }

    private static async Task<List<JsonElement>> ListAsync(HttpClient c) =>
        (await c.JsonAsync("/api/takip-secim")).EnumerateArray().ToList();

    private static JsonElement? Find(List<JsonElement> rows, Guid id) =>
        rows.Where(r => r.GetProperty("id").GetGuid() == id).Select(r => (JsonElement?)r).FirstOrDefault();

    private static object Td(Guid company, Guid? takipId) =>
        new { companyId = company, dosyaNo = $"TS-{Guid.NewGuid():N}", inputData = new { }, takipId };

    private static async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(HttpClient c, string path, object body)
    {
        using var res = await c.PostAsJsonAsync(path, body);
        var text = await res.Content.ReadAsStringAsync();
        Assert.True((int)res.StatusCode < 500, text);
        return (res.StatusCode, text.Length == 0 ? default : JsonDocument.Parse(text).RootElement.Clone());
    }

    [Fact]
    public async Task Customer_sees_only_completed_jobs_of_own_company()
    {
        var own = await JobAsync(CompanyA);
        var other = await JobAsync(CompanyB);
        var montajOnly = await JobAsync(CompanyB, montaj: CompanyA);
        var open = await JobAsync(CompanyA, durum: "HAZIRLANIYOR");
        var revision = await JobAsync(CompanyA, parent: own);

        var rows = await ListAsync(await api.As(CustomerA));
        Assert.NotNull(Find(rows, own));
        Assert.Null(Find(rows, other));
        Assert.Null(Find(rows, montajOnly));
        Assert.Null(Find(rows, open));
        Assert.Null(Find(rows, revision));
        Assert.All(rows, r => Assert.Equal(CompanyA, r.GetProperty("companyId").GetGuid()));

        // Internal Proje Takip data never goes out on this route.
        var row = Find(rows, own)!.Value;
        foreach (var hidden in new[] { "fiyat", "toplamTutar", "bekliyorAciklama", "projeSorumlusuId", "muhasebeDurumu", "createdBy" })
            Assert.False(row.TryGetProperty(hidden, out _), hidden);

        var staffRows = await ListAsync(await api.As(Staff));
        Assert.NotNull(Find(staffRows, own));
        Assert.NotNull(Find(staffRows, other));
        Assert.Null(Find(staffRows, open));
    }

    [Theory]
    [InlineData(Muhasebeci)]
    [InlineData(NoCompany)]
    public async Task Non_staff_outside_the_company_do_not_see_its_jobs(string user)
    {
        var job = await JobAsync(CompanyA);
        Assert.Null(Find(await ListAsync(await api.As(user)), job));
    }

    [Fact]
    public async Task Anonymous_is_rejected()
    {
        using var anon = api.Anonymous();
        Assert.Equal(HttpStatusCode.Unauthorized, await anon.SendAsync("GET", "/api/takip-secim"));
    }

    [Fact]
    public async Task Documents_include_revisions_and_the_newest_single_file()
    {
        var job = await JobAsync(CompanyA, districtId: "not-a-guid");
        var oldPermit = await DocAsync(job, "yapi_ruhsati", DateTime.UtcNow.AddDays(-2));
        var other1 = await DocAsync(job, "diger", DateTime.UtcNow.AddDays(-2));
        var revision = await JobAsync(CompanyA, parent: job);
        var newPermit = await DocAsync(revision, "yapi_ruhsati");
        var other2 = await DocAsync(revision, "diger");

        var row = Find(await ListAsync(await api.As(CustomerA)), job)!.Value;
        var docs = row.GetProperty("docs").Ids();
        Assert.Contains(newPermit.ToString(), docs);
        Assert.DoesNotContain(oldPermit.ToString(), docs);
        Assert.Contains(other1.ToString(), docs);
        Assert.Contains(other2.ToString(), docs);
        // A district that is not an id comes back empty; the wizard then matches by name.
        Assert.Equal(JsonValueKind.Null, row.GetProperty("districtId").ValueKind);
    }

    [Fact]
    public async Task Document_opens_only_for_who_may_pick_the_job()
    {
        var jobA = await JobAsync(CompanyA);
        var docA = await DocAsync(jobA, "mimari_proje");
        var revDoc = await DocAsync(await JobAsync(CompanyA, parent: jobA), "revize_proje");
        var docB = await DocAsync(await JobAsync(CompanyB), "mimari_proje");
        var docOpen = await DocAsync(await JobAsync(CompanyA, durum: "BEKLIYOR"), "mimari_proje");

        var alfa = await api.As(CustomerA);
        Assert.Equal(HttpStatusCode.Redirect, await alfa.SendAsync("GET", $"/api/files/takip-secim/{docA}"));
        Assert.Equal(HttpStatusCode.Redirect, await alfa.SendAsync("GET", $"/api/files/takip-secim/{revDoc}"));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("GET", $"/api/files/takip-secim/{docB}"));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("GET", $"/api/files/takip-secim/{docOpen}"));
        Assert.Equal(HttpStatusCode.NotFound, await (await api.As(Muhasebeci)).SendAsync("GET", $"/api/files/takip-secim/{docA}"));
        Assert.Equal(HttpStatusCode.Redirect, await (await api.As(Staff)).SendAsync("GET", $"/api/files/takip-secim/{docB}"));
        // The office-only route stays closed to customers.
        Assert.Equal(HttpStatusCode.Forbidden, await alfa.SendAsync("GET", $"/api/files/takip/{docA}"));
    }

    [Fact]
    public async Task Customer_links_own_job_and_the_count_goes_up()
    {
        var job = await JobAsync(CompanyA);
        var alfa = await api.As(CustomerA);

        var (status, body) = await PostAsync(alfa, "/api/projects", Td(CompanyA, job));
        Assert.Equal(HttpStatusCode.Created, status);
        var project = body.GetProperty("id").GetGuid();
        Assert.Equal(job, (await alfa.JsonAsync($"/api/projects/{project}")).GetProperty("takipId").GetGuid());
        Assert.Equal(1, Find(await ListAsync(alfa), job)!.Value.GetProperty("linkedTdCount").GetInt32());

        // More TDs than lifts is allowed (the wizard warns).
        for (var i = 0; i < 2; i++) Assert.Equal(HttpStatusCode.Created, (await PostAsync(alfa, "/api/projects", Td(CompanyA, job))).Status);
        Assert.Equal(3, Find(await ListAsync(alfa), job)!.Value.GetProperty("linkedTdCount").GetInt32());
    }

    [Fact]
    public async Task Link_to_a_job_that_may_not_be_picked_is_rejected()
    {
        var alfa = await api.As(CustomerA);
        var staff = await api.As(Staff);
        var jobA = await JobAsync(CompanyA);
        var jobB = await JobAsync(CompanyB);

        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(alfa, "/api/projects", Td(CompanyA, jobB))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(alfa, "/api/projects", Td(CompanyA, await JobAsync(CompanyA, durum: "HAZIRLANIYOR")))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(alfa, "/api/projects", Td(CompanyA, await JobAsync(CompanyA, parent: jobA)))).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(alfa, "/api/projects", Td(CompanyA, Guid.NewGuid()))).Status);
        // Staff may pick any job, but only for the job's own company.
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(staff, "/api/projects", Td(CompanyB, jobA))).Status);
        Assert.Equal(HttpStatusCode.Created, (await PostAsync(staff, "/api/projects", Td(CompanyA, jobA))).Status);
        // Without a link nothing changes for older files.
        Assert.Equal(HttpStatusCode.Created, (await PostAsync(alfa, "/api/projects", Td(CompanyA, null))).Status);
    }

    [Fact]
    public async Task Update_keeps_the_link_but_not_across_companies()
    {
        var staff = await api.As(Staff);
        var job = await JobAsync(CompanyA);
        var (_, body) = await PostAsync(staff, "/api/projects", Td(CompanyA, job));
        var project = body.GetProperty("id").GetGuid();

        var same = new { companyId = CompanyA, dosyaNo = $"TS-{Guid.NewGuid():N}", inputData = new { }, takipId = job };
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/projects/{project}", same));
        Assert.Equal(HttpStatusCode.BadRequest, await staff.SendAsync("PUT", $"/api/projects/{project}",
            new { companyId = CompanyB, dosyaNo = $"TS-{Guid.NewGuid():N}", inputData = new { }, takipId = job }));
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/projects/{project}",
            new { companyId = CompanyA, dosyaNo = $"TS-{Guid.NewGuid():N}", inputData = new { }, takipId = (Guid?)null }));
        Assert.Null(await api.ScalarAsync<Guid?>("SELECT takip_id FROM projects WHERE id = $1", project));
    }

    [Fact]
    public async Task Deleting_the_job_leaves_the_file_unlinked()
    {
        var staff = await api.As(Staff);
        var job = await JobAsync(CompanyA);
        var (_, body) = await PostAsync(staff, "/api/projects", Td(CompanyA, job));
        var project = body.GetProperty("id").GetGuid();

        await api.ExecAsync("DELETE FROM takip_projeler WHERE id = $1", job);
        Assert.Null(await api.ScalarAsync<Guid?>("SELECT takip_id FROM projects WHERE id = $1", project));
    }

    [Fact]
    public async Task Pdf_uses_the_linked_permit_only_without_an_own_one()
    {
        var alfa = await api.As(CustomerA);
        var job = await JobAsync(CompanyA);
        await DocAsync(job, "yapi_ruhsati");
        var permitPath = await api.ScalarAsync<string>("SELECT storage_path FROM takip_dokumanlar WHERE takip_id = $1", job);
        var (_, body) = await PostAsync(alfa, "/api/projects", Td(CompanyA, job));
        var project = body.GetProperty("id").GetGuid();

        static List<string> Permits(JsonElement src) => src.GetProperty("projectFiles").EnumerateArray()
            .Where(f => f.GetProperty("kind").GetString() == "yapi_ruhsati").Select(f => f.GetProperty("path").GetString()!).ToList();

        Assert.Equal([permitPath!], Permits(await alfa.JsonAsync($"/api/projects/{project}/pdf-source")));
        var file = $"/api/projects/{project}/pdf-source/file?bucket=documents&path={Uri.EscapeDataString(permitPath!)}";
        await api.PutObjectAsync(permitPath!, "%PDF-1.4"u8.ToArray());
        Assert.Equal(HttpStatusCode.OK, await alfa.SendAsync("GET", file));

        // Another company's user cannot reach it through the project.
        Assert.Equal(HttpStatusCode.NotFound, await (await api.As(CustomerB)).SendAsync("GET", file));

        // The file's own permit wins; the linked one is then neither listed nor served.
        await api.ExecAsync("INSERT INTO project_files (project_id, kind, storage_path) VALUES ($1, 'yapi_ruhsati', $2)",
            project, $"proje/{project}/yapi_ruhsati-own.pdf");
        Assert.Equal([$"proje/{project}/yapi_ruhsati-own.pdf"], Permits(await alfa.JsonAsync($"/api/projects/{project}/pdf-source")));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("GET", file));

        // Job moved to another company later: its permit no longer goes into this file.
        await api.ExecAsync("DELETE FROM project_files WHERE project_id = $1", project);
        await api.ExecAsync("UPDATE takip_projeler SET company_id = $1 WHERE id = $2", CompanyB, job);
        Assert.Empty(Permits(await alfa.JsonAsync($"/api/projects/{project}/pdf-source")));
    }

    // ---------- "ATD Belgeler" on the Proje Takip edit screen (z8qgvcc816) ----------

    private async Task<Guid> LinkedTdAsync(Guid company, Guid job, string? seri = null)
    {
        var (status, body) = await PostAsync(await api.As(Staff), "/api/projects",
            new { companyId = company, dosyaNo = $"ATD-{Guid.NewGuid():N}", inputData = new { asansor_seri_no = seri }, takipId = job });
        Assert.Equal(HttpStatusCode.Created, status);
        return body.GetProperty("id").GetGuid();
    }

    [Fact]
    public async Task Linked_files_of_the_job_and_of_its_revisions_root()
    {
        var staff = await api.As(Staff);
        var job = await JobAsync(CompanyA);
        var revision = await JobAsync(CompanyA, parent: job);
        var first = await LinkedTdAsync(CompanyA, job, "SN-1");
        var second = await LinkedTdAsync(CompanyA, job);
        await LinkedTdAsync(CompanyA, await JobAsync(CompanyA)); // another job's file

        var list = await staff.JsonAsync($"/api/takip/{job}/teknik-dosyalar");
        Assert.Equal([first.ToString(), second.ToString()], list.Ids());
        Assert.Equal("SN-1", list[0].GetProperty("asansorSeriNo").GetString());
        Assert.Equal(JsonValueKind.Null, list[1].GetProperty("asansorSeriNo").ValueKind);
        Assert.StartsWith("TD-", list[0].GetProperty("tdNo").GetString());
        Assert.Equal(list.Ids(), (await staff.JsonAsync($"/api/takip/{revision}/teknik-dosyalar")).Ids());

        Assert.Empty((await staff.JsonAsync($"/api/takip/{await JobAsync(CompanyA)}/teknik-dosyalar")).EnumerateArray());
        Assert.Equal(HttpStatusCode.NotFound, await staff.SendAsync("GET", $"/api/takip/{Guid.NewGuid()}/teknik-dosyalar"));
    }

    [Fact]
    public async Task Linked_files_follow_proje_takip_and_project_access()
    {
        var job = await JobAsync(CompanyA);
        await LinkedTdAsync(CompanyA, job);
        var path = $"/api/takip/{job}/teknik-dosyalar";

        Assert.Equal(HttpStatusCode.Forbidden, await (await api.As(CustomerA)).SendAsync("GET", path));
        using var anon = api.Anonymous();
        Assert.Equal(HttpStatusCode.Unauthorized, await anon.SendAsync("GET", path));
        // The accountant reads Proje Takip but opens only its own company's files: ALFA's file is not offered.
        Assert.Empty((await (await api.As(Muhasebeci)).JsonAsync(path)).EnumerateArray());
        Assert.Single((await (await api.As(Admin)).JsonAsync(path)).EnumerateArray());
    }
}
