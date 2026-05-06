using System.Text.Json;
using AnalyticsService.Application.DTOs;
using AnalyticsService.Application.Interfaces;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace AnalyticsService.Infrastructure.Redis;

public class RedisAnalyticsCache(IDatabase redis, ILogger<RedisAnalyticsCache> logger) : IAnalyticsCache
{
    private static readonly TimeSpan Ttl = TimeSpan.FromHours(6);

    public async Task<HeatmapResponse?> GetHeatmapAsync(Guid songId, string timeRange, CancellationToken ct = default)
    {
        var key = $"heatmap:{songId}:{timeRange}";
        return await GetAsync<HeatmapResponse>(key);
    }

    public async Task SetHeatmapAsync(Guid songId, string timeRange, HeatmapResponse data, CancellationToken ct = default)
    {
        var key = $"heatmap:{songId}:{timeRange}";
        await SetAsync(key, data);
    }

    public async Task<StatsResponse?> GetStatsAsync(Guid songId, CancellationToken ct = default)
    {
        var key = $"stats:{songId}";
        return await GetAsync<StatsResponse>(key);
    }

    public async Task SetStatsAsync(Guid songId, StatsResponse data, CancellationToken ct = default)
    {
        var key = $"stats:{songId}";
        await SetAsync(key, data);
    }

    private async Task<T?> GetAsync<T>(string key)
    {
        try
        {
            var value = await redis.StringGetAsync(key);
            if (value.IsNullOrEmpty) return default;
            return JsonSerializer.Deserialize<T>(value!);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis get failed for key {Key}", key);
            return default;
        }
    }

    private async Task SetAsync<T>(string key, T data)
    {
        try
        {
            var json = JsonSerializer.Serialize(data);
            await redis.StringSetAsync(key, json, Ttl);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis set failed for key {Key}", key);
        }
    }
}
