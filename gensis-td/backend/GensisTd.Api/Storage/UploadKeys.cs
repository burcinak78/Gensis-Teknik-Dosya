using System.Text.RegularExpressions;

namespace GensisTd.Api.Storage;

/// <summary>
/// Storage keys chosen by the server for browser uploads: {prefix}/{ownerId}/{kind}-{uuid}.{ext}, with
/// "pending/" in front for changes that wait for approval. The confirm step only accepts a key of this
/// shape for the same owner, so a client cannot attach someone else's object or escape the folder.
/// </summary>
public static partial class UploadKeys
{
    public const string PendingPrefix = "pending/";
    public const long MaxBytes = 50 * 1024 * 1024;
    public static readonly TimeSpan UploadLifetime = TimeSpan.FromMinutes(10);

    public static string New(string folder, Guid ownerId, string kind, string? fileName, bool pending)
    {
        var ext = NonAlnum().Replace(Path.GetExtension(fileName ?? "").TrimStart('.').ToLowerInvariant(), "");
        if (ext.Length is 0 or > 10) ext = "bin";
        return $"{(pending ? PendingPrefix : "")}{folder}/{ownerId}/{kind}-{Guid.NewGuid()}.{ext}";
    }

    /// <summary>The kind encoded in a key issued by <see cref="New"/> for this folder and owner, or null.</summary>
    public static string? KindOf(string folder, Guid ownerId, string key, bool pending)
    {
        var m = KeyPattern().Match(key);
        return m.Success && m.Groups["pending"].Success == pending && m.Groups["folder"].Value == folder
            && m.Groups["owner"].Value == ownerId.ToString()
            ? m.Groups["kind"].Value
            : null;
    }

    /// <summary>Document kinds become part of the key, so they are limited to a safe alphabet.</summary>
    public static bool IsValidKind(string? kind) => kind is not null && KindPattern().IsMatch(kind);

    [GeneratedRegex("[^a-z0-9]")]
    private static partial Regex NonAlnum();

    [GeneratedRegex("^[a-z0-9_]{1,40}$")]
    private static partial Regex KindPattern();

    [GeneratedRegex(@"^(?<pending>pending/)?(?<folder>[a-z]+)/(?<owner>[0-9a-f-]{36})/(?<kind>[a-z0-9_]{1,40})-[0-9a-f-]{36}\.[a-z0-9]{1,10}$")]
    private static partial Regex KeyPattern();
}
