namespace ListeningPartyService.Application.DTOs;

public record CreatePartyRequest(string SongId);

public record CreatePartyResponse(string RoomId, string JoinCode, string HostId);

public record JoinPartyResponse(
    string RoomId,
    string HostId,
    string CurrentSongId,
    int PlaybackPositionSec);
