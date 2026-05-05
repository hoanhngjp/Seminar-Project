using SearchService.Application.DTOs;

namespace SearchService.Application.Interfaces;

public interface ISearchCache
{
    Task<(SearchResponse? Response, bool Hit)> GetAsync(string key, CancellationToken ct);
    Task SetAsync(string key, SearchResponse response, CancellationToken ct);
}
