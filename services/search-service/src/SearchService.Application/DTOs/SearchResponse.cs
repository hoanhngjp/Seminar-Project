namespace SearchService.Application.DTOs;

public record SearchItem(
    string Id,
    string Type,
    string Title,
    string Artist,
    string? Album,
    string Genre,
    double Score
);

public record SearchResponse(
    List<SearchItem> Items,
    string? NextCursor,
    bool HasMore
);
