using NotificationService.Domain.Models;

namespace NotificationService.Application.Interfaces;

public interface INotificationRepository
{
    /// <summary>Returns unread (Pending/Delivered) notifications for a user, cursor-paginated.</summary>
    Task<(IReadOnlyList<Notification> Items, string? NextCursor)> GetUnreadAsync(
        Guid recipientId, int limit, string? cursor, CancellationToken ct);

    Task<Notification?> GetByIdAsync(string id, CancellationToken ct);

    Task MarkReadAsync(string id, DateTime readAt, CancellationToken ct);

    /// <summary>Bulk-marks all Pending/Delivered notifications for a user as Read.</summary>
    Task MarkAllReadAsync(Guid recipientId, DateTime readAt, CancellationToken ct);

    Task InsertAsync(Notification notification, CancellationToken ct);

    Task InsertManyAsync(IEnumerable<Notification> notifications, CancellationToken ct);
}
