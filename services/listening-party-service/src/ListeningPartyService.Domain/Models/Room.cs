namespace ListeningPartyService.Domain.Models;

public class Room
{
    public string RoomId { get; set; } = string.Empty;
    public string HostId { get; set; } = string.Empty;
    public string SongId { get; set; } = string.Empty;
    public bool IsPlaying { get; set; }
    public int PositionSec { get; set; }
    public string JoinCode { get; set; } = string.Empty;
}
