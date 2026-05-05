using StreamingService.Application.DTOs;

namespace StreamingService.Application.Interfaces;

public interface IStreamingService
{
    /// <summary>
    /// Returns a pre-signed S3 URL (expiry 900s) for the given song.
    /// Throws KeyNotFoundException if song not found.
    /// Throws InvalidOperationException if upstream music-service or S3 unavailable.
    /// </summary>
    Task<StreamUrlResult> GetStreamUrlAsync(Guid songId, CancellationToken ct);

    /// <summary>
    /// Streams a byte range from S3 directly to the caller.
    /// Returns (stream, contentRange, totalBytes, contentType).
    /// Throws KeyNotFoundException if song not found.
    /// Throws InvalidOperationException if S3 unavailable.
    /// </summary>
    Task<ChunkResult> GetChunkAsync(Guid songId, long? rangeStart, long? rangeEnd, CancellationToken ct);
}
