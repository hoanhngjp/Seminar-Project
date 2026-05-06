using System.Text.Json;
using AnalyticsService.Application.Interfaces;
using AnalyticsService.Domain.Models;
using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AnalyticsService.Infrastructure.Kafka;

public class KafkaEventPublisher(
    IConfiguration configuration,
    ILogger<KafkaEventPublisher> logger) : IEventPublisher, IDisposable
{
    private readonly Lazy<IProducer<string, string>> _producer = new(() =>
    {
        var bootstrapServers = configuration["Kafka:BootstrapServers"] ?? "localhost:9092";
        var config = new ProducerConfig { BootstrapServers = bootstrapServers };
        return new ProducerBuilder<string, string>(config).Build();
    });

    public async Task PublishPlayEventAsync(PlayEvent ev, CancellationToken ct = default)
    {
        var payload = JsonSerializer.Serialize(new
        {
            event_id = ev.EventId,
            user_id = ev.UserId,
            song_id = ev.SongId,
            duration_sec = ev.DurationSec,
            listened_sec = ev.ListenedSec,
            duration_percent = ev.DurationPercent,
            platform = ev.Platform,
            occurred_at = ev.OccurredAt
        });

        try
        {
            await _producer.Value.ProduceAsync(
                "Song_Played",
                new Message<string, string> { Key = ev.SongId.ToString(), Value = payload },
                ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Kafka publish failed for event {EventId} — event will be written to InfluxDB only.", ev.EventId);
            // Non-fatal: InfluxDB write still proceeds in the caller
        }
    }

    public void Dispose()
    {
        if (_producer.IsValueCreated)
        {
            _producer.Value.Flush(TimeSpan.FromSeconds(5));
            _producer.Value.Dispose();
        }
    }
}
