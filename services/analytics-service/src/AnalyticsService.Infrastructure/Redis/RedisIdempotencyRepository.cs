using AnalyticsService.Application.Interfaces;
using StackExchange.Redis;

namespace AnalyticsService.Infrastructure.Redis;

public class RedisIdempotencyRepository(IDatabase redis) : IIdempotencyRepository
{
    public async Task<bool> CheckAndSetAsync(string key, TimeSpan ttl, CancellationToken ct = default)
    {
        // SET NX — atomic; returns false (key set) if new, true (already existed) if duplicate
        var set = await redis.StringSetAsync(key, "1", ttl, When.NotExists);
        return !set; // true = duplicate
    }
}
