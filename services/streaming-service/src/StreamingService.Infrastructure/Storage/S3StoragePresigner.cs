using Amazon.S3;
using Amazon.S3.Model;
using StreamingService.Application.Interfaces;

namespace StreamingService.Infrastructure.Storage;

public class S3StoragePresigner : IStoragePresigner
{
    private readonly IAmazonS3 _s3;

    public S3StoragePresigner(IAmazonS3 s3)
    {
        _s3 = s3;
    }

    public Task<string> GeneratePresignedUrlAsync(string bucket, string storageKey, CancellationToken ct)
    {
        var request = new GetPreSignedUrlRequest
        {
            BucketName = bucket,
            Key = storageKey,
            // Exactly 900 seconds — AC3.1.3
            Expires = DateTime.UtcNow.AddSeconds(900),
            Verb = HttpVerb.GET
        };

        var url = _s3.GetPreSignedURL(request);
        return Task.FromResult(url);
    }

    public async Task<StorageRangeResult> GetRangeAsync(
        string bucket,
        string storageKey,
        long? rangeStart,
        long? rangeEnd,
        CancellationToken ct)
    {
        var request = new GetObjectRequest
        {
            BucketName = bucket,
            Key = storageKey
        };

        bool isPartial = rangeStart.HasValue || rangeEnd.HasValue;
        if (isPartial)
        {
            request.ByteRange = new ByteRange(
                rangeStart ?? 0,
                rangeEnd ?? long.MaxValue);
        }

        var response = await _s3.GetObjectAsync(request, ct);

        long totalBytes = response.ContentLength;
        string contentType = response.Headers.ContentType ?? "audio/mpeg";

        string contentRange;
        if (isPartial)
        {
            // S3 returns Content-Range header on partial responses
            contentRange = response.Headers["Content-Range"]
                ?? $"bytes {rangeStart ?? 0}-{(rangeEnd.HasValue ? rangeEnd.Value : totalBytes - 1)}/{totalBytes}";
        }
        else
        {
            contentRange = $"bytes 0-{totalBytes - 1}/{totalBytes}";
        }

        return new StorageRangeResult(
            response.ResponseStream,
            contentRange,
            totalBytes,
            contentType,
            isPartial);
    }
}
