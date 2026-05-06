namespace AnalyticsService.Application.Interfaces;

public interface IIdempotencyRepository
{
    /// <summary>Returns true if key already existed (duplicate — skip processing).</summary>
    Task<bool> CheckAndSetAsync(string key, TimeSpan ttl, CancellationToken ct = default);
}
