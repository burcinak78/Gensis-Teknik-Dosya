using System.Net;
using System.Net.Http.Json;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// Notlar (z8qgvccdud): the owner edits a note's text (the counter stays), nobody else can, and /api/me/counters
/// counts the user's own notes that are 3+ days old for the bell next to Notlar.
/// </summary>
[Collection(ApiCollection.Name)]
public class NoteEditBellTests(ApiFixture api) : IAsyncLifetime
{
    // Other tests list alfa's and beta's notes exactly: remove what this test added.
    private readonly List<Guid> _created = [];

    public Task InitializeAsync() => Task.CompletedTask;

    public Task DisposeAsync() => api.ExecAsync("DELETE FROM notlar WHERE id = ANY($1)", _created.ToArray());

    private async Task<Guid> NoteAsync(Guid user, string text, int daysOld)
    {
        var id = Guid.NewGuid();
        _created.Add(id);
        await api.ExecAsync("INSERT INTO notlar (id, user_id, icerik, sayac_baslangic) VALUES ($1, $2, $3, now() - make_interval(days => $4))",
            id, user, text, daysOld);
        return id;
    }

    private static async Task<int> BellAsync(HttpClient c) => (await c.JsonAsync("/api/me/counters")).GetProperty("not").GetInt32();

    [Fact]
    public async Task Owner_edits_the_text_and_the_counter_stays()
    {
        var alfa = await api.As(CustomerA);
        var id = await NoteAsync(UserCustomerA, "eski metin", 5);
        var before = await api.ScalarAsync<DateTime>("SELECT sayac_baslangic FROM notlar WHERE id = $1", id);

        Assert.Equal(HttpStatusCode.OK, await alfa.SendAsync("PUT", $"/api/notes/{id}", new { icerik = "  yeni metin  " }));
        Assert.Equal("yeni metin", await api.ScalarAsync<string>("SELECT icerik FROM notlar WHERE id = $1", id));
        Assert.Equal(before, await api.ScalarAsync<DateTime>("SELECT sayac_baslangic FROM notlar WHERE id = $1", id));

        Assert.Equal(HttpStatusCode.BadRequest, await alfa.SendAsync("PUT", $"/api/notes/{id}", new { icerik = "   " }));
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("PUT", $"/api/notes/{Guid.NewGuid()}", new { icerik = "x" }));
    }

    [Theory]
    [InlineData(CustomerB)]
    [InlineData(Admin)]
    [InlineData(Staff)]
    public async Task Nobody_else_edits_a_note(string user)
    {
        var id = await NoteAsync(UserCustomerA, "alfa'nın notu", 0);
        Assert.Equal(HttpStatusCode.NotFound, await (await api.As(user)).SendAsync("PUT", $"/api/notes/{id}", new { icerik = "değişti" }));
        Assert.Equal("alfa'nın notu", await api.ScalarAsync<string>("SELECT icerik FROM notlar WHERE id = $1", id));
        using var anon = api.Anonymous();
        Assert.Equal(HttpStatusCode.Unauthorized, await anon.SendAsync("PUT", $"/api/notes/{id}", new { icerik = "x" }));
    }

    [Fact]
    public async Task Bell_counts_own_overdue_notes_only()
    {
        var beta = await api.As(CustomerB);
        var start = await BellAsync(beta);

        var overdue = await NoteAsync(UserCustomerB, "gecikmiş", 4);
        await NoteAsync(UserCustomerB, "taze", 1);
        await NoteAsync(UserCustomerA, "başkasının gecikmiş notu", 10);
        Assert.Equal(start + 1, await BellAsync(beta));

        // Snoozing restarts the counter: the bell goes back down.
        Assert.Equal(HttpStatusCode.OK, await beta.SendAsync("POST", $"/api/notes/{overdue}/snooze"));
        Assert.Equal(start, await BellAsync(beta));
    }
}
