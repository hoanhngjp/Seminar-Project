namespace UserService.Application.Interfaces;

public interface IRedisCache
{
    Task<T?> GetAsync<T>(string key, CancellationToken ct = default);
    Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default);
    Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan ttl);
    Task DeleteAsync(string key);
}
