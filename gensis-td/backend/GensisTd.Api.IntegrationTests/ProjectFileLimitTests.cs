using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using GensisTd.Api.Storage;
using Microsoft.Extensions.DependencyInjection;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>KRR-035: at most 20 attachments per project, also when uploads race for the last place.</summary>
[Collection(ApiCollection.Name)]
public class ProjectFileLimitTests(ApiFixture api)
{
    private static readonly byte[] Pdf = Encoding.ASCII.GetBytes("%PDF-1.7\n%%EOF");

    private async Task<Guid> NewProjectAsync()
    {
        using var res = await (await api.As(CustomerA)).PostAsJsonAsync("/api/projects",
            new { companyId = CompanyA, dosyaNo = $"LIM-{Guid.NewGuid():N}", inputData = new { } });
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
    }

    private Task FillAsync(Guid project, int count) => api.ExecAsync(
        "INSERT INTO project_files (project_id, kind, storage_path) SELECT $1, 'fatura', 'proje/' || $1 || '/fatura-' || gen_random_uuid() || '.pdf' FROM generate_series(1, $2)",
        project, count);

    private Task<long> CountAsync(Guid project) => api.ScalarAsync<long>("SELECT count(*) FROM project_files WHERE project_id = $1", project);

    private async Task<string> UploadedKeyAsync(HttpClient c, Guid project)
    {
        using var res = await c.PostAsJsonAsync($"/api/projects/{project}/files/upload-url", new { kind = "fatura", fileName = "f.pdf", contentType = "application/pdf" });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var key = (await res.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("key").GetString()!;
        await api.PutObjectAsync(key, Pdf);
        return key;
    }

    [Fact]
    public async Task Twentieth_is_accepted_and_the_next_is_refused_before_and_after_upload()
    {
        var customer = await api.As(CustomerA);
        var project = await NewProjectAsync();
        await FillAsync(project, 19);
        var key = await UploadedKeyAsync(customer, project);
        var late = await UploadedKeyAsync(customer, project); // issued while there was still room
        Assert.Equal(HttpStatusCode.Created, await customer.SendAsync("POST", $"/api/projects/{project}/files", new { key, originalName = "f.pdf" }));
        Assert.Equal(20L, await CountAsync(project));

        using (var res = await customer.PostAsJsonAsync($"/api/projects/{project}/files/upload-url", new { kind = "fatura", fileName = "f.pdf" }))
        {
            Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
            Assert.Contains("en çok 20 ek", await res.Content.ReadAsStringAsync());
        }
        Assert.Equal(HttpStatusCode.Conflict, await customer.SendAsync("POST", $"/api/projects/{project}/files", new { key = late, originalName = "f.pdf" }));
        Assert.Equal(20L, await CountAsync(project));
        Assert.Null(await api.Services.GetRequiredService<StorageService>().SizeAsync("documents", late));

        // Removing one makes room again.
        await api.ExecAsync("DELETE FROM project_files WHERE id = (SELECT id FROM project_files WHERE project_id = $1 LIMIT 1)", project);
        Assert.Equal(HttpStatusCode.Created, await customer.SendAsync("POST", $"/api/projects/{project}/files", new { key = await UploadedKeyAsync(customer, project), originalName = "f.pdf" }));
    }

    // The race above is rarely hit in-process; this shows the count really waits for the project row lock.
    [Fact]
    public async Task Confirm_waits_for_the_project_row_lock()
    {
        var customer = await api.As(CustomerA);
        var project = await NewProjectAsync();
        await FillAsync(project, 19);
        var key = await UploadedKeyAsync(customer, project);

        await using var holder = new Npgsql.NpgsqlConnection(api.OwnerConnection);
        await holder.OpenAsync();
        await using var tx = await holder.BeginTransactionAsync();
        await using (var lockCmd = new Npgsql.NpgsqlCommand("SELECT 1 FROM projects WHERE id = $1 FOR UPDATE", holder, tx))
        {
            lockCmd.Parameters.Add(new Npgsql.NpgsqlParameter { Value = project });
            await lockCmd.ExecuteScalarAsync();
        }
        // Another upload takes the last place while the confirm below is waiting.
        await using (var ins = new Npgsql.NpgsqlCommand("INSERT INTO project_files (project_id, kind, storage_path) VALUES ($1, 'fatura', 'proje/x/fatura-' || gen_random_uuid() || '.pdf')", holder, tx))
        {
            ins.Parameters.Add(new Npgsql.NpgsqlParameter { Value = project });
            await ins.ExecuteNonQueryAsync();
        }

        var confirm = customer.SendAsync("POST", $"/api/projects/{project}/files", new { key, originalName = "f.pdf" });
        Assert.NotSame(confirm, await Task.WhenAny(confirm, Task.Delay(1500)));
        await tx.CommitAsync();

        Assert.Equal(HttpStatusCode.Conflict, await confirm);
        Assert.Equal(20L, await CountAsync(project));
    }

    [Fact]
    public async Task Uploads_racing_for_the_last_place_get_it_once()
    {
        var customer = await api.As(CustomerA);
        var project = await NewProjectAsync();
        await FillAsync(project, 19);
        var keys = new List<string>();
        for (var i = 0; i < 6; i++) keys.Add(await UploadedKeyAsync(customer, project));

        var results = await Task.WhenAll(keys.Select(k => customer.SendAsync("POST", $"/api/projects/{project}/files", new { key = k, originalName = "f.pdf" })));

        Assert.Equal(1, results.Count(r => r == HttpStatusCode.Created));
        Assert.Equal(5, results.Count(r => r == HttpStatusCode.Conflict));
        Assert.Equal(20L, await CountAsync(project));
    }
}
