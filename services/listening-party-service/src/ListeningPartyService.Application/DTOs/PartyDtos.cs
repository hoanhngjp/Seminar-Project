namespace ListeningPartyService.Application.DTOs;

public record CreatePartyRequest(string? Name, string? SongId);

public record CreatePartyResponse(string RoomId, string JoinCode, string HostId, string Name);

public record JoinPartyResponse(
    string RoomId,
    string HostId,
    string CurrentSongId,
    int PlaybackPositionSec);
