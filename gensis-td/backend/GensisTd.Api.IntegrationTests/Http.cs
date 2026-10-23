using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace GensisTd.Api.IntegrationTests;

public static class Http
{
    public static async Task<HttpStatusCode> SendAsync(this HttpClient client, string method, string path, object? body = null)
    {
        using var req = new HttpRequestMessage(new HttpMethod(method), path);
        if (body is not null) req.Content = JsonContent.Create(body);
        using var res = await client.SendAsync(req);
        return res.StatusCode;
    }

    public static async Task<JsonElement> JsonAsync(this HttpClient client, string path)
    {
        using var res = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }

    /// <summary>Values of one property across a JSON array.</summary>
    public static List<string> Ids(this JsonElement array, string property = "id") =>
        array.EnumerateArray().Select(e => e.GetProperty(property).ToString()).ToList();
}
