using AnalyticsService.Application.DTOs;
using AnalyticsService.Application.Interfaces;
using AnalyticsService.Domain.Models;
using Microsoft.Extensions.Logging;

namespace AnalyticsService.Application.Services;

public class AnalyticsService(
    IIdempotencyRepository idempotency,
    IEventPublisher publisher,
    IAnalyticsRepository analyticsRepo,
    IAnalyticsCache cache,
    IMusicServiceClient musicClient,
    ILogger<AnalyticsService> logger) : IAnalyticsService
{
    private static readonly TimeSpan IdempotencyTtl = TimeSpan.FromHours(24);
    private static readonly TimeSpan CacheTtl = TimeSpan.FromHours(6);

    // AC4.1.3: duplicate idempotency key → skip
    // AC4.1.4: trả 202 ngay — caller fires-and-forgets background work
    public async Task<bool> RecordPlayAsync(
        string idempotencyKey, Guid userId, RecordPlayRequest request, CancellationToken ct = default)
    {
        var redisKey = $"analytics:idem:{idempotencyKey}";
        var isDuplicate = await idempotency.CheckAndSetAsync(redisKey, IdempotencyTtl, ct);
        if (isDuplicate)
        {
            logger.LogInformation("Duplicate idempotency key {Key} — skipping.", idempotencyKey);
            return false;
        }

        var ev = new PlayEvent(
            EventId: idempotencyKey,
            UserId: userId,
            SongId: request.SongId,
            DurationSec: request.DurationSec,
            ListenedSec: request.ListenedSec,
            Platform: request.Platform,
            OccurredAt: DateTimeOffset.UtcNow
        );

        // Fire-and-forget background: Kafka + InfluxDB
        // Controller already returned 202 before this executes
        _ = Task.Run(async () =>
        {
            try
            {
                await publisher.PublishPlayEventAsync(ev);
                await analyticsRepo.WritePlayEventAsync(ev);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Background write failed for event {EventId}", ev.EventId);
            }
        }, CancellationToken.None);

        return true;
    }

    // AC4.2.4: cache hit < 500ms; stale fallback on InfluxDB timeout
    public async Task<(HeatmapResponse Data, bool CacheHit)> GetHeatmapAsync(
        Guid songId, string timeRange, CancellationToken ct = default)
    {
        var cached = await TryGetCachedHeatmapAsync(songId, timeRange, ct);
        if (cached is not null) return (cached, true);

        try
        {
            var data = await analyticsRepo.GetHeatmapAsync(songId, timeRange, ct);
            await TrySetHeatmapCacheAsync(songId, timeRange, data, ct);
            return (data, false);
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("InfluxDB timeout fetching heatmap for song {SongId} — returning empty.", songId);
            return (new HeatmapResponse([]), false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "InfluxDB error fetching heatmap for song {SongId}.", songId);
            return (new HeatmapResponse([]), false);
        }
    }

    public async Task<(StatsResponse Data, bool CacheHit)> GetStatsAsync(
        Guid songId, CancellationToken ct = default)
    {
        var cached = await TryGetCachedStatsAsync(songId, ct);
        if (cached is not null) return (cached, true);

        try
        {
            var data = await analyticsRepo.GetStatsAsync(songId, ct);
            await TrySetStatsCacheAsync(songId, data, ct);
            return (data, false);
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("InfluxDB timeout fetching stats for song {SongId} — returning zeros.", songId);
            return (new StatsResponse(0, 0, 0, 0, []), false);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "InfluxDB error fetching stats for song {SongId}.", songId);
            return (new StatsResponse(0, 0, 0, 0, []), false);
        }
    }

    // Returns null → song not found; true → owns it; false → does not own
    public async Task<bool?> VerifyOwnershipAsync(Guid songId, Guid userId, CancellationToken ct = default)
    {
        try
        {
            var artistId = await musicClient.GetSongArtistIdAsync(songId, ct);
            if (artistId is null) return null;
            return artistId.Value == userId;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to verify ownership for song {SongId}.", songId);
            return null;
        }
    }

    // ── private cache helpers ────────────────────────────────────────

    private async Task<HeatmapResponse?> TryGetCachedHeatmapAsync(Guid songId, string timeRange, CancellationToken ct)
    {
        try { return await cache.GetHeatmapAsync(songId, timeRange, ct); }
        catch (Exception ex) { logger.LogWarning(ex, "Redis heatmap get failed."); return null; }
    }

    private async Task TrySetHeatmapCacheAsync(Guid songId, string timeRange, HeatmapResponse data, CancellationToken ct)
    {
        try { await cache.SetHeatmapAsync(songId, timeRange, data, ct); }
        catch (Exception ex) { logger.LogWarning(ex, "Redis heatmap set failed."); }
    }

    private async Task<StatsResponse?> TryGetCachedStatsAsync(Guid songId, CancellationToken ct)
    {
        try { return await cache.GetStatsAsync(songId, ct); }
        catch (Exception ex) { logger.LogWarning(ex, "Redis stats get failed."); return null; }
    }

    private async Task TrySetStatsCacheAsync(Guid songId, StatsResponse data, CancellationToken ct)
    {
        try { await cache.SetStatsAsync(songId, data, ct); }
        catch (Exception ex) { logger.LogWarning(ex, "Redis stats set failed."); }
    }
}
