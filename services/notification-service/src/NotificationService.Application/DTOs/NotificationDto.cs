namespace NotificationService.Application.DTOs;

public record NotificationDto(
    string Id,
    string Type,
    string Status,
    string Title,
    string Body,
    string? ThumbnailUrl,
    string? ArtistId,
    string? SongId,
    DateTime CreatedAt
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
