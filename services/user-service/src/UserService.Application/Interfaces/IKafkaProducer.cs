using UserService.Application.Events;

namespace UserService.Application.Interfaces;

public interface IKafkaProducer
{
    Task PublishAsync<T>(string topic, T @event, CancellationToken ct) where T : IKafkaEvent;
}
