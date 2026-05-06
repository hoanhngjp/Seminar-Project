using AnalyticsService.Application.DTOs;
using AnalyticsService.Domain.Models;

namespace AnalyticsService.Application.Services;

public interface IAnalyticsService
{
    /// <summary>
    /// Validates idempotency key, publishes Kafka event + writes InfluxDB async.
    /// Returns false if the idempotency key was already used (duplicate).
    /// </summary>
    Task<bool> RecordPlayAsync(
        string idempotencyKey, Guid userId, RecordPlayRequest request, CancellationToken ct = default);

    /// <summary>Returns heatmap from cache or InfluxDB. Stale cache on timeout.</summary>
    Task<(HeatmapResponse Data, bool CacheHit)> GetHeatmapAsync(
        Guid songId, string timeRange, CancellationToken ct = default);

    /// <summary>Returns stats from cache or InfluxDB. Stale cache on timeout.</summary>
    Task<(StatsResponse Data, bool CacheHit)> GetStatsAsync(
        Guid songId, CancellationToken ct = default);

    /// <summary>Verifies Creator owns the song. Returns null if song not found.</summary>
    Task<bool?> VerifyOwnershipAsync(Guid songId, Guid userId, CancellationToken ct = default);
}
