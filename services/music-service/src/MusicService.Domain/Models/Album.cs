using System;
using System.Collections.Generic;

namespace MusicService.Domain.Models;

public class Album
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ArtistId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CoverImageUrl { get; set; }
    public DateOnly? ReleaseDate { get; set; }
    public string AlbumType { get; set; } = "album";
    public int TotalTracks { get; set; } = 0;
    public int TotalDurationSec { get; set; } = 0;
    public bool IsPublished { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Artist Artist { get; set; } = null!;
    public ICollection<Song> Songs { get; set; } = new List<Song>();
}
