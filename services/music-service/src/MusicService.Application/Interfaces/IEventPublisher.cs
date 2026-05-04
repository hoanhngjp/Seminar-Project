using System.Threading;
using System.Threading.Tasks;
using MusicService.Domain.Events;

namespace MusicService.Application.Interfaces;

public interface IEventPublisher
{
    Task PublishNewReleaseAsync(NewReleaseEvent @event, CancellationToken cancellationToken = default);
}
