using AuthService.Application.Interfaces;
using StackExchange.Redis;

namespace AuthService.Infrastructure.Redis;

public class RedisCacheService(IConnectionMultiplexer redis) : ICacheService
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<int> IncrementLoginAttemptAsync(string username, TimeSpan ttl)
    {
        var key = $"login:attempts:{username}";
        var attempts = await _db.StringIncrementAsync(key);
        if (attempts == 1)
        {
            await _db.KeyExpireAsync(key, ttl);
        }
        return (int)attempts;
    }

    public async Task ClearLoginAttemptsAsync(string username)
    {
        var key = $"login:attempts:{username}";
        await _db.KeyDeleteAsync(key);
    }

    public async Task<bool> SetNxAsync(string key, string value, TimeSpan ttl)
    {
        return await _db.StringSetAsync(key, value, ttl, When.NotExists);
    }

    public async Task RevokeTokenInCacheAsync(string jti, TimeSpan ttl)
    {
        var key = $"token:blacklist:{jti}";
        await _db.StringSetAsync(key, "1", ttl);
    }
}
