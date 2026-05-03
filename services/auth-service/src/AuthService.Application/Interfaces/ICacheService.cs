namespace AuthService.Application.Interfaces;

public interface ICacheService
{
    Task<int> IncrementLoginAttemptAsync(string username, TimeSpan ttl);
    Task ClearLoginAttemptsAsync(string username);
    Task<bool> SetNxAsync(string key, string value, TimeSpan ttl);
    Task RevokeTokenInCacheAsync(string jti, TimeSpan ttl);
}
