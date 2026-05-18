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
    Task UpdateRoomSongAsync(string roomId, string songId, bool isPlaying, int positionSec, CancellationToken ct = default);
    Task RemoveMemberAsync(string roomId, string userId, CancellationToken ct = default);
    Task<ISet<string>> GetMembersAsync(string roomId, CancellationToken ct = default);
    Task DeleteRoomAsync(string roomId, CancellationToken ct = default);

    // Member profile cache (display name + avatar stored at join time)
    Task StoreMemberProfileAsync(string roomId, string userId, string displayName, string? avatarUrl, CancellationToken ct = default);
    Task<(string? DisplayName, string? AvatarUrl)> GetMemberProfileAsync(string roomId, string userId, CancellationToken ct = default);

    // Queue management
    Task<List<QueueItem>> GetQueueAsync(string roomId, CancellationToken ct = default);
    Task SaveQueueAsync(string roomId, List<QueueItem> queue, CancellationToken ct = default);
}
