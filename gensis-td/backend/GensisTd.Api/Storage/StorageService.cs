using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Util;
using Microsoft.Extensions.Options;

namespace GensisTd.Api.Storage;

public class StorageService
{
    private readonly IAmazonS3 _internal;
    private readonly IAmazonS3 _public;

    public StorageService(IOptions<StorageOptions> options)
    {
        var o = options.Value;
        _internal = CreateClient(o.Endpoint, o);
        _public = CreateClient(string.IsNullOrEmpty(o.PublicUrl) ? o.Endpoint : o.PublicUrl, o);
    }

    private static AmazonS3Client CreateClient(string serviceUrl, StorageOptions o) =>
        new(new BasicAWSCredentials(o.AccessKey, o.SecretKey), new AmazonS3Config
        {
            ServiceURL = serviceUrl,
            ForcePathStyle = true,
            AuthenticationRegion = "us-east-1",
        });

    public async Task EnsureBucketsAsync(ILogger logger, CancellationToken ct = default)
    {
        // Storage may still be starting when the backend comes up.
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                foreach (var bucket in StorageOptions.Buckets)
                    if (!await AmazonS3Util.DoesS3BucketExistV2Async(_internal, bucket))
                        await _internal.PutBucketAsync(bucket, ct);
                return;
            }
            catch (Exception ex) when (attempt < 10)
            {
                logger.LogWarning("Storage not ready ({Message}), retrying", ex.Message);
                await Task.Delay(TimeSpan.FromSeconds(2), ct);
            }
        }
    }

    // Signing is local (no request is sent), so the public client works even if its host is unreachable from here.
    public Task<string> PresignAsync(string bucket, string key, HttpVerb verb, TimeSpan lifetime) =>
        _public.GetPreSignedURLAsync(new GetPreSignedUrlRequest
        {
            BucketName = bucket,
            Key = key,
            Verb = verb,
            Expires = DateTime.UtcNow.Add(lifetime),
            Protocol = _public.Config.ServiceURL.StartsWith("https", StringComparison.OrdinalIgnoreCase) ? Protocol.HTTPS : Protocol.HTTP,
        });
}
