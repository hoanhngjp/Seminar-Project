namespace UserService.Application.Events;

public interface IKafkaEvent
{
    string EventId { get; }
    string Version { get; }
    string CorrelationId { get; }
}
