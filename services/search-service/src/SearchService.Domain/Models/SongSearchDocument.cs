namespace SearchService.Domain.Models;

public record SongSearchDocument(
    string Id,
    string Title,
    string Artist,
    string? Album,
    string Genre,
    string[] Mood,
    string? Language,
    bool IsExplicit,
    bool IsPublished,
    long PlayCount
);
