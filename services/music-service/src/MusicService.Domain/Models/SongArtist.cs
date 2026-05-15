using System;

namespace MusicService.Domain.Models;

public class SongArtist
{
    public Guid SongId { get; set; }
    public Guid? ArtistId { get; set; }
    public string? DisplayName { get; set; }
    public string Role { get; set; } = "primary";
    public int DisplayOrder { get; set; } = 0;

    public Song Song { get; set; } = null!;
    public Artist? Artist { get; set; }
}
