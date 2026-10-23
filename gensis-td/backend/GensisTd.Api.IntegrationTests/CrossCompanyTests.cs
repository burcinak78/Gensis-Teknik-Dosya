using System.Net;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// A customer of ALFA against BETA's rows (KORUR, ADR-003 review): another company's row answers 404 like a
/// missing one, a write into another company 403, and nothing in the database changes.
/// </summary>
[Collection(ApiCollection.Name)]
public class CrossCompanyTests(ApiFixture api)
{
    public static TheoryData<string> OtherCompanyReads => new()
    {
        $"/api/projects/{ProjectB}",
        $"/api/projects/{ProjectB}/equipment",
        $"/api/projects/{ProjectB}/render-context", // KRR-011
        $"/api/projects/{ProjectB}/pdf-source",
        $"/api/projects/{ProjectB}/pdf-source/file?bucket=documents&path={FileBPath}",
        $"/api/projects/{ProjectB}/muhasebe",
        $"/api/projects/{ProjectB}/files",
        $"/api/files/project/{FileB}",
        $"/api/files/company/{CompanyDocB}",
        $"/api/files/engineer/{EngineerDocB}",
        $"/api/catalog/companies/{CompanyB}", // KRR-014
        $"/api/proje-onay/{OnayB}",
        $"/api/proje-onay/{OnayB}/file?kind=logo",
        $"/api/proje-onay/{OnayB}/file?kind=imza_makine",
    };

