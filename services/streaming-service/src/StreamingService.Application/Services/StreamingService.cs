using StreamingService.Application.DTOs;
using StreamingService.Application.Interfaces;

namespace StreamingService.Application.Services;

public class StreamingService : IStreamingService
{
    private readonly IMusicServiceClient _musicClient;
    private readonly IStoragePresigner _presigner;

    public StreamingService(IMusicServiceClient musicClient, IStoragePresigner presigner)
    {
        _musicClient = musicClient;
        _presigner = presigner;
    }

    public async Task<StreamUrlResult> GetStreamUrlAsync(Guid songId, CancellationToken ct)
    {
        // 150ms total budget: music-service call + presign
        using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(150));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);

        var storageKey = await _musicClient.GetStorageKeyAsync(songId, linked.Token);
        var url = await _presigner.GeneratePresignedUrlAsync(storageKey.Bucket, storageKey.StorageKey, linked.Token);

        return new StreamUrlResult(url, 900);
    }

    public async Task<ChunkResult> GetChunkAsync(Guid songId, long? rangeStart, long? rangeEnd, CancellationToken ct)
    {
        // 1000ms total budget
        using var timeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(1000));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);

        // Use short timeout (150ms) only for metadata lookup
        using var metaTimeout = new CancellationTokenSource(TimeSpan.FromMilliseconds(150));
        using var metaLinked = CancellationTokenSource.CreateLinkedTokenSource(ct, metaTimeout.Token);

        var storageKey = await _musicClient.GetStorageKeyAsync(songId, metaLinked.Token);
        var rangeResult = await _presigner.GetRangeAsync(storageKey.Bucket, storageKey.StorageKey, rangeStart, rangeEnd, linked.Token);

        return new ChunkResult(
            rangeResult.Content,
            rangeResult.ContentRange,
            rangeResult.TotalBytes,
            rangeResult.ContentType,
            rangeResult.IsPartial);
    }
}
