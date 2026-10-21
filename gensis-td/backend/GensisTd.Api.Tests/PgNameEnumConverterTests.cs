using System.Text.Json;
using GensisTd.Api.Data;

namespace GensisTd.Api.Tests;

public class PgNameEnumConverterTests
{
    private static readonly JsonSerializerOptions Options = new() { Converters = { new PgNameEnumConverterFactory() } };

    [Theory]
    [InlineData(AppRole.Admin, "\"admin\"")]
    [InlineData(ProjectStatus.Draft, "\"draft\"")]
    [InlineData(EngineerDiscipline.ElektrikElektronik, "\"elektrik_elektronik\"")]
    [InlineData(ModuleType.BMr, "\"B_MR\"")]
    public void Writes_and_reads_database_names(object value, string json)
    {
        Assert.Equal(json, JsonSerializer.Serialize(value, value.GetType(), Options));
        Assert.Equal(value, JsonSerializer.Deserialize(json, value.GetType(), Options));
    }

    [Fact]
    public void Unknown_name_is_rejected()
    {
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<AppRole>("\"Admin\"", Options));
    }
}
