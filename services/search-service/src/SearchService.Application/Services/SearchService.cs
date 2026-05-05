using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using SearchService.Application.DTOs;
using SearchService.Application.Interfaces;

namespace SearchService.Application.Services;

public class SearchService(
    ISearchRepository repository,
    ISearchCache cache,
    ILogger<SearchService> logger) : ISearchService
{
    // AC5.1.2: latency budget 200ms — enforced via CancellationToken timeout at caller (controller)
    public async Task<(SearchResponse Response, bool CacheHit)> SearchAsync(
        string q, string type, int limit, string? cursor, CancellationToken ct)
    {
        var offset = DecodeCursor(cursor);
        var cacheKey = BuildCacheKey(q, type, limit, offset);

        try
        {
            var (cached, hit) = await cache.GetAsync(cacheKey, ct);
            if (hit && cached is not null)
            {
                logger.LogInformation("Search cache hit for key {Key}", cacheKey);
                return (cached, true);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Redis GetAsync failed for key {Key} — cache miss.", cacheKey);
        }

        try
        {
            var result = await repository.SearchAsync(q, type, limit, offset, ct);

            // AC5.1.2: cache hit < 50ms, cold < 200ms — cache warms future requests
            await cache.SetAsync(cacheKey, result, ct);

            return (result, false);
        }
        catch (OperationCanceledException)
        {
            // AC5.1.3: Elasticsearch timeout → return [] rather than error
            logger.LogWarning("Elasticsearch timeout for query '{Q}' — returning empty result.", q);
            return (new SearchResponse([], null, false), false);
        }
        catch (Exception ex)
        {
            // AC5.1.3: Elasticsearch unavailable → return [] not crash
            logger.LogWarning(ex, "Elasticsearch error for query '{Q}' — returning empty result.", q);
            return (new SearchResponse([], null, false), false);
        }
    }

    private static int DecodeCursor(string? cursor)
    {
        if (string.IsNullOrWhiteSpace(cursor)) return 0;
        try
        {
            var bytes = Convert.FromBase64String(cursor);
            var s = Encoding.UTF8.GetString(bytes);
            return int.TryParse(s, out var offset) ? offset : 0;
        }
        catch
        {
            return 0;
        }
    }

    private static string BuildCacheKey(string q, string type, int limit, int offset)
    {
        var raw = $"{q}:{type}:{limit}:{offset}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
        return $"search:cache:{hash}";
    }
}
