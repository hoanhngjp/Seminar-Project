using ListeningPartyService.Domain.Models;

namespace ListeningPartyService.Application.DTOs;

public record CreatePartyRequest(string? Name, string? SongId);

public record CreatePartyResponse(string RoomId, string JoinCode, string HostId, string Name, string CurrentSongId, List<MemberDto> Members);

public record MemberDto(string UserId, string Name, string? AvatarUrl, bool IsHost);

public record JoinPartyResponse(
    string RoomId,
    string JoinCode,
    string Name,
    string HostId,
    string CurrentSongId,
    int PlaybackPositionSec,
    List<MemberDto> Members);

public record PartyPreviewResponse(
    string RoomId,
    string Name,
    int MemberCount,
    string? CurrentSongTitle,
    string? HostAvatarUrl,
    string HostDisplayName);

// ── Queue DTOs ────────────────────────────────────────────────────────────────

public record QueueItemDto(string SongId, string AddedByUserId);

public record GetQueueResponse(string RoomId, List<QueueItemDto> Queue);

/// Returned by PartyService.DequeueNextAsync when a song is available.
public record QueueNextResult(Room UpdatedRoom, List<QueueItemDto> UpdatedQueue);
