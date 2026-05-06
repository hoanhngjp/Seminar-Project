namespace NotificationService.Application.Interfaces;

public interface IIdempotencyRepository
{
    /// <summary>Returns true if key is new (first time seen), false if duplicate.</summary>
    Task<bool> TrySetAsync(string key, TimeSpan ttl, CancellationToken ct = default);
}
