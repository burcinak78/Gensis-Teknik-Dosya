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
    // With a content type (PUT), the browser must send exactly that Content-Type header.
    public Task<string> PresignAsync(string bucket, string key, HttpVerb verb, TimeSpan lifetime, string? contentType = null) =>
        _public.GetPreSignedURLAsync(new GetPreSignedUrlRequest
        {
            BucketName = bucket,
            Key = key,
            Verb = verb,
            ContentType = contentType,
            Expires = DateTime.UtcNow.Add(lifetime),
            Protocol = _public.Config.ServiceURL.StartsWith("https", StringComparison.OrdinalIgnoreCase) ? Protocol.HTTPS : Protocol.HTTP,
        });

    /// <summary>Size in bytes, or null when the object does not exist.</summary>
    public async Task<long?> SizeAsync(string bucket, string key, CancellationToken ct = default)
    {
        try
        {
            return (await _internal.GetObjectMetadataAsync(bucket, key, ct)).ContentLength;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public Task DeleteAsync(string bucket, string key, CancellationToken ct = default) =>
        _internal.DeleteObjectAsync(bucket, key, ct);

    /// <summary>
    /// Deletes objects after their rows are gone. Failures only leave orphaned objects behind,
    /// so they are logged instead of failing a request whose database change is already committed.
    /// </summary>
    public async Task DeleteQuietlyAsync(string bucket, IEnumerable<string> keys, ILogger logger)
    {
        foreach (var key in keys)
        {
            try
            {
                await _internal.DeleteObjectAsync(bucket, key);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not delete {Bucket}/{Key}", bucket, key);
            }
        }
    }
}
