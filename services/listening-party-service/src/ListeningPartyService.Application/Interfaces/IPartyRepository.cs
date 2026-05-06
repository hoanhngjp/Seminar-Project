using ListeningPartyService.Domain.Models;

namespace ListeningPartyService.Application.Interfaces;

public interface IPartyRepository
{
    Task CreateAsync(Room room, CancellationToken ct = default);
    Task<string?> GetRoomIdByJoinCodeAsync(string joinCode, CancellationToken ct = default);
    Task<Room?> GetRoomAsync(string roomId, CancellationToken ct = default);
    Task AddMemberAsync(string roomId, string userId, CancellationToken ct = default);
}
