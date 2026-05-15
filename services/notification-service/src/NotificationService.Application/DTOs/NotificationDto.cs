namespace NotificationService.Application.DTOs;

public record NotificationDto(
    string NotificationId,
    string Message,
    bool Read,
    DateTime CreatedAt,
    string? Type
);

public record GetUnreadResponse(
    IReadOnlyList<NotificationDto> Items,
    string? NextCursor,
    bool HasMore
);

public record MarkReadResponse(
    string NotificationId,
    DateTime ReadAt
);

public record FanOutResult(int NotificationsCreated);
