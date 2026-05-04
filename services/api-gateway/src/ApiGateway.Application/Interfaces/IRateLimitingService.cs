namespace ApiGateway.Application.Interfaces;

public interface IRateLimitingService
{
    Task<bool> IsAllowedAsync(string key, int limitPerMinute, CancellationToken ct = default);
}
