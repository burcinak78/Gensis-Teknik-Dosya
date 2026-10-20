namespace GensisTd.Api.Storage;

public class StorageOptions
{
    public static readonly string[] Buckets = ["documents", "certificates"];

    // Address the backend uses (inside the compose network).
    public string Endpoint { get; set; } = "";
    // Address the browser uses; presigned URLs are signed for this host.
    public string PublicUrl { get; set; } = "";
    public string AccessKey { get; set; } = "";
    public string SecretKey { get; set; } = "";
}
