namespace SearchService.Application.DTOs;

public record SearchItem(
    string Id,
    string Type,
    string Name,
    string? Artist,
    string? CoverUrl,
    int? Duration,
    double Score
);

public record SearchResponse(
    List<SearchItem> Items,
    string? NextCursor,
    bool HasMore
);
