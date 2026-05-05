using SearchService.Application.DTOs;

namespace SearchService.Application.Services;

public interface ISearchService
{
    Task<(SearchResponse Response, bool CacheHit)> SearchAsync(
        string q, string type, int limit, string? cursor, CancellationToken ct);
}
