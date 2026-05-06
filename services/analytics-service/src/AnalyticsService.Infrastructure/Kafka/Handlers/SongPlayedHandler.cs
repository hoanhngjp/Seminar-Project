using System.Text.Json;
using AnalyticsService.Application.Interfaces;
using AnalyticsService.Domain.Models;
using Microsoft.Extensions.Logging;

namespace AnalyticsService.Infrastructure.Kafka.Handlers;

/// <summary>Consumes Song_Played events → writes to InfluxDB with idempotency dedup.</summary>
public class SongPlayedHandler(
    IAnalyticsRepository analyticsRepo,
    IIdempotencyRepository idempotency,
    ILogger<SongPlayedHandler> logger) : IKafkaConsumerHandler
{
    public string Topic => "Song_Played";
    public string ConsumerGroup => "analytics-service";

    public async Task HandleAsync(string key, string value, CancellationToken ct)
    {
        SongPlayedPayload? payload;
        try { payload = JsonSerializer.Deserialize<SongPlayedPayload>(value); }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to deserialize Song_Played message: {Value}", value);
            return;
        }

        if (payload is null || string.IsNullOrWhiteSpace(payload.EventId))
        {
            logger.LogWarning("Received null/invalid Song_Played payload.");
            return;
        }

        // AC4.1.3: idempotency dedup — SET NX TTL 24h
        var dedupKey = $"dedup:analytics:Song_Played:{payload.EventId}";
        var isDuplicate = await idempotency.CheckAndSetAsync(dedupKey, TimeSpan.FromHours(24), ct);
        if (isDuplicate)
        {
            logger.LogInformation("Duplicate Song_Played event {EventId} — skipping.", payload.EventId);
            return;
        }

        var ev = new PlayEvent(
            EventId: payload.EventId,
            UserId: payload.UserId,
            SongId: payload.SongId,
            DurationSec: payload.DurationSec,
            ListenedSec: payload.ListenedSec,
            Platform: payload.Platform ?? "unknown",
            OccurredAt: payload.OccurredAt
        );

        await analyticsRepo.WritePlayEventAsync(ev, ct);
        logger.LogInformation("Song_Played event {EventId} written to InfluxDB.", payload.EventId);
    }

    private record SongPlayedPayload(
        string EventId,
        Guid UserId,
        Guid SongId,
        int DurationSec,
        int ListenedSec,
        string? Platform,
        DateTimeOffset OccurredAt
    );
}
