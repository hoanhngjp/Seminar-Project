using System.Text.Json;
using AnalyticsService.Application.Interfaces;
using InfluxDB.Client;
using InfluxDB.Client.Api.Domain;
using InfluxDB.Client.Writes;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AnalyticsService.Infrastructure.Kafka.Handlers;

/// <summary>Consumes Notification_Sent events → increments delivery counter in InfluxDB.</summary>
public class NotificationSentHandler(
    IIdempotencyRepository idempotency,
    InfluxDBClient influxClient,
    IConfiguration configuration,
    ILogger<NotificationSentHandler> logger) : IKafkaConsumerHandler
{
    public string Topic => "Notification_Sent";
    public string ConsumerGroup => "analytics-service";

    private readonly string _org = configuration["InfluxDB:Org"] ?? "smartmusic";
    private readonly string _bucket = configuration["InfluxDB:Bucket"] ?? "analytics";

    public async Task HandleAsync(string key, string value, CancellationToken ct)
    {
        NotificationSentPayload? payload;
        try { payload = JsonSerializer.Deserialize<NotificationSentPayload>(value); }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to deserialize Notification_Sent message.");
            return;
        }

        if (payload is null || string.IsNullOrWhiteSpace(payload.NotificationId)) return;

        var dedupKey = $"dedup:analytics:Notification_Sent:{payload.NotificationId}";
        var isDuplicate = await idempotency.CheckAndSetAsync(dedupKey, TimeSpan.FromHours(24), ct);
        if (isDuplicate) return;

        var point = PointData
            .Measurement("notification_sent")
            .Tag("notification_type", payload.Type ?? "unknown")
            .Field("count", 1L)
            .Timestamp(DateTime.UtcNow, WritePrecision.Ms);

        try
        {
            var writeApi = influxClient.GetWriteApiAsync();
            await writeApi.WritePointAsync(point, _bucket, _org, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "InfluxDB write failed for Notification_Sent {Id}.", payload.NotificationId);
        }
    }

    private record NotificationSentPayload(
        string NotificationId,
        string? Type,
        DateTimeOffset SentAt
    );
}
