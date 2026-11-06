using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using GensisTd.Api.Storage;
using Microsoft.Extensions.DependencyInjection;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// Yönetim > Müşteriler > Düzenle "Sil" (z8qgvcccd1): admin or gensis deletes a company document with its file (and a
/// Modül B document's Ek rows), so the type can be uploaded again. Accountant and customers may not; another company's id is 404.
/// </summary>
[Collection(ApiCollection.Name)]
public class CompanyDocumentDeleteTests(ApiFixture api)
{
    private async Task<(Guid Id, string Path)> DocAsync(Guid company, string docType, Guid? parent = null)
    {
        var id = Guid.NewGuid();
        var path = $"musteri/{company}/{docType}-{id}.pdf";
        await api.PutObjectAsync(path, "%PDF-1.4"u8.ToArray());
        await api.ExecAsync("INSERT INTO company_documents (id, company_id, doc_type, storage_path, parent_id) VALUES ($1, $2, $3, $4, $5)",
            id, company, docType, path, (object?)parent ?? DBNull.Value);
        return (id, path);
    }

    private Task<long?> SizeAsync(string path) =>
        api.Services.GetRequiredService<StorageService>().SizeAsync("documents", path, CancellationToken.None);

    private Task<long> RowsAsync(params Guid[] ids) =>
        api.ScalarAsync<long>("SELECT count(*) FROM company_documents WHERE id = ANY($1)", ids);

    [Fact]
    public async Task Admin_deletes_the_document_and_its_file()
    {
        var (id, path) = await DocAsync(CompanyA, "sanayi_sicil");
        var admin = await api.As(Admin);

        Assert.Equal(HttpStatusCode.OK, await admin.SendAsync("DELETE", $"/api/companies/documents/{id}"));
        Assert.Equal(0, await RowsAsync(id));
        Assert.Null(await SizeAsync(path));
        Assert.Equal(HttpStatusCode.NotFound, await admin.SendAsync("DELETE", $"/api/companies/documents/{id}"));
    }

    [Fact]
    public async Task Modul_b_goes_with_its_attachments()
    {
        var (b, bPath) = await DocAsync(CompanyA, "ce_b");
        var (eki, ekiPath) = await DocAsync(CompanyA, "ce_b_eki", parent: b);
        var admin = await api.As(Admin);

        var usage = await admin.JsonAsync($"/api/companies/{CompanyA}/documents/{b}/usage");
        Assert.Equal(1, usage.GetProperty("attachments").GetInt32());

        Assert.Equal(HttpStatusCode.OK, await admin.SendAsync("DELETE", $"/api/companies/documents/{b}"));
        Assert.Equal(0, await RowsAsync(b, eki));
        Assert.Null(await SizeAsync(bPath));
        Assert.Null(await SizeAsync(ekiPath));
    }

    [Fact]
    public async Task Usage_counts_teknik_dosyalar_that_chose_a_ce_document()
    {
        var (ce, _) = await DocAsync(CompanyA, "ce_e");
        var admin = await api.As(Admin);
        using (var res = await admin.PostAsJsonAsync("/api/projects",
            new { companyId = CompanyA, dosyaNo = $"DEL-{Guid.NewGuid():N}", inputData = new { modul_belge_ids = new[] { ce.ToString() } } }))
            Assert.Equal(HttpStatusCode.Created, res.StatusCode);

        var usage = await admin.JsonAsync($"/api/companies/{CompanyA}/documents/{ce}/usage");
        Assert.Equal(1, usage.GetProperty("projects").GetInt32());
        Assert.Equal(0, usage.GetProperty("attachments").GetInt32());
        // Other types are read from the company's newest document: every file of the company counts.
        var (logo, _) = await DocAsync(CompanyA, "logo");
        var all = await api.ScalarAsync<long>("SELECT count(*) FROM projects WHERE company_id = $1", CompanyA);
        Assert.Equal(all, (await admin.JsonAsync($"/api/companies/{CompanyA}/documents/{logo}/usage")).GetProperty("projects").GetInt32());
    }

    [Fact]
    public async Task Gensis_staff_may_delete_too()
    {
        var (id, path) = await DocAsync(CompanyB, "tse_hyb");
        Assert.Equal(HttpStatusCode.OK, await (await api.As(Staff)).SendAsync("DELETE", $"/api/companies/documents/{id}"));
        Assert.Equal(0, await RowsAsync(id));
        Assert.Null(await SizeAsync(path));
    }

    [Theory]
    [InlineData(Muhasebeci)]
    [InlineData(CustomerA)]
    [InlineData(CustomerB)]
    public async Task Others_cannot_delete(string user)
    {
        var (id, path) = await DocAsync(CompanyA, "imza_sirkuleri");
        var c = await api.As(user);
        Assert.Equal(HttpStatusCode.Forbidden, await c.SendAsync("DELETE", $"/api/companies/documents/{id}"));
        Assert.Equal(HttpStatusCode.Forbidden, await c.SendAsync("GET", $"/api/companies/{CompanyA}/documents/{id}/usage"));
        Assert.Equal(1, await RowsAsync(id));
        Assert.NotNull(await SizeAsync(path));
    }

    [Fact]
    public async Task Usage_of_another_companys_document_is_not_found()
    {
        var (id, _) = await DocAsync(CompanyB, "logo");
        Assert.Equal(HttpStatusCode.NotFound, await (await api.As(Admin)).SendAsync("GET", $"/api/companies/{CompanyA}/documents/{id}/usage"));
        using var anon = api.Anonymous();
        Assert.Equal(HttpStatusCode.Unauthorized, await anon.SendAsync("DELETE", $"/api/companies/documents/{id}"));
        Assert.Equal(1, await RowsAsync(id));
    }
}
