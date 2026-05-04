using System.Collections.Generic;
using System.IO;

namespace MusicService.Application.DTOs;

public class UploadSongDto
{
    public string Title { get; set; } = string.Empty;
    public List<string> GenreIds { get; set; } = new();
    public string? Mood { get; set; }
    public string? Language { get; set; }
    public bool IsExplicit { get; set; }
    public Stream AudioStream { get; set; } = null!;
    public string ContentType { get; set; } = string.Empty;
    public long Length { get; set; }
    public string FileName { get; set; } = string.Empty;
}
