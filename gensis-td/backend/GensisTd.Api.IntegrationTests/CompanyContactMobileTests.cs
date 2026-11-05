using System.Net;
using System.Text.Json;
using static GensisTd.Api.IntegrationTests.Seed;

namespace GensisTd.Api.IntegrationTests;

/// <summary>
/// A company's contact mobile (contact_mobile_phone, z8qgvcbyfm): readable with the company's other contact details,
/// never on documents or name lists, written by customers only through approval, and gone from the change record
/// once reviewed. All numbers here are made up.
/// </summary>
[Collection(ApiCollection.Name)]
public class CompanyContactMobileTests(ApiFixture api)
{
    private static object Input(JsonElement c, string? mobile) => new
    {
        shortName = c.GetProperty("shortName").GetString(), legalName = c.GetProperty("legalName").GetString(),
        address = c.GetProperty("address").GetString(), phone = c.GetProperty("phone").GetString(),
        mobilePhone = c.GetProperty("mobilePhone").GetString(), city = c.GetProperty("city").GetString(),
        authorizedPerson = c.GetProperty("authorizedPerson").GetString(), registeredBrand = c.GetProperty("registeredBrand").GetString(),
        industryRegNo = c.GetProperty("industryRegNo").GetString(), email = c.GetProperty("email").GetString(),
        ceModule = c.GetProperty("ceModule").GetString(), category = c.GetProperty("category").GetString(),
        sector = c.GetProperty("sector").GetString(), contactMobilePhone = mobile,
    };

    private Task SetAsync(Guid company, string? value) =>
        api.ExecAsync("UPDATE companies SET contact_mobile_phone = $1 WHERE id = $2", (object?)value ?? DBNull.Value, company);

    private Task<string?> StoredAsync(Guid company) =>
        api.ScalarAsync<string>("SELECT contact_mobile_phone FROM companies WHERE id = $1", company);

    private async Task<Guid> SubmitAsync(string? mobile)
    {
        var alfa = await api.As(CustomerA);
        var company = await alfa.JsonAsync($"/api/catalog/companies/{CompanyA}");
        Assert.Equal(HttpStatusCode.OK, await alfa.SendAsync("PUT", $"/api/companies/{CompanyA}", Input(company, mobile)));
        return await api.ScalarAsync<Guid>(
            "SELECT id FROM pending_changes WHERE kind = 'company_edit' AND target_id = $1 AND status = 'pending' ORDER BY submitted_at DESC LIMIT 1", CompanyA);
    }

    private Task<long> KeptInPayloadAsync(Guid change) =>
        api.ScalarAsync<long>("SELECT count(*) FROM pending_changes WHERE id = $1 AND payload ? 'contact_mobile_phone'", change);

    [Fact]
    public async Task Value_never_reaches_documents_or_name_lists()
    {
        const string marker = "0599 000 11 01";
        await SetAsync(CompanyA, marker);
        var staff = await api.As(Staff);

        foreach (var path in new[]
        {
            "/api/catalog/companies/names", $"/api/projects/{ProjectA}/pdf-source", $"/api/projects/{ProjectA}/render-context",
            "/api/proje-onay", $"/api/proje-onay/{OnayA}", "/api/catalog/engineers", "/api/engineers",
        })
        {
            using var res = await staff.GetAsync(path);
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            Assert.DoesNotContain(marker, await res.Content.ReadAsStringAsync());
        }
    }

    [Fact]
    public async Task Readers_see_it_with_the_other_contact_details()
    {
        const string marker = "0599 000 11 02";
        await SetAsync(CompanyA, marker);
        await SetAsync(CompanyB, "0599 000 11 03");

        var alfa = await api.As(CustomerA);
        Assert.Equal(marker, (await alfa.JsonAsync($"/api/catalog/companies/{CompanyA}")).GetProperty("contactMobilePhone").GetString());
        Assert.Equal(HttpStatusCode.NotFound, await alfa.SendAsync("GET", $"/api/catalog/companies/{CompanyB}"));
        using (var list = await alfa.GetAsync("/api/catalog/companies"))
            Assert.DoesNotContain("0599 000 11 03", await list.Content.ReadAsStringAsync());

        // The accountant reads it (user decision 2026-11-05) but cannot write.
        var muhasebe = await api.As(Muhasebeci);
        var seen = await muhasebe.JsonAsync($"/api/catalog/companies/{CompanyA}");
        Assert.Equal(marker, seen.GetProperty("contactMobilePhone").GetString());
        var before = await api.ScalarAsync<long>("SELECT count(*) FROM pending_changes");
        Assert.Contains(await muhasebe.SendAsync("PUT", $"/api/companies/{CompanyA}", Input(seen, "0599 000 11 04")),
            new[] { HttpStatusCode.Forbidden, HttpStatusCode.NotFound });
        Assert.Equal(HttpStatusCode.Forbidden, await muhasebe.SendAsync("POST", "/api/companies", Input(seen, "0599 000 11 04")));
        Assert.Equal(before, await api.ScalarAsync<long>("SELECT count(*) FROM pending_changes"));
        Assert.Equal(marker, await StoredAsync(CompanyA));
    }

