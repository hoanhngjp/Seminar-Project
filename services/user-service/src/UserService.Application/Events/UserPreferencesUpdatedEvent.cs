namespace UserService.Application.Events;

public record UserPreferencesUpdatedEvent(
    string EventId,
    string Version,
    string Timestamp,
    string CorrelationId,
    string UserId,
    List<string> PreferredGenres,
    List<string> PreferredArtists,
    string AudioQuality
) : IKafkaEvent;
