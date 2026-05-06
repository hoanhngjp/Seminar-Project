using AnalyticsService.Application.DTOs;

namespace AnalyticsService.Application.Interfaces;

public interface IAnalyticsCache
{
    Task<HeatmapResponse?> GetHeatmapAsync(Guid songId, string timeRange, CancellationToken ct = default);
    Task SetHeatmapAsync(Guid songId, string timeRange, HeatmapResponse data, CancellationToken ct = default);

    Task<StatsResponse?> GetStatsAsync(Guid songId, CancellationToken ct = default);
    Task SetStatsAsync(Guid songId, StatsResponse data, CancellationToken ct = default);
}
