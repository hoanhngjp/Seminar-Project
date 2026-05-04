using ApiGateway.Application.Interfaces;
using StackExchange.Redis;

namespace ApiGateway.Infrastructure.Services;

public class RateLimitingService(IDatabase redis) : IRateLimitingService
{
    // Sliding window using Redis Sorted Set
    // Key: gateway:ratelimit:ip:{ip} or gateway:ratelimit:login:{ip}:{usernameHash}
    public async Task<bool> IsAllowedAsync(string key, int limitPerMinute, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var windowStartMs = now - 60_000;
        var member = now.ToString();

        // Remove entries outside the 60s window
        await redis.SortedSetRemoveRangeByScoreAsync(key, 0, windowStartMs);

        // Count remaining entries in window
        var count = await redis.SortedSetLengthAsync(key);

        if (count >= limitPerMinute)
            return false;

        // Add current request
        await redis.SortedSetAddAsync(key, member, now);
        await redis.KeyExpireAsync(key, TimeSpan.FromSeconds(61));

        return true;
    }
}
