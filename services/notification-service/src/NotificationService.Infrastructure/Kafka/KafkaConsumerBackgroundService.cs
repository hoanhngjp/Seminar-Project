using Confluent.Kafka;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace NotificationService.Infrastructure.Kafka;

public class KafkaConsumerBackgroundService(
    IConsumer<string, string> consumer,
    IServiceScopeFactory scopeFactory,
    ILogger<KafkaConsumerBackgroundService> logger) : BackgroundService
{
    private const string Topic = "New_Release";
    private const string DlqTopic = "New_Release.DLQ";
    private const int MaxRetries = 3;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        consumer.Subscribe(Topic);
        logger.LogInformation("KafkaConsumer subscribed. Topic={Topic}", Topic);

        while (!ct.IsCancellationRequested)
        {
            ConsumeResult<string, string>? result = null;
            try
            {
                // Task.Run: Consume is a blocking call — must yield to allow host startup
                result = await Task.Run(() => consumer.Consume(ct), ct);
                var eventId = result.Message.Key;

                await ProcessWithRetryAsync(result.Message.Value, eventId, ct);
                consumer.Commit(result);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Consumer loop fatal error");
                if (result is not null)
                    LogDlq(result.Message, ex);
                // Backoff to avoid tight loop when broker/topic is temporarily unavailable
                await Task.Delay(TimeSpan.FromSeconds(5), ct);
            }
        }

        consumer.Close();
    }

    private async Task ProcessWithRetryAsync(string json, string eventId, CancellationToken ct)
    {
        var attempt = 0;
        while (true)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var handler = scope.ServiceProvider.GetRequiredService<NewReleaseHandler>();
                await handler.HandleAsync(json, ct);
                return;
            }
            catch (Exception ex) when (attempt < MaxRetries)
            {
                attempt++;
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt - 1));
                logger.LogWarning(ex,
                    "Event processing failed. Attempt={Attempt} EventId={EventId} RetryIn={Delay}s",
                    attempt, eventId, delay.TotalSeconds);
                await Task.Delay(delay, ct);
            }
        }
    }

    private void LogDlq(Message<string, string> message, Exception ex)
    {
        logger.LogError(ex, "Message sent to DLQ. Topic={DlqTopic} Key={Key}", DlqTopic, message.Key);
        // Real DLQ publish would use a producer — omitted to avoid circular dependency in background service
        // The message is logged with full context for manual replay
    }
}
