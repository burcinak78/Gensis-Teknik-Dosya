using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>Onaylanmış kuruluş: the address is set on create and changed on edit, and the list returns it.</summary>
[Collection(ApiCollection.Name)]
public class NotifiedBodyTests(ApiFixture api)
{
    [Fact]
    public async Task Address_is_saved_on_create_and_edit()
    {
        using var admin = await api.As(Admin);
        using var created = await admin.PostAsJsonAsync("/api/catalog/notified-bodies",
            new { name = "TEST-OK Belgelendirme A.Ş.", shortName = "TEST-OK", country = "Türkiye", city = "Ankara", address = "Eski Adres 1" });
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var id = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        try
        {
            Assert.Equal("Eski Adres 1", await api.ScalarAsync<string>("SELECT address FROM notified_bodies WHERE id = $1", id));

            Assert.Equal(HttpStatusCode.OK, await admin.SendAsync("PUT", $"/api/catalog/notified-bodies/{id}",
                new { name = "TEST-OK Belgelendirme A.Ş.", shortName = "TEST-OK", country = "Türkiye", city = "Ankara", address = "Yeni Adres 2" }));
            Assert.Equal("Yeni Adres 2", await api.ScalarAsync<string>("SELECT address FROM notified_bodies WHERE id = $1", id));

            var listed = (await admin.JsonAsync("/api/catalog/notified-bodies")).EnumerateArray()
                .Single(n => n.GetProperty("id").GetGuid() == id);
            Assert.Equal("Yeni Adres 2", listed.GetProperty("address").GetString());
        }
        finally
        {
            await api.ExecAsync("DELETE FROM notified_bodies WHERE id = $1", id);
        }
    }
}
