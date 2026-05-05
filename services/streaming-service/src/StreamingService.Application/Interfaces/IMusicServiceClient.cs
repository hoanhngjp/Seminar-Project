namespace StreamingService.Application.Interfaces;

public interface IMusicServiceClient
{
    /// <summary>
    /// Calls GET /internal/songs/{songId}/storage-key on the Music Service.
    /// Returns (storageKey, bucket) or throws KeyNotFoundException if 404.
    /// Timeout: 150ms enforced by the caller via CancellationToken.
    /// </summary>
    Task<StorageKeyResult> GetStorageKeyAsync(Guid songId, CancellationToken ct);
}

public record StorageKeyResult(string StorageKey, string Bucket);
