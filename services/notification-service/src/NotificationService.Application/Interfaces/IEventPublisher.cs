namespace NotificationService.Application.Interfaces;

public interface IEventPublisher
{
    Task PublishAsync<T>(string topic, T @event, CancellationToken ct) where T : class;
}
