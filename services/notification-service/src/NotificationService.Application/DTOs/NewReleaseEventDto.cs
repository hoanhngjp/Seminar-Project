namespace NotificationService.Application.DTOs;

// Matches kafka-schemas/new_release.v1.json
public record NewReleaseEventDto(
    string EventId,
    string Version,
    string Timestamp,
    string CorrelationId,
    string ArtistId,
    string ArtistName,
    string SongId,
    string SongTitle,
    string? AlbumId,
    string[] GenreIds,
    string ThumbnailUrl,
    string S3StorageKey,
    int DurationSec,
    bool Explicit
);

// Matches kafka-schemas/notification_sent.v1.json
public record NotificationSentEventDto(
    string EventId,
    string Version,
    string Timestamp,
    string CorrelationId,
    string NotificationId,
    string RecipientUserId,
    string NotificationType,
    string? ArtistId,
    string? SongId,
    string DeliveryStatus,
    int RetryCount,
    string Channel
);
