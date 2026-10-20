using GensisTd.Api.Endpoints;

namespace GensisTd.Api.Tests;

public class TdNoTests
{
    [Theory]
    [InlineData(2026, "TD-26-")]
    [InlineData(2030, "TD-30-")]
    [InlineData(2101, "TD-01-")]
    public void Prefix_uses_two_digit_year(int year, string prefix) => Assert.Equal(prefix, ProjectWriteEndpoints.TdPrefix(year));

    [Theory]
    [InlineData(null, "TD-26-0001")]
    [InlineData("TD-26-0001", "TD-26-0002")]
    [InlineData("TD-26-0099", "TD-26-0100")]
    [InlineData("TD-26-9999", "TD-26-10000")]
    [InlineData("TD-26-0041 ", "TD-26-0042")]
    [InlineData("TD-26-", "TD-26-0001")]
    public void Next_number_follows_last(string? last, string next) =>
        Assert.Equal(next, ProjectWriteEndpoints.NextTdNo("TD-26-", last));
}
