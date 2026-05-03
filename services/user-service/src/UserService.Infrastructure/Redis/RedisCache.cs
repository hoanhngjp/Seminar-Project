using System.Text.Json;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;
using UserService.Application.Interfaces;

namespace UserService.Infrastructure.Redis;

public class RedisCache(IConnectionMultiplexer redis, ILogger<RedisCache> logger) : IRedisCache
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        var value = await _db.StringGetAsync(key).ConfigureAwait(false);
        if (value.IsNullOrEmpty) return default;
        return JsonSerializer.Deserialize<T>(value!);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(value);
        await _db.StringSetAsync(key, json, ttl).ConfigureAwait(false);
    }

    public async Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan ttl)
        => await _db.StringSetAsync(key, value, ttl, When.NotExists).ConfigureAwait(false);

    public async Task DeleteAsync(string key)
    {
        await _db.KeyDeleteAsync(key).ConfigureAwait(false);
        logger.LogDebug("Cache key deleted. Key={Key}", key);
    }
}