    [Theory, MemberData(nameof(OtherCompanyReads))]
    public async Task Other_company_rows_read_as_missing(string path)
    {
        var alfa = await api.As(CustomerA);
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("GET", path));
    }

    // The same routes on the user's own rows work, so the 404s above come from the access rule.
    public static TheoryData<string, HttpStatusCode> OwnCompanyReads => new()
    {
        { $"/api/projects/{ProjectA}", HttpStatusCode.OK },
        { $"/api/projects/{ProjectA}/equipment", HttpStatusCode.OK },
        { $"/api/projects/{ProjectA}/render-context", HttpStatusCode.OK }, // app role may execute it (KRR-016)
        { $"/api/projects/{ProjectA}/pdf-source", HttpStatusCode.OK },
        { $"/api/projects/{ProjectA}/pdf-source/file?bucket=documents&path={FileAPath}", HttpStatusCode.OK },
        { $"/api/projects/{ProjectA}/muhasebe", HttpStatusCode.OK },
        { $"/api/projects/{ProjectA}/files", HttpStatusCode.OK },
        { $"/api/files/project/{FileA}", HttpStatusCode.Redirect },
        { $"/api/files/company/{CompanyDocA}", HttpStatusCode.Redirect },
        { $"/api/files/engineer/{EngineerDocA}", HttpStatusCode.Redirect },
        { $"/api/catalog/companies/{CompanyA}", HttpStatusCode.OK },
        { $"/api/proje-onay/{OnayA}", HttpStatusCode.OK },
        { $"/api/proje-onay/{OnayA}/file?kind=logo", HttpStatusCode.OK },
    };

    [Theory, MemberData(nameof(OwnCompanyReads))]
    public async Task Own_company_rows_are_readable(string path, HttpStatusCode expected)
    {
        var alfa = await api.As(CustomerA);
        Assert.Equal(expected, await alfa.SendAsync("GET", path));
    }

    // pdf-source/file serves only files that belong to the project: not another company's, even with a known path.
    [Theory]
    [InlineData(FileBPath)]
    [InlineData(CompanyDocBPath)]
    [InlineData(EngineerDocBPath)]
    public async Task Pdf_source_file_rejects_paths_outside_the_project(string path)
    {
        var alfa = await api.As(CustomerA);
        Assert.Equal(HttpStatusCode.NotFound,
            await alfa.SendAsync("GET", $"/api/projects/{ProjectA}/pdf-source/file?bucket=documents&path={path}"));
    }

    [Fact]
    public async Task Lists_hold_only_own_company_rows()
    {
        var alfa = await api.As(CustomerA);

        var projects = (await alfa.JsonAsync("/api/projects")).Ids();
        Assert.Contains(ProjectA.ToString(), projects);
        Assert.DoesNotContain(ProjectB.ToString(), projects);

        var onay = (await alfa.JsonAsync("/api/proje-onay")).Ids();
        Assert.Contains(OnayA.ToString(), onay);
        Assert.DoesNotContain(OnayB.ToString(), onay);

        Assert.Equal([CompanyA.ToString()], (await alfa.JsonAsync("/api/catalog/companies")).Ids());
        Assert.Equal([CompanyDocA.ToString()], (await alfa.JsonAsync("/api/catalog/company-documents")).Ids());
        Assert.Empty((await alfa.JsonAsync("/api/catalog/engineer-documents")).EnumerateArray());

        // Wizard picker: own engineers and Gensis's, never BETA's (KRR-014, KRR-021).
        var picker = (await alfa.JsonAsync("/api/catalog/engineers")).GetProperty("engineers").Ids();
        Assert.Equal(new[] { EngineerA.ToString(), EngineerGensis.ToString() }.Order(), picker.Order());

        // Management screen: own engineers only.
        Assert.Equal([EngineerA.ToString()], (await alfa.JsonAsync("/api/engineers")).Ids());
        Assert.Equal([EngineerDocA.ToString()], (await alfa.JsonAsync("/api/engineers/documents")).Ids());

        var notes = (await alfa.JsonAsync("/api/notes")).Ids();
        Assert.Equal([NoteA.ToString()], notes);
    }

    [Fact]
    public async Task Other_company_project_cannot_be_changed_or_deleted()
    {
        var alfa = await api.As(CustomerA);
        var input = ProjectInput(CompanyA, "ELE-GECIRME");

        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("PUT", $"/api/projects/{ProjectB}", input));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("DELETE", $"/api/projects/{ProjectB}"));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("PUT", $"/api/projects/{ProjectB}/muhasebe",
            new { fiyat = 100, faturaTipi = "faturali", teslimTipi = "dijital" }));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("DELETE", $"/api/projects/{ProjectB}/muhasebe"));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("POST", $"/api/projects/{ProjectB}/files/upload-url",
            new { kind = "fatura", fileName = "x.pdf" }));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("DELETE", $"/api/projects/{ProjectB}/files/{FileB}"));
        // Own project id with another project's file id.
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("DELETE", $"/api/projects/{ProjectA}/files/{FileB}"));

        Assert.Equal("BETA-1", await api.ScalarAsync<string>("SELECT dosya_no FROM projects WHERE id = $1", ProjectB));
        Assert.Equal(CompanyB, await api.ScalarAsync<Guid>("SELECT company_id FROM projects WHERE id = $1", ProjectB));
        Assert.Equal(1L, await api.ScalarAsync<long>("SELECT count(*) FROM project_files WHERE id = $1", FileB));
        // BETA's own takip row for its project is untouched.
        Assert.Equal(1L, await api.ScalarAsync<long>(
            "SELECT count(*) FROM takip_projeler WHERE id = $1 AND fiyat IS NULL", TakipB));
    }

    [Fact]
    public async Task Projects_cannot_be_written_into_another_company()
    {
        var alfa = await api.As(CustomerA);

        Assert.Equal(HttpStatusCode.Forbidden, await alfa.SendAsync("POST", "/api/projects", ProjectInput(CompanyB, "ALFA-ICIN-BETA")));
        Assert.Equal(0L, await api.ScalarAsync<long>("SELECT count(*) FROM projects WHERE dosya_no = 'ALFA-ICIN-BETA'"));

        // Moving an own project to BETA (RLS WITH CHECK).
        Assert.Equal(HttpStatusCode.Forbidden, await alfa.SendAsync("PUT", $"/api/projects/{ProjectA}", ProjectInput(CompanyB, "TASI")));
        Assert.Equal(CompanyA, await api.ScalarAsync<Guid>("SELECT company_id FROM projects WHERE id = $1", ProjectA));

        Assert.Equal(HttpStatusCode.Forbidden, await alfa.SendAsync("POST", "/api/proje-onay", new { companyId = CompanyB }));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("PUT", $"/api/proje-onay/{OnayB}", new { companyId = CompanyA }));
        Assert.Equal(CompanyB, await api.ScalarAsync<Guid>("SELECT company_id FROM proje_onay WHERE id = $1", OnayB));
    }

    // KRR-021: a müellif engineer is the project's company's or Gensis's.
    [Fact]
    public async Task Project_engineer_must_be_own_or_gensis()
    {
        var alfa = await api.As(CustomerA);

        Assert.Equal(HttpStatusCode.BadRequest, await alfa.SendAsync("POST", "/api/projects",
            ProjectInput(CompanyA, "MUH-BETA", makine: EngineerB)));
        Assert.Equal(HttpStatusCode.BadRequest, await alfa.SendAsync("PUT", $"/api/projects/{ProjectA}",
            ProjectInput(CompanyA, "ALFA-1", makine: EngineerA, elektrik: EngineerB)));
        Assert.Equal(EngineerA, await api.ScalarAsync<Guid>("SELECT makine_muhendis_id FROM projects WHERE id = $1", ProjectA));
        Assert.Null(await api.ScalarAsync<Guid?>("SELECT elektrik_muhendis_id FROM projects WHERE id = $1", ProjectA));

        Assert.Equal(HttpStatusCode.BadRequest, await alfa.SendAsync("POST", "/api/proje-onay",
            new { companyId = CompanyA, makineMuhendisId = EngineerB }));

        Assert.Equal(HttpStatusCode.Created, await alfa.SendAsync("POST", "/api/projects",
            ProjectInput(CompanyA, "MUH-GENSIS", makine: EngineerA, elektrik: EngineerGensis)));
    }

    [Fact]
    public async Task Other_company_and_its_engineers_cannot_be_edited()
    {
        var alfa = await api.As(CustomerA);
        var pendingBefore = await api.ScalarAsync<long>("SELECT count(*) FROM pending_changes");

        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("PUT", $"/api/companies/{CompanyB}",
            new { shortName = "ELE", legalName = "Ele Geçirildi" }));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("POST", $"/api/companies/{CompanyB}/documents/upload-url",
            new { docType = "logo", fileName = "x.png" }));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("POST", $"/api/companies/{CompanyB}/documents",
            new { docType = "logo" }));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("PUT", $"/api/engineers/{EngineerB}",
            new { fullName = "Ele Geçirildi", discipline = "makine" }));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("POST", $"/api/engineers/{EngineerB}/documents/upload-url",
            new { docType = "imza", fileName = "x.png" }));

        Assert.Equal(pendingBefore, await api.ScalarAsync<long>("SELECT count(*) FROM pending_changes"));
        Assert.Equal("BETA", await api.ScalarAsync<string>("SELECT short_name FROM companies WHERE id = $1", CompanyB));
    }

    // A customer's new engineer request goes to their own company whatever the form says.
    [Fact]
    public async Task New_engineer_request_is_filed_under_own_company()
    {
        var alfa = await api.As(CustomerA);
        Assert.Equal(HttpStatusCode.OK, await alfa.SendAsync("POST", "/api/engineers",
            new { fullName = "Yeni Mühendis", discipline = "makine", companyId = CompanyB }));
        Assert.Equal(CompanyA, await api.ScalarAsync<Guid>(
            "SELECT company_id FROM pending_changes WHERE kind = 'engineer_new' AND submitted_by = $1", UserCustomerA));
    }

    [Fact]
    public async Task Other_users_notes_cannot_be_touched()
    {
        var alfa = await api.As(CustomerA);
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("POST", $"/api/notes/{NoteB}/snooze"));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("DELETE", $"/api/notes/{NoteB}"));
        Assert.Equal(1L, await api.ScalarAsync<long>("SELECT count(*) FROM notlar WHERE id = $1", NoteB));
    }

    internal static object ProjectInput(Guid companyId, string dosyaNo, Guid? makine = null, Guid? elektrik = null) => new
    {
        companyId, dosyaNo, makineMuhendisId = makine, elektrikMuhendisId = elektrik, inputData = new { },
    };
}
