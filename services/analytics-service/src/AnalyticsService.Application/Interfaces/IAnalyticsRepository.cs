using AnalyticsService.Application.DTOs;
using AnalyticsService.Domain.Models;

namespace AnalyticsService.Application.Interfaces;

public interface IAnalyticsRepository
{
    Task WritePlayEventAsync(PlayEvent ev, CancellationToken ct = default);
    Task<HeatmapResponse> GetHeatmapAsync(Guid songId, string timeRange, CancellationToken ct = default);
    Task<StatsResponse> GetStatsAsync(Guid songId, CancellationToken ct = default);
}
