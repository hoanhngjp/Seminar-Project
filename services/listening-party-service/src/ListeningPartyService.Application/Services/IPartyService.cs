using ListeningPartyService.Application.DTOs;
using ListeningPartyService.Domain.Models;

namespace ListeningPartyService.Application.Services;

public interface IPartyService
{
    Task<CreatePartyResponse> CreatePartyAsync(string hostId, string? name, string? songId, CancellationToken ct = default);
    Task<JoinPartyResponse> JoinPartyAsync(string joinCode, string userId, CancellationToken ct = default);

    // Hub operations
    Task<Room?> GetRoomAsync(string roomId, CancellationToken ct = default);
    Task<Room> UpdateRoomStateAsync(string roomId, bool isPlaying, int positionSec, CancellationToken ct = default);

    Task<PartyPreviewResponse?> GetPartyPreviewAsync(string joinCode, CancellationToken ct = default);
    Task StoreMemberProfileAsync(string roomId, string userId, string displayName, string? avatarUrl, CancellationToken ct = default);

    /// <summary>Removes member, cleans up room if host. Returns true if the disconnected user was the host.</summary>
    Task<bool> HandleMemberDisconnectAsync(string roomId, string userId, CancellationToken ct = default);
}
