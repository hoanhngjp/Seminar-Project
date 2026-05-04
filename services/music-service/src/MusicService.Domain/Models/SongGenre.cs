using System;

namespace MusicService.Domain.Models;

public class SongGenre
{
    public Guid SongId { get; set; }
    public Guid GenreId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Song Song { get; set; } = null!;
    public Genre Genre { get; set; } = null!;
}
