using System.Text.Json;
using AnalyticsService.Application.Interfaces;
using InfluxDB.Client;
using InfluxDB.Client.Api.Domain;
using InfluxDB.Client.Writes;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AnalyticsService.Infrastructure.Kafka.Handlers;

/// <summary>Consumes Song_Skipped events → writes song_skipped measurement to InfluxDB.</summary>
public class SongSkippedHandler(
    IIdempotencyRepository idempotency,
    InfluxDBClient influxClient,
    IConfiguration configuration,
    ILogger<SongSkippedHandler> logger) : IKafkaConsumerHandler
{
    public string Topic => "Song_Skipped";
    public string ConsumerGroup => "analytics-service";

    private readonly string _org = configuration["InfluxDB:Org"] ?? "smartmusic";
    private readonly string _bucket = configuration["InfluxDB:Bucket"] ?? "analytics";

    public async Task HandleAsync(string key, string value, CancellationToken ct)
    {
        SongSkippedPayload? payload;
        try { payload = JsonSerializer.Deserialize<SongSkippedPayload>(value); }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to deserialize Song_Skipped message.");
            return;
        }

        if (payload is null || string.IsNullOrWhiteSpace(payload.EventId)) return;

        var dedupKey = $"dedup:analytics:Song_Skipped:{payload.EventId}";
        var isDuplicate = await idempotency.CheckAndSetAsync(dedupKey, TimeSpan.FromHours(24), ct);
        if (isDuplicate) return;

        var point = PointData
            .Measurement("song_skipped")
            .Tag("song_id", payload.SongId.ToString())
            .Tag("user_id", payload.UserId.ToString())  // UUID only — PII rule
            .Tag("skip_trigger", payload.SkipTrigger ?? "unknown")
            .Field("duration_sec", (long)payload.DurationSec)
            .Field("skip_at_sec", (long)payload.SkipAtSec)
            .Field("duration_percent", payload.DurationPercent)
            .Timestamp(payload.OccurredAt.UtcDateTime, WritePrecision.Ms);

        try
        {
            var writeApi = influxClient.GetWriteApiAsync();
            await writeApi.WritePointAsync(point, _bucket, _org, ct);
            logger.LogInformation("Song_Skipped event {EventId} written to InfluxDB.", payload.EventId);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "InfluxDB write failed for Song_Skipped event {EventId}.", payload.EventId);
        }
    }

    private record SongSkippedPayload(
        string EventId,
        Guid UserId,
        Guid SongId,
        int DurationSec,
        int SkipAtSec,
        double DurationPercent,
        string? SkipTrigger,
        DateTimeOffset OccurredAt
    );
}
