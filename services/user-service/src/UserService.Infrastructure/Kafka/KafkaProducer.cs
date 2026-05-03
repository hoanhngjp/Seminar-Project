using System.Text;
using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using UserService.Application.Events;
using UserService.Application.Interfaces;

namespace UserService.Infrastructure.Kafka;

public class KafkaProducer : IKafkaProducer, IDisposable
{
    private readonly IProducer<string, string> _producer;
    private readonly ILogger<KafkaProducer> _logger;
    private readonly string _fallbackPath;

    public KafkaProducer(IConfiguration config, ILogger<KafkaProducer> logger)
    {
        _logger = logger;
        _fallbackPath = config["Kafka:LocalFallbackPath"] ?? "/tmp/kafka-fallback";
        _producer = new ProducerBuilder<string, string>(new ProducerConfig
        {
            BootstrapServers = config["Kafka:BootstrapServers"],
            EnableIdempotence = true,
            Acks = Acks.All,
            MessageSendMaxRetries = 3,
            RetryBackoffMs = 1000
        }).Build();
    }

    public async Task PublishAsync<T>(string topic, T @event, CancellationToken ct) where T : IKafkaEvent
    {
        var json = JsonSerializer.Serialize(@event);
        var message = new Message<string, string>
        {
            Key = @event.EventId,
            Value = json,
            Headers = new Headers
            {
                { "correlation_id", Encoding.UTF8.GetBytes(@event.CorrelationId) },
                { "version", Encoding.UTF8.GetBytes(@event.Version) }
            }
        };
        try
        {
            await _producer.ProduceAsync(topic, message, ct);
            _logger.LogInformation("Kafka published. Topic={Topic} EventId={EventId}", topic, @event.EventId);
        }
        catch (ProduceException<string, string> ex)
        {
            _logger.LogError(ex, "Kafka publish failed — writing to fallback. Topic={Topic} EventId={EventId}", topic, @event.EventId);
            Directory.CreateDirectory(_fallbackPath);
            var file = Path.Combine(_fallbackPath, $"{topic}_{DateTime.UtcNow:yyyyMMddHHmmss}_{@event.EventId}.json");
            await File.WriteAllTextAsync(file, json, ct);
        }
    }

    public void Dispose() => _producer.Dispose();
}
