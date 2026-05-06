using ListeningPartyService.Domain.Models;

namespace ListeningPartyService.Application.Interfaces;

public interface IPartyRepository
{
    Task CreateAsync(Room room, CancellationToken ct = default);
    Task<string?> GetRoomIdByJoinCodeAsync(string joinCode, CancellationToken ct = default);
    Task<Room?> GetRoomAsync(string roomId, CancellationToken ct = default);
    Task AddMemberAsync(string roomId, string userId, CancellationToken ct = default);

    // Hub state management
    Task UpdateRoomStateAsync(string roomId, bool isPlaying, int positionSec, CancellationToken ct = default);
    Task RemoveMemberAsync(string roomId, string userId, CancellationToken ct = default);
    Task<ISet<string>> GetMembersAsync(string roomId, CancellationToken ct = default);
    Task DeleteRoomAsync(string roomId, CancellationToken ct = default);
}