    [Fact]
    public async Task Customer_change_waits_for_approval_and_leaves_no_copy()
    {
        await SetAsync(CompanyA, "0599 000 11 05");
        var change = await SubmitAsync("0599 000 11 06");
        Assert.Equal("0599 000 11 05", await StoredAsync(CompanyA));
        Assert.Equal(1L, await KeptInPayloadAsync(change));

        var staff = await api.As(Staff);
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("POST", $"/api/pending-changes/{change}/approve"));

        Assert.Equal("0599 000 11 06", await StoredAsync(CompanyA));
        Assert.Equal(0L, await KeptInPayloadAsync(change));
    }

    [Fact]
    public async Task Rejected_change_is_not_applied_and_leaves_no_copy()
    {
        await SetAsync(CompanyA, "0599 000 11 07");
        var change = await SubmitAsync("0599 000 11 08");

        var staff = await api.As(Staff);
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("POST", $"/api/pending-changes/{change}/reject", new { note = "Hayır" }));

        Assert.Equal("0599 000 11 07", await StoredAsync(CompanyA));
        Assert.Equal(0L, await KeptInPayloadAsync(change));
    }

    [Fact]
    public async Task Approved_empty_value_clears_it()
    {
        await SetAsync(CompanyA, "0599 000 11 09");
        var change = await SubmitAsync(null);
        var staff = await api.As(Staff);
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("POST", $"/api/pending-changes/{change}/approve"));
        Assert.Null(await StoredAsync(CompanyA));
    }

    // Queued before this field existed: no key in the payload.
    [Fact]
    public async Task Older_queued_change_keeps_the_value()
    {
        await SetAsync(CompanyA, "0599 000 11 10");
        var change = await SubmitAsync("0599 000 11 11");
        await api.ExecAsync("UPDATE pending_changes SET payload = payload - 'contact_mobile_phone' WHERE id = $1", change);

        var staff = await api.As(Staff);
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("POST", $"/api/pending-changes/{change}/approve"));

        Assert.Equal("0599 000 11 10", await StoredAsync(CompanyA));
    }

    [Theory]
    [InlineData("0599 000 11 12 abc")]
    [InlineData("<script>")]
    [InlineData("123456789012345678901234567890123")] // 33 characters
    public async Task Invalid_value_is_refused(string value)
    {
        await SetAsync(CompanyA, "0599 000 11 13");
        var staff = await api.As(Staff);
        var alfa = await api.As(CustomerA);
        var company = await staff.JsonAsync($"/api/catalog/companies/{CompanyA}");
        var before = await api.ScalarAsync<long>("SELECT count(*) FROM pending_changes");

        Assert.Equal(HttpStatusCode.BadRequest, await staff.SendAsync("PUT", $"/api/companies/{CompanyA}", Input(company, value)));
        Assert.Equal(HttpStatusCode.BadRequest, await staff.SendAsync("POST", "/api/companies", Input(company, value)));
        Assert.Equal(HttpStatusCode.BadRequest, await alfa.SendAsync("PUT", $"/api/companies/{CompanyA}", Input(company, value)));

        Assert.Equal(before, await api.ScalarAsync<long>("SELECT count(*) FROM pending_changes"));
        Assert.Equal("0599 000 11 13", await StoredAsync(CompanyA));
    }

    [Theory]
    [InlineData("+90 (599) 000-11-14", "+90 (599) 000-11-14")]
    [InlineData("   ", null)]
    public async Task Staff_value_is_stored_clean(string value, string? stored)
    {
        var staff = await api.As(Staff);
        var company = await staff.JsonAsync($"/api/catalog/companies/{CompanyA}");
        Assert.Equal(HttpStatusCode.OK, await staff.SendAsync("PUT", $"/api/companies/{CompanyA}", Input(company, value)));
        Assert.Equal(stored, await StoredAsync(CompanyA));
    }
}
