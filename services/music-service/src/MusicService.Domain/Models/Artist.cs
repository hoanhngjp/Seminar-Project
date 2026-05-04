using System;
using System.Collections.Generic;

namespace MusicService.Domain.Models;

public class Artist
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string StageName { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public string? Country { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? BannerImageUrl { get; set; }
    public bool Verified { get; set; } = false;
    public long TotalFollowers { get; set; } = 0;
    public long TotalPlays { get; set; } = 0;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Album> Albums { get; set; } = new List<Album>();
    public ICollection<Song> Songs { get; set; } = new List<Song>();
}
