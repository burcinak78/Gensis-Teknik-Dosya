using GensisTd.Api.Endpoints;

namespace GensisTd.Api.Tests;

public class ProjectEndpointTests
{
    [Fact]
    public void Month_starts_at_turkish_midnight()
    {
        // 31 Oct 22:00 UTC is already 1 Nov 01:00 in Turkey (UTC+3).
        var start = ProjectEndpoints.MonthStartUtc(new DateTime(2026, 10, 31, 22, 0, 0, DateTimeKind.Utc));
        Assert.Equal(new DateTime(2026, 10, 31, 21, 0, 0), start);
    }

    [Fact]
    public void Month_start_mid_month()
    {
        var start = ProjectEndpoints.MonthStartUtc(new DateTime(2026, 10, 15, 12, 0, 0, DateTimeKind.Utc));
        Assert.Equal(new DateTime(2026, 9, 30, 21, 0, 0), start);
    }
}
