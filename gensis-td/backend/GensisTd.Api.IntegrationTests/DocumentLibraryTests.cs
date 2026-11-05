using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using GensisTd.Api.Storage;
using Microsoft.Extensions.DependencyInjection;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>Document library (z8qgvcc134): staff only, one default, pinned to new projects, served only through a choice.</summary>
[Collection(ApiCollection.Name)]
public class DocumentLibraryTests(ApiFixture api)
{
    private static readonly byte[] Pdf = Encoding.ASCII.GetBytes("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
    private const string Bakim = "bakim_sozlesmesi", SonKontrol = "son_kontrol_formu";

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(HttpClient c, string path, object body)
    {
        using var res = await c.PostAsJsonAsync(path, body);
        var text = await res.Content.ReadAsStringAsync();
        Assert.True((int)res.StatusCode < 500, text);
        return (res.StatusCode, text.Length == 0 ? default : JsonDocument.Parse(text).RootElement.Clone());
    }

    private async Task<string> IssueKeyAsync(Guid company, string docType)
    {
        var (status, body) = await PostAsync(await api.As(Staff), "/api/document-library/upload-url", new { companyId = company, docType, fileName = "x.exe" });
        Assert.Equal(HttpStatusCode.OK, status);
        return body.GetProperty("key").GetString()!;
    }

    private async Task<Guid> UploadAsync(Guid company, string docType, bool isDefault = false, string name = "belge.pdf")
    {
        var key = await IssueKeyAsync(company, docType);
        await api.PutObjectAsync(key, Pdf);
        var (status, body) = await PostAsync(await api.As(Staff), "/api/document-library", new { companyId = company, key, originalName = name, isDefault });
        Assert.Equal(HttpStatusCode.Created, status);
        return body.GetProperty("id").GetGuid();
    }

    private static object ProjectInput(Guid company, object? extra = null) =>
        new { companyId = company, dosyaNo = $"DL-{Guid.NewGuid():N}", inputData = extra ?? new { } };

    private async Task<Guid> NewProjectAsync(string creator, Guid company, object? input = null)
    {
        var (status, body) = await PostAsync(await api.As(creator), "/api/projects", input ?? ProjectInput(company));
        Assert.Equal(HttpStatusCode.Created, status);
        return body.GetProperty("id").GetGuid();
    }

    private Task<Guid?> ChosenAsync(Guid project, string docType) =>
        api.ScalarAsync<Guid?>("SELECT library_document_id FROM project_document_choices WHERE project_id = $1 AND doc_type = $2", project, docType);

    private Task ForgetDefaultsAsync() => api.ExecAsync("UPDATE document_library SET is_default = false");

    public static TheoryData<string, string> Readers => new()
    {
        { "GET", "/api/document-library" },
        { "POST", "/api/document-library/upload-url" },
        { "POST", "/api/document-library" },
        { "PUT", "/api/document-library/00000000-0000-4000-8000-000000000999" },
        { "DELETE", "/api/document-library/00000000-0000-4000-8000-000000000999" },
        { "GET", "/api/files/library/00000000-0000-4000-8000-000000000999" },
        { "GET", $"/api/projects/{ProjectA}/document-choices" },
        { "PUT", $"/api/projects/{ProjectA}/document-choices/{Bakim}" },
    };

    [Theory]
    [MemberData(nameof(Readers))]
    public async Task Customers_and_accountants_are_refused_everywhere(string method, string path)
    {
        object? body = method == "GET" || method == "DELETE" ? null : new { companyId = CompanyA, docType = Bakim, isDefault = true, libraryDocumentId = Guid.NewGuid() };
        Assert.Equal(HttpStatusCode.Forbidden, await (await api.As(CustomerA)).SendAsync(method, path, body));
        Assert.Equal(HttpStatusCode.Forbidden, await (await api.As(Muhasebeci)).SendAsync(method, path, body));
        Assert.Equal(HttpStatusCode.Unauthorized, await api.Anonymous().SendAsync(method, path, body));
    }

    [Theory]
    [InlineData(Admin)]
    [InlineData(Staff)]
    public async Task Admin_and_gensis_staff_can_delete(string who)
    {
        var doc = await UploadAsync(CompanyA, "seyir_defteri");
        using var client = await api.LoginAsync(who); // own session: another test class disposes the shared admin client
        Assert.Equal(HttpStatusCode.OK, await client.SendAsync("DELETE", $"/api/document-library/{doc}"));
        Assert.Equal(0L, await api.ScalarAsync<long>("SELECT count(*) FROM document_library WHERE id = $1", doc));
    }

    public static TheoryData<byte[], string> BadFiles => new()
    {
        { Encoding.ASCII.GetBytes("<html><script>alert(1)</script></html>"), "PDF" },
        { Encoding.ASCII.GetBytes("%PDF-1.7\ntrailer << /Encrypt 5 0 R >>"), "Şifreli" },
    };

    [Theory]
    [MemberData(nameof(BadFiles))]
    public async Task Bad_files_are_refused_and_removed(byte[] content, string message)
    {
        var key = await IssueKeyAsync(CompanyA, Bakim);
        await api.PutObjectAsync(key, content);
        var (status, body) = await PostAsync(await api.As(Staff), "/api/document-library", new { companyId = CompanyA, key, originalName = "x.pdf", isDefault = true });
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains(message, body.GetRawText());
        Assert.Null(await api.Services.GetRequiredService<StorageService>().SizeAsync("documents", key));
        Assert.Equal(0L, await api.ScalarAsync<long>("SELECT count(*) FROM document_library WHERE storage_path = $1", key));
    }

    [Fact]
    public async Task Too_large_file_is_refused_and_removed()
    {
        var key = await IssueKeyAsync(CompanyA, Bakim);
        var content = new byte[UploadKeys.MaxBytes + 1];
        Pdf.CopyTo(content, 0);
        await api.PutObjectAsync(key, content);
        var (status, _) = await PostAsync(await api.As(Staff), "/api/document-library", new { companyId = CompanyA, key, originalName = "x.pdf", isDefault = false });
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Null(await api.Services.GetRequiredService<StorageService>().SizeAsync("documents", key));
    }

    [Fact]
    public async Task Upload_needs_a_key_issued_for_that_company_and_a_known_type()
    {
        var staff = await api.As(Staff);
        var other = await IssueKeyAsync(CompanyB, Bakim);
        await api.PutObjectAsync(other, Pdf);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(staff, "/api/document-library", new { companyId = CompanyA, key = other, isDefault = false })).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(staff, "/api/document-library", new { companyId = CompanyA, key = FileAPath, isDefault = false })).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await PostAsync(staff, "/api/document-library/upload-url", new { companyId = CompanyA, docType = "kapak" })).Status);
        Assert.Equal(HttpStatusCode.NotFound, (await PostAsync(staff, "/api/document-library/upload-url", new { companyId = Guid.NewGuid(), docType = Bakim })).Status);
    }

    [Fact]
    public async Task Company_and_type_have_one_default()
    {
        await ForgetDefaultsAsync();
        var first = await UploadAsync(CompanyA, Bakim, isDefault: true);
        var second = await UploadAsync(CompanyA, Bakim, isDefault: true);
        const string sql = "SELECT is_default FROM document_library WHERE id = $1";
        Assert.False(await api.ScalarAsync<bool>(sql, first));
        Assert.True(await api.ScalarAsync<bool>(sql, second));

        Assert.Equal(HttpStatusCode.OK, await (await api.As(Staff)).SendAsync("PUT", $"/api/document-library/{first}", new { isDefault = true }));
        Assert.True(await api.ScalarAsync<bool>(sql, first));
        Assert.False(await api.ScalarAsync<bool>(sql, second));
        await Assert.ThrowsAnyAsync<Exception>(() => api.ExecAsync("UPDATE document_library SET is_default = true WHERE id = $1", second));
    }

    [Fact]
    public async Task New_project_pins_the_default_for_whoever_creates_it_and_later_defaults_do_not_touch_it()
    {
        await ForgetDefaultsAsync();
        var d1 = await UploadAsync(CompanyA, Bakim, isDefault: true);
        var byCustomer = await NewProjectAsync(CustomerA, CompanyA);
        var byStaff = await NewProjectAsync(Staff, CompanyA);
        Assert.Equal(d1, await ChosenAsync(byCustomer, Bakim));
        Assert.Equal(d1, await ChosenAsync(byStaff, Bakim));
        Assert.Null(await ChosenAsync(byStaff, "seyir_defteri"));

        var d2 = await UploadAsync(CompanyA, Bakim, isDefault: true);
        Assert.Equal(d1, await ChosenAsync(byStaff, Bakim));
        Assert.Equal(d2, await ChosenAsync(await NewProjectAsync(Staff, CompanyA), Bakim));
    }

    [Fact]
    public async Task Customer_cannot_choose_through_the_project_form()
    {
        await ForgetDefaultsAsync();
        var doc = await UploadAsync(CompanyA, "egitim_tutanagi");
        var customer = await api.As(CustomerA);
        var smuggled = new { companyId = CompanyA, dosyaNo = "DL-SMUGGLE", inputData = new { }, documentChoices = new[] { new { docType = "egitim_tutanagi", libraryDocumentId = doc } } };
        var project = await NewProjectAsync(CustomerA, CompanyA, smuggled);
        Assert.Null(await ChosenAsync(project, "egitim_tutanagi"));
        Assert.Equal(HttpStatusCode.OK, await customer.SendAsync("PUT", $"/api/projects/{project}", smuggled));
        Assert.Null(await ChosenAsync(project, "egitim_tutanagi"));
    }

    [Fact]
    public async Task Moving_a_project_resets_choices_to_the_new_companys_defaults()
    {
        await ForgetDefaultsAsync();
        var a = await UploadAsync(CompanyA, Bakim, isDefault: true);
        var manual = await UploadAsync(CompanyA, "seyir_defteri");
        var b = await UploadAsync(CompanyB, Bakim, isDefault: true);
        var project = await NewProjectAsync(Staff, CompanyA);
        var staff = await api.As(Staff);
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/projects/{project}/document-choices/seyir_defteri", new { libraryDocumentId = manual }));

        // Saving without moving leaves them alone.
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/projects/{project}", ProjectInput(CompanyA)));
        Assert.Equal(manual, await ChosenAsync(project, "seyir_defteri"));
        Assert.Equal(a, await ChosenAsync(project, Bakim));

        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/projects/{project}", ProjectInput(CompanyB)));
        Assert.Null(await ChosenAsync(project, "seyir_defteri"));
        Assert.Equal(b, await ChosenAsync(project, Bakim));
    }

    // KRR-034: the project and its accounting record stay exactly as they are.
    [Fact]
    public async Task Delivered_project_cannot_change_company_or_documents()
    {
        var staff = await api.As(Staff);
        var doc = await UploadAsync(CompanyA, Bakim);
        await api.ExecAsync("INSERT INTO project_document_choices (project_id, doc_type, library_document_id, updated_at) VALUES ($1, 'seyir_defteri', $2, now()) ON CONFLICT DO NOTHING", ProjectA3, await UploadAsync(CompanyA, "seyir_defteri"));
        var seyir = await ChosenAsync(ProjectA3, "seyir_defteri");
        const string rows = "SELECT count(*) FROM takip_projeler WHERE td_no = $1";
        var before = await api.ScalarAsync<long>(rows, TdA3);
        var status = await staff.JsonAsync($"/api/projects/{ProjectA3}/muhasebe");
        Assert.True(status.GetProperty("posted").GetBoolean());

        Assert.Equal(HttpStatusCode.Conflict, await staff.SendAsync("PUT", $"/api/projects/{ProjectA3}", ProjectInput(CompanyB)));

        Assert.Equal(CompanyA, await api.ScalarAsync<Guid>("SELECT company_id FROM projects WHERE id = $1", ProjectA3));
        Assert.True((await staff.JsonAsync($"/api/projects/{ProjectA3}/muhasebe")).GetProperty("posted").GetBoolean());
        Assert.Equal(before, await api.ScalarAsync<long>(rows, TdA3));
        Assert.Equal(seyir, await ChosenAsync(ProjectA3, "seyir_defteri"));
        Assert.Equal(HttpStatusCode.Conflict, await staff.SendAsync("PUT", $"/api/projects/{ProjectA3}/muhasebe", new { fiyat = 1m, faturaTipi = "faturali", teslimTipi = "dijital" }));

        Assert.Equal(HttpStatusCode.Conflict, await staff.SendAsync("PUT", $"/api/projects/{ProjectA3}/document-choices/{Bakim}", new { libraryDocumentId = doc }));
        Assert.Null(await ChosenAsync(ProjectA3, Bakim));
        Assert.True((await staff.JsonAsync($"/api/projects/{ProjectA3}/document-choices")).GetProperty("locked").GetBoolean());
    }

    [Fact]
    public async Task Choice_must_be_an_active_document_of_that_company_and_type()
    {
        await ForgetDefaultsAsync();
        var staff = await api.As(Staff);
        var project = await NewProjectAsync(Staff, CompanyA);
        var other = await UploadAsync(CompanyB, Bakim);
        var wrongType = await UploadAsync(CompanyA, "seyir_defteri");
        var archived = await UploadAsync(CompanyA, Bakim);
        await api.ExecAsync("UPDATE document_library SET archived_at = now() WHERE id = $1", archived);
        var path = $"/api/projects/{project}/document-choices/{Bakim}";

        Assert.Equal(HttpStatusCode.NotFound, await staff.SendAsync("PUT", path, new { libraryDocumentId = other }));
        Assert.Equal(HttpStatusCode.NotFound, await staff.SendAsync("PUT", path, new { libraryDocumentId = wrongType }));
        Assert.Equal(HttpStatusCode.NotFound, await staff.SendAsync("PUT", path, new { libraryDocumentId = archived }));
        Assert.Equal(HttpStatusCode.BadRequest, await staff.SendAsync("PUT", $"/api/projects/{project}/document-choices/kapak", new { libraryDocumentId = wrongType }));
        Assert.Equal(HttpStatusCode.NotFound, await staff.SendAsync("PUT", $"/api/projects/{Guid.NewGuid()}/document-choices/{Bakim}", new { libraryDocumentId = wrongType }));
        Assert.Null(await ChosenAsync(project, Bakim));
    }

    [Fact]
    public async Task Choosing_and_returning_to_the_system()
    {
        await ForgetDefaultsAsync();
        var staff = await api.As(Staff);
        var def = await UploadAsync(CompanyA, Bakim, isDefault: true, name: "varsayilan.pdf");
        var plain = await UploadAsync(CompanyA, Bakim, name: "diger.pdf");
        var project = await NewProjectAsync(Staff, CompanyA);
        var path = $"/api/projects/{project}/document-choices";

        var row = (await staff.JsonAsync(path)).GetProperty("rows").EnumerateArray().Single(r => r.GetProperty("docType").GetString() == Bakim);
        Assert.Equal("library", row.GetProperty("source").GetString());
        Assert.Equal("varsayilan.pdf", row.GetProperty("fileName").GetString());
        var options = row.GetProperty("options").EnumerateArray().ToList();
        Assert.Contains(options, o => o.GetProperty("id").GetGuid() == plain && !o.GetProperty("isDefault").GetBoolean());
        Assert.Contains(options, o => o.GetProperty("id").GetGuid() == def && o.GetProperty("isDefault").GetBoolean());

        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"{path}/{Bakim}", new { libraryDocumentId = plain }));
        Assert.Equal(plain, await ChosenAsync(project, Bakim));
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"{path}/{Bakim}", new { libraryDocumentId = (Guid?)null }));
        Assert.Null(await ChosenAsync(project, Bakim));
        row = (await staff.JsonAsync(path)).GetProperty("rows").EnumerateArray().Single(r => r.GetProperty("docType").GetString() == Bakim);
        Assert.Equal("system", row.GetProperty("source").GetString());
    }

    // User decision: the list holds the assigned documents of the file's company for that type, taken from the
    // project on the server. Defaults included, archived left out.
    [Fact]
    public async Task List_shows_only_that_company_and_type()
    {
        await ForgetDefaultsAsync();
        var staff = await api.As(Staff);
        var mine = await UploadAsync(CompanyA, "egitim_tutanagi", isDefault: true);
        var otherType = await UploadAsync(CompanyA, "teslim_tutanagi");
        var otherCompany = await UploadAsync(CompanyB, "egitim_tutanagi");
        var archived = await UploadAsync(CompanyA, "egitim_tutanagi");
        await api.ExecAsync("UPDATE document_library SET archived_at = now() WHERE id = $1", archived);
        var project = await NewProjectAsync(Staff, CompanyA);

        // A company id in the query is not an input to this list.
        var rows = (await staff.JsonAsync($"/api/projects/{project}/document-choices?companyId={CompanyB}")).GetProperty("rows");
        var ids = rows.EnumerateArray().Single(r => r.GetProperty("docType").GetString() == "egitim_tutanagi")
            .GetProperty("options").Ids();
        Assert.Contains(mine.ToString(), ids);
        Assert.DoesNotContain(otherType.ToString(), ids);
        Assert.DoesNotContain(otherCompany.ToString(), ids);
        Assert.DoesNotContain(archived.ToString(), ids);
    }

    [Fact]
    public async Task Module_g_report_keeps_son_kontrol_and_only_when_uploaded()
    {
        await ForgetDefaultsAsync();
        var staff = await api.As(Staff);
        var doc = await UploadAsync(CompanyA, SonKontrol);
        var project = await NewProjectAsync(Staff, CompanyA, ProjectInput(CompanyA, extra: new { modul_secim = "G" }));
        var path = $"/api/projects/{project}/document-choices";
        string SourceOf(JsonElement e) => e.GetProperty("rows").EnumerateArray().Single(r => r.GetProperty("docType").GetString() == SonKontrol).GetProperty("source").GetString()!;

        // No report yet: the library applies.
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"{path}/{SonKontrol}", new { libraryDocumentId = doc }));
        Assert.Equal("library", SourceOf(await staff.JsonAsync(path)));

        await api.ExecAsync("INSERT INTO project_files (project_id, kind, storage_path) VALUES ($1, 'modul_g_rapor', $2)", project, $"proje/{project}/modul_g_rapor-x.pdf");
        Assert.Equal("modul_g_rapor", SourceOf(await staff.JsonAsync(path)));
        Assert.Equal(HttpStatusCode.Conflict, await staff.SendAsync("PUT", $"{path}/{SonKontrol}", new { libraryDocumentId = (Guid?)null }));
        Assert.Equal(doc, await ChosenAsync(project, SonKontrol));
    }

    [Fact]
    public async Task Used_document_is_archived_and_keeps_working_unused_is_deleted()
    {
        await ForgetDefaultsAsync();
        var staff = await api.As(Staff);
        var used = await UploadAsync(CompanyA, Bakim, isDefault: true);
        var project = await NewProjectAsync(Staff, CompanyA);
        var path = await api.ScalarAsync<string>("SELECT storage_path FROM document_library WHERE id = $1", used);

        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("DELETE", $"/api/document-library/{used}"));
        Assert.Equal(1L, await api.ScalarAsync<long>("SELECT count(*) FROM document_library WHERE id = $1 AND archived_at IS NOT NULL AND archived_by = (SELECT id FROM users WHERE email = $2) AND NOT is_default", used, Staff));
        Assert.Equal(used, await ChosenAsync(project, Bakim));
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("GET", $"/api/projects/{project}/pdf-source/file?bucket=documents&path={path}"));
        Assert.DoesNotContain(used.ToString(), (await staff.JsonAsync($"/api/document-library?companyId={CompanyA}")).GetRawText());
        Assert.Contains(used.ToString(), (await staff.JsonAsync($"/api/document-library?companyId={CompanyA}&archived=true")).GetRawText());
        // Archived documents are not pinned to new projects.
        Assert.Null(await ChosenAsync(await NewProjectAsync(Staff, CompanyA), Bakim));

        var unused = await UploadAsync(CompanyA, Bakim);
        var key = await api.ScalarAsync<string>("SELECT storage_path FROM document_library WHERE id = $1", unused);
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("DELETE", $"/api/document-library/{unused}"));
        Assert.Equal(0L, await api.ScalarAsync<long>("SELECT count(*) FROM document_library WHERE id = $1", unused));
        Assert.Null(await api.Services.GetRequiredService<StorageService>().SizeAsync("documents", key!));
    }

    [Fact]
    public async Task Database_refuses_to_delete_a_document_in_use() // what the 409 of the delete race rests on
    {
        await ForgetDefaultsAsync();
        var doc = await UploadAsync(CompanyA, Bakim, isDefault: true);
        await NewProjectAsync(Staff, CompanyA);
        await Assert.ThrowsAnyAsync<Exception>(() => api.ExecAsync("DELETE FROM document_library WHERE id = $1", doc));
    }

    [Fact]
    public async Task Customer_gets_only_the_chosen_file_and_no_names()
    {
        await ForgetDefaultsAsync();
        const string secret = "gizli-dosya-adi.pdf";
        var chosen = await UploadAsync(CompanyA, Bakim, isDefault: true, name: secret);
        var notChosen = await UploadAsync(CompanyA, Bakim);
        var project = await NewProjectAsync(CustomerA, CompanyA);
        var other = await NewProjectAsync(CustomerA, CompanyA);
        var customer = await api.As(CustomerA);
        var chosenPath = await api.ScalarAsync<string>("SELECT storage_path FROM document_library WHERE id = $1", chosen);
        var notChosenPath = await api.ScalarAsync<string>("SELECT storage_path FROM document_library WHERE id = $1", notChosen);
        Assert.Equal(HttpStatusCode.OK, await (await api.As(Staff)).SendAsync("PUT", $"/api/projects/{other}/document-choices/{Bakim}", new { libraryDocumentId = (Guid?)null }));

        using (var res = await customer.GetAsync($"/api/projects/{project}/pdf-source"))
        {
            var text = await res.Content.ReadAsStringAsync();
            Assert.Contains(chosenPath!, text);
            Assert.DoesNotContain(notChosenPath!, text);
            Assert.DoesNotContain(secret, text);
            Assert.DoesNotContain(chosen.ToString(), text);
        }
        string File(Guid p, string path) => $"/api/projects/{p}/pdf-source/file?bucket=documents&path={path}";
        Assert.Equal(HttpStatusCode.OK, await customer.SendAsync("GET", File(project, chosenPath!)));
        Assert.Equal(HttpStatusCode.NotFound, await customer.SendAsync("GET", File(project, notChosenPath!)));
        Assert.Equal(HttpStatusCode.NotFound, await customer.SendAsync("GET", File(other, chosenPath!)));
        // The company's "any document" rule does not reach library files for the accountant either.
        Assert.Equal(HttpStatusCode.NotFound, await (await api.As(Muhasebeci)).SendAsync("GET", File(project, notChosenPath!)));
    }

    [Fact]
    public async Task Choice_never_serves_another_companys_file_even_if_the_row_is_wrong()
    {
        await ForgetDefaultsAsync();
        var staff = await api.As(Staff);
        var foreign = await UploadAsync(CompanyB, Bakim);
        var project = await NewProjectAsync(Staff, CompanyA);
        await api.ExecAsync("INSERT INTO project_document_choices (project_id, doc_type, library_document_id, updated_at) VALUES ($1, $2, $3, now())", project, Bakim, foreign);
        var path = await api.ScalarAsync<string>("SELECT storage_path FROM document_library WHERE id = $1", foreign);

        Assert.DoesNotContain(path!, (await staff.JsonAsync($"/api/projects/{project}/pdf-source")).GetRawText());
        Assert.Equal(HttpStatusCode.NotFound, await staff.SendAsync("GET", $"/api/projects/{project}/pdf-source/file?bucket=documents&path={path}"));
        await api.ExecAsync("DELETE FROM project_document_choices WHERE project_id = $1", project);
    }

    [Fact]
    public async Task Deleting_a_company_removes_its_library_and_files()
    {
        var company = Guid.NewGuid();
        await api.ExecAsync("INSERT INTO companies (id, short_name, legal_name) VALUES ($1, 'DL-SIL', 'DL Silinecek Ltd.')", company);
        var doc = await UploadAsync(company, Bakim, isDefault: true);
        var key = await api.ScalarAsync<string>("SELECT storage_path FROM document_library WHERE id = $1", doc);

        Assert.Equal(HttpStatusCode.OK, await (await api.As(Staff)).SendAsync("DELETE", $"/api/companies/{company}"));

        Assert.Equal(0L, await api.ScalarAsync<long>("SELECT count(*) FROM document_library WHERE company_id = $1", company));
        Assert.Null(await api.Services.GetRequiredService<StorageService>().SizeAsync("documents", key!));
    }

    [Fact]
    public async Task Library_file_opens_for_staff_only()
    {
        var doc = await UploadAsync(CompanyA, "teslim_tutanagi");
        Assert.Equal(HttpStatusCode.Redirect, await (await api.As(Staff)).SendAsync("GET", $"/api/files/library/{doc}"));
        Assert.Equal(HttpStatusCode.Forbidden, await (await api.As(CustomerA)).SendAsync("GET", $"/api/files/library/{doc}"));
        Assert.Equal(HttpStatusCode.Forbidden, await (await api.As(Muhasebeci)).SendAsync("GET", $"/api/files/library/{doc}"));
    }
}
