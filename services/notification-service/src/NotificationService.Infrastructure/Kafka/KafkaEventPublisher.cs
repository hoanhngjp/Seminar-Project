using System.Text;
using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Interfaces;

namespace NotificationService.Infrastructure.Kafka;

public class KafkaEventPublisher : IEventPublisher, IDisposable
{
    private readonly IProducer<string, string> _producer;
    private readonly ILogger<KafkaEventPublisher> _logger;
    private readonly string _fallbackPath;

    public KafkaEventPublisher(IConfiguration config, ILogger<KafkaEventPublisher> logger)
    {
        _logger = logger;
        _fallbackPath = config["Kafka:LocalFallbackPath"] ?? "/tmp/notification-kafka-fallback";

        var producerConfig = new ProducerConfig
        {
            BootstrapServers = config["Kafka:BootstrapServers"],
            EnableIdempotence = true,
            Acks = Acks.All,
            MessageSendMaxRetries = 3,
            RetryBackoffMs = 1000
        };
        _producer = new ProducerBuilder<string, string>(producerConfig).Build();
    }

    public async Task PublishAsync<T>(string topic, T @event, CancellationToken ct) where T : class
    {
        var json = JsonSerializer.Serialize(@event, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        });

        // Use a stable key derived from the object's EventId if available via reflection
        var key = GetEventId(@event) ?? Guid.NewGuid().ToString();

        var message = new Message<string, string> { Key = key, Value = json };

        try
        {
            await _producer.ProduceAsync(topic, message, ct).ConfigureAwait(false);
            _logger.LogInformation("Kafka published. Topic={Topic} Key={Key}", topic, key);
        }
        catch (ProduceException<string, string> ex)
        {
            _logger.LogError(ex, "Kafka publish failed. Topic={Topic} — writing to local fallback", topic);
            await WriteFallbackAsync(topic, json).ConfigureAwait(false);
        }
    }

    private async Task WriteFallbackAsync(string topic, string json)
    {
        Directory.CreateDirectory(_fallbackPath);
        var file = Path.Combine(_fallbackPath,
            $"{topic}_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid()}.json");
        await System.IO.File.WriteAllTextAsync(file, json).ConfigureAwait(false);
    }

    private static string? GetEventId<T>(T @event)
    {
        var prop = typeof(T).GetProperty("EventId");
        return prop?.GetValue(@event)?.ToString();
    }

    public void Dispose() => _producer?.Dispose();
}
