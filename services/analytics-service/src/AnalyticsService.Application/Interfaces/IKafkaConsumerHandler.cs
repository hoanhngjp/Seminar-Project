namespace AnalyticsService.Application.Interfaces;

public interface IKafkaConsumerHandler
{
    string Topic { get; }
    string ConsumerGroup { get; }
    Task HandleAsync(string key, string value, CancellationToken ct);
}
