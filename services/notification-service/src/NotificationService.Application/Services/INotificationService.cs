using NotificationService.Application.DTOs;

namespace NotificationService.Application.Services;

public interface INotificationService
{
    Task<GetUnreadResponse> GetUnreadAsync(Guid userId, int limit, string? cursor, CancellationToken ct);

    /// <summary>Returns false if duplicate (idempotency conflict).</summary>
    Task<(bool Success, MarkReadResponse? Result)> MarkReadAsync(
        string notificationId, Guid userId, string idempotencyKey, CancellationToken ct);

    Task QueueMarkAllReadAsync(Guid userId, CancellationToken ct);

    Task<FanOutResult> FanOutNewReleaseAsync(NewReleaseEventDto @event, CancellationToken ct);
}
