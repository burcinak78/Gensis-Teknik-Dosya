using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// beyan_hizi is numeric(4,2): a speed that does not fit answers 400 with a Turkish message, not 500 (z8qgvcbynx).
/// </summary>
[Collection(ApiCollection.Name)]
public class BeyanHiziTests(ApiFixture api)
{
    private static JsonObject Td(string dosyaNo, decimal speed)
    {
        var o = JsonSerializer.SerializeToNode(CrossCompanyTests.ProjectInput(CompanyA, dosyaNo, makine: EngineerA))!.AsObject();
        o["beyanHizi"] = speed;
        return o;
    }

    private static async Task<(HttpStatusCode Status, string? Message)> SendAsync(HttpClient c, HttpMethod method, string path, object body)
    {
        var res = await c.SendAsync(new HttpRequestMessage(method, path) { Content = JsonContent.Create(body) });
        var text = await res.Content.ReadAsStringAsync();
        string? message = null;
        if (res.StatusCode == HttpStatusCode.BadRequest && text.Length > 0
            && JsonDocument.Parse(text).RootElement.TryGetProperty("errors", out var errors)
            && errors.TryGetProperty("beyanHizi", out var field))
            message = field[0].GetString();
        return (res.StatusCode, message);
    }

    [Theory]
    [InlineData("100")]
    [InlineData("99.996")]
    [InlineData("0")]
    [InlineData("-1")]
    public async Task Speed_that_does_not_fit_is_400(string speed)
    {
        var alfa = await api.As(CustomerA);
        var value = decimal.Parse(speed, System.Globalization.CultureInfo.InvariantCulture);
        var before = await api.ScalarAsync<long>("SELECT count(*) FROM projects");

        var created = await SendAsync(alfa, HttpMethod.Post, "/api/projects", Td("HIZ-" + speed, value));
        Assert.Equal(HttpStatusCode.BadRequest, created.Status);
        Assert.Equal("Beyan hızı 0'dan büyük ve en fazla 99,99 m/s olmalı.", created.Message);
        Assert.Equal(before, await api.ScalarAsync<long>("SELECT count(*) FROM projects"));

        Assert.Equal(HttpStatusCode.BadRequest, (await SendAsync(alfa, HttpMethod.Put, $"/api/projects/{ProjectA}", Td("ALFA-1", value))).Status);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await SendAsync(alfa, HttpMethod.Post, "/api/proje-onay", new { companyId = CompanyA, beyanHizi = value })).Status);
    }

    [Fact]
    public async Task Largest_speed_that_fits_is_saved()
    {
        var alfa = await api.As(CustomerA);
        var before = await api.ScalarAsync<decimal?>("SELECT beyan_hizi FROM projects WHERE id = $1", ProjectA);
        try
        {
            Assert.Equal(HttpStatusCode.OK, (await SendAsync(alfa, HttpMethod.Put, $"/api/projects/{ProjectA}", Td("ALFA-1", 99.99m))).Status);
            Assert.Equal(99.99m, await api.ScalarAsync<decimal?>("SELECT beyan_hizi FROM projects WHERE id = $1", ProjectA));
        }
        finally
        {
            await api.ExecAsync("UPDATE projects SET beyan_hizi = $2 WHERE id = $1", ProjectA, (object?)before ?? DBNull.Value);
        }
    }
}
