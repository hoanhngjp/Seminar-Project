using System.Text.Json;
using Microsoft.Extensions.Logging;
using NotificationService.Application.DTOs;
using NotificationService.Application.Services;

namespace NotificationService.Infrastructure.Kafka;

public class NewReleaseHandler(INotificationService notificationService, ILogger<NewReleaseHandler> logger)
{
    public async Task HandleAsync(string json, CancellationToken ct)
    {
        NewReleaseEventDto? @event;
        try
        {
            @event = JsonSerializer.Deserialize<NewReleaseEventDto>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException ex)
        {
            logger.LogError(ex, "Failed to deserialize NewReleaseEvent payload");
            throw;
        }

        if (@event is null)
        {
            logger.LogWarning("Deserialized NewReleaseEvent is null — skipping");
            return;
        }

        logger.LogInformation(
            "Processing NewRelease. EventId={EventId} ArtistId={ArtistId} SongId={SongId}",
            @event.EventId, @event.ArtistId, @event.SongId);

        var result = await notificationService.FanOutNewReleaseAsync(@event, ct);

        logger.LogInformation(
            "Fan-out done. EventId={EventId} NotificationsCreated={Count}",
            @event.EventId, result.NotificationsCreated);
    }
}
