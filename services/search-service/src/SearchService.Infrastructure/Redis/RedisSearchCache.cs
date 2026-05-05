using System.Text.Json;
using Microsoft.Extensions.Logging;
using SearchService.Application.DTOs;
using SearchService.Application.Interfaces;
using StackExchange.Redis;

namespace SearchService.Infrastructure.Redis;

public class RedisSearchCache(
    IDatabase redis,
    ILogger<RedisSearchCache> logger) : ISearchCache
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(600); // 10 min

    public async Task<(SearchResponse? Response, bool Hit)> GetAsync(string key, CancellationToken ct)
    {
        try
        {
            var value = await redis.StringGetAsync(key);
            if (value.IsNullOrEmpty) return (null, false);

            var response = JsonSerializer.Deserialize<SearchResponse>(value!);
            return (response, true);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis read failed for key {Key} — cache miss.", key);
            return (null, false);
        }
    }

    public async Task SetAsync(string key, SearchResponse response, CancellationToken ct)
    {
        try
        {
            var json = JsonSerializer.Serialize(response);
            await redis.StringSetAsync(key, json, CacheTtl);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis write failed for key {Key} — continuing without cache.", key);
        }
    }
}
