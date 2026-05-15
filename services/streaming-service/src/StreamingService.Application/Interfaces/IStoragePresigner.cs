namespace StreamingService.Application.Interfaces;

public interface IStoragePresigner
{
    /// <summary>Generates a pre-signed GET URL valid for exactly 900 seconds.</summary>
    Task<string> GeneratePresignedUrlAsync(string bucket, string storageKey, CancellationToken ct);

    /// <summary>Fetches a byte range from GCS and returns the response stream + metadata.</summary>
    Task<StorageRangeResult> GetRangeAsync(string bucket, string storageKey, long? rangeStart, long? rangeEnd, CancellationToken ct);
}

public record StorageRangeResult(
    Stream Content,
    string ContentRange,
    long TotalBytes,
    string ContentType,
    bool IsPartial);
