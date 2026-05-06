using NotificationService.Application.Interfaces;
using StackExchange.Redis;

namespace NotificationService.Infrastructure.Redis;

public class RedisIdempotencyRepository(IConnectionMultiplexer redis) : IIdempotencyRepository
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<bool> TrySetAsync(string key, TimeSpan ttl, CancellationToken ct = default)
        => await _db.StringSetAsync(key, "1", ttl, When.NotExists).ConfigureAwait(false);
}
