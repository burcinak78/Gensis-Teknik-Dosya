using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using NpgsqlTypes;

namespace GensisTd.Api.Data;

/// <summary>
/// Enums in JSON use their database names ([PgName], e.g. "draft", "elektrik_elektronik", "B_MR"),
/// the same values the frontend used with Supabase. Enums without [PgName] fall back to the member name.
/// </summary>
public sealed class PgNameEnumConverterFactory : JsonConverterFactory
{
    public override bool CanConvert(Type t) => t.IsEnum;

    public override JsonConverter CreateConverter(Type t, JsonSerializerOptions options) =>
        (JsonConverter)Activator.CreateInstance(typeof(PgNameEnumConverter<>).MakeGenericType(t))!;

    private sealed class PgNameEnumConverter<T> : JsonConverter<T> where T : struct, Enum
    {
        private static readonly Dictionary<T, string> ToName = Enum.GetValues<T>().ToDictionary(v => v, Name);
        private static readonly Dictionary<string, T> FromName = ToName.ToDictionary(kv => kv.Value, kv => kv.Key, StringComparer.Ordinal);

        private static string Name(T value) =>
            typeof(T).GetField(value.ToString())!.GetCustomAttribute<PgNameAttribute>()?.PgName ?? value.ToString();

        public override T Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
            reader.GetString() is { } s && FromName.TryGetValue(s, out var v) ? v : throw new JsonException($"Invalid {typeof(T).Name}: {reader.GetString()}");

        public override void Write(Utf8JsonWriter writer, T value, JsonSerializerOptions options) => writer.WriteStringValue(ToName[value]);
    }
}

/// <summary>Database names of enum members ([PgName]), for payloads stored as JSON.</summary>
public static class PgNames
{
    public static string Of<T>(T value) where T : struct, Enum =>
        typeof(T).GetField(value.ToString())!.GetCustomAttribute<PgNameAttribute>()?.PgName ?? value.ToString();

    public static T Parse<T>(string name) where T : struct, Enum =>
        Enum.GetValues<T>().First(v => Of(v) == name);
}
