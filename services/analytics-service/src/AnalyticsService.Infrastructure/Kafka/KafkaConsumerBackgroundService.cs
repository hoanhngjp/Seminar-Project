using AnalyticsService.Application.Interfaces;
using Confluent.Kafka;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AnalyticsService.Infrastructure.Kafka;

/// <summary>
/// Generic background service that drives one Kafka consumer loop per handler.
/// Spawned once per IKafkaConsumerHandler registration.
/// </summary>
public class KafkaConsumerBackgroundService(
    string topic,
    string consumerGroup,
    string bootstrapServers,
    IServiceScopeFactory scopeFactory,
    ILogger<KafkaConsumerBackgroundService> logger,
    Type handlerType) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Yield immediately so BackgroundService.StartAsync returns without blocking the host startup.
        // consumer.Consume() is a synchronous blocking call — without this yield, it would block
        // the startup thread and cause a TaskCanceledException at Kestrel BindAsync.
        await Task.Yield();

        var config = new ConsumerConfig
        {
            BootstrapServers = bootstrapServers,
            GroupId = consumerGroup,
            AutoOffsetReset = AutoOffsetReset.Earliest,
            EnableAutoCommit = false
        };

        using var consumer = new ConsumerBuilder<string, string>(config).Build();
        consumer.Subscribe(topic);

        logger.LogInformation("Kafka consumer started: topic={Topic} group={Group}", topic, consumerGroup);

        while (!stoppingToken.IsCancellationRequested)
        {
            ConsumeResult<string, string>? result = null;
            try
            {
                result = consumer.Consume(stoppingToken);
                if (result.IsPartitionEOF) continue;

                await using var scope = scopeFactory.CreateAsyncScope();
                var handler = (IKafkaConsumerHandler)scope.ServiceProvider.GetRequiredService(handlerType);

                await handler.HandleAsync(result.Message.Key ?? "", result.Message.Value ?? "", stoppingToken);

                consumer.Commit(result);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (ConsumeException ex)
            {
                logger.LogError(ex, "Kafka consume error on topic {Topic}", topic);
                await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Handler error on topic {Topic} — committing offset to avoid DLQ loop.", topic);
                if (result is not null)
                    consumer.Commit(result);
            }
        }

        consumer.Close();
    }
}
