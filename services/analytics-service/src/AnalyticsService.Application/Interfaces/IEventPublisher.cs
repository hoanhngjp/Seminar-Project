using AnalyticsService.Domain.Models;

namespace AnalyticsService.Application.Interfaces;

public interface IEventPublisher
{
    Task PublishPlayEventAsync(PlayEvent ev, CancellationToken ct = default);
}
