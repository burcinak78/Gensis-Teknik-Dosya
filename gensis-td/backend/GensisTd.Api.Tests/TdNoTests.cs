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
    [InlineData(null, 0)]
    [InlineData("TD-26-0001", 1)]
    [InlineData("TD-26-0099", 99)]
    [InlineData("TD-26-10000", 10000)]
    [InlineData("TD-26-0041 ", 41)]
    [InlineData("TD-26-", 0)]
    public void Last_number_is_the_trailing_digits(string? tdNo, int number) =>
        Assert.Equal(number, ProjectWriteEndpoints.LastNumber(tdNo));

    [Theory]
    [InlineData(1, "TD-26-0001")]
    [InlineData(100, "TD-26-0100")]
    [InlineData(10000, "TD-26-10000")]
    public void Format_pads_to_four_digits(int number, string tdNo) =>
        Assert.Equal(tdNo, ProjectWriteEndpoints.FormatTdNo("TD-26-", number));
}
