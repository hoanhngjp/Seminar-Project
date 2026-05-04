using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MusicService.Application.Interfaces;
using MusicService.Domain.Events;

namespace MusicService.Infrastructure.Services;

public class KafkaEventPublisher : IEventPublisher, IDisposable
{
    private readonly IProducer<string, string> _producer;
    private readonly ILogger<KafkaEventPublisher> _logger;
    private const string NewReleaseTopic = "New_Release";

    public KafkaEventPublisher(IConfiguration configuration, ILogger<KafkaEventPublisher> logger)
    {
        _logger = logger;
        var bootstrapServers = configuration["Kafka:BootstrapServers"] ?? "localhost:9092";
        
        var config = new ProducerConfig
        {
            BootstrapServers = bootstrapServers,
            Acks = Acks.All,
            EnableIdempotence = true
        };

        _producer = new ProducerBuilder<string, string>(config).Build();
    }

    public async Task PublishNewReleaseAsync(NewReleaseEvent @event, CancellationToken cancellationToken = default)
    {
        var message = new Message<string, string>
        {
            Key = @event.ArtistId,
            Value = JsonSerializer.Serialize(@event, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower })
        };

        try
        {
            var deliveryResult = await _producer.ProduceAsync(NewReleaseTopic, message, cancellationToken);
            _logger.LogInformation("Published New_Release event to topic {Topic}, partition {Partition}, offset {Offset}", 
                deliveryResult.Topic, deliveryResult.Partition, deliveryResult.Offset);
        }
        catch (ProduceException<string, string> e)
        {
            _logger.LogError(e, "Delivery failed for New_Release event: {Reason}", e.Error.Reason);
            throw;
        }
    }

    public void Dispose()
    {
        _producer.Flush(TimeSpan.FromSeconds(10));
        _producer.Dispose();
    }
}
