using SearchService.Application.DTOs;

namespace SearchService.Application.Interfaces;

public interface ISearchRepository
{
    Task<SearchResponse> SearchAsync(string query, string type, int limit, int offset, CancellationToken ct);
}
