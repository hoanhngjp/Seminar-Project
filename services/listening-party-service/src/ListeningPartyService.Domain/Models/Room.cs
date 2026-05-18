namespace ListeningPartyService.Domain.Models;

public class Room
{
    public string RoomId { get; set; } = string.Empty;
    public string Name { get; set; } = "Listening Party";
    public string HostId { get; set; } = string.Empty;
    public string SongId { get; set; } = string.Empty;
    public bool IsPlaying { get; set; }
    public int PositionSec { get; set; }
    public string JoinCode { get; set; } = string.Empty;
    /// <summary>UTC time when playback state was last changed — used to compute adjusted positionSec for late-joining members.</summary>
    public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;
}
