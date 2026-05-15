using System;
using System.Collections.Generic;

namespace MusicService.Domain.Models;

public class Song
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ArtistId { get; set; }
    public Guid? AlbumId { get; set; }
    public string Title { get; set; } = string.Empty;
    public int DurationSec { get; set; }
    public int? TrackNumber { get; set; }
    public string S3AudioKey { get; set; } = string.Empty;
    public string? S3AudioHlsKey { get; set; }
    public string? S3WaveformKey { get; set; }
    public string? CoverImageUrl { get; set; }
    public string? Lyrics { get; set; }
    public string? Language { get; set; }
    public string? Mood { get; set; }
    public bool IsExplicit { get; set; } = false;
    public bool IsPublished { get; set; } = false;
    public long PlayCount { get; set; } = 0;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Artist Artist { get; set; } = null!;
    public Album? Album { get; set; }
    public ICollection<SongGenre> SongGenres { get; set; } = new List<SongGenre>();
}
