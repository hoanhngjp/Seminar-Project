using System;
using System.Collections.Generic;

namespace MusicService.Domain.Events;

public class NewReleaseEvent
{
    public string EventId { get; set; } = Guid.NewGuid().ToString();
    public string Version { get; set; } = "v1";
    public string Timestamp { get; set; } = DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
    public string CorrelationId { get; set; } = string.Empty;
    public string ArtistId { get; set; } = string.Empty;
    public string ArtistName { get; set; } = string.Empty;
    public string SongId { get; set; } = string.Empty;
    public string SongTitle { get; set; } = string.Empty;
    public string? AlbumId { get; set; }
    public List<string> GenreIds { get; set; } = new();
    public List<string>? MoodTags { get; set; }
    public string ThumbnailUrl { get; set; } = string.Empty;
    public string S3StorageKey { get; set; } = string.Empty;
    public int DurationSec { get; set; }
    public bool Explicit { get; set; }
}
