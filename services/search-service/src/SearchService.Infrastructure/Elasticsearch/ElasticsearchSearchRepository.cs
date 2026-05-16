using System.Text;
using System.Text.Json.Serialization;
using Elastic.Clients.Elasticsearch;
using Elastic.Clients.Elasticsearch.QueryDsl;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SearchService.Application.DTOs;
using SearchService.Application.Interfaces;

namespace SearchService.Infrastructure.Elasticsearch;

public class ElasticsearchSearchRepository(
    ElasticsearchClient client,
    IConfiguration configuration,
    ILogger<ElasticsearchSearchRepository> logger) : ISearchRepository
{
    private readonly string _index = configuration["Elasticsearch:Index"] ?? "songs";

    public async Task<SearchResponse> SearchAsync(
        string query, string type, int limit, int offset, CancellationToken ct)
    {
        // Fetch one extra to determine hasMore
        var fetchSize = limit + 1;

        var response = await client.SearchAsync<ElasticsearchSongDocument>(s => s
            .Index(_index)
            .From(offset)
            .Size(fetchSize)
            .Query(q => q
                .MultiMatch(m => m
                    .Query(query)
                    .Fields(Fields.FromStrings(["title^3", "artist^2", "album"]))
                    .Fuzziness(new Fuzziness("AUTO"))
                )
            ), ct);

        if (!response.IsValidResponse)
        {
            logger.LogWarning("Elasticsearch returned invalid response for query '{Q}': {Debug}",
                query, response.DebugInformation);
            return new SearchResponse([], null, false);
        }

        var hits = response.Hits.ToList();
        var hasMore = hits.Count > limit;
        var pageHits = hasMore ? hits.Take(limit).ToList() : hits;

        var items = pageHits.Select(h =>
        {
            var doc = h.Source!;
            return new SearchItem(
                Id: doc.Id,
                Type: "song",
                Name: doc.Title,
                Artist: doc.Artist,
                CoverUrl: doc.CoverUrl,
                Duration: doc.DurationSec,
                Score: h.Score ?? 0
            );
        }).ToList();

        string? nextCursor = null;
        if (hasMore)
        {
            var nextOffset = offset + limit;
            nextCursor = Convert.ToBase64String(Encoding.UTF8.GetBytes(nextOffset.ToString()));
        }

        return new SearchResponse(items, nextCursor, hasMore);
    }
}

// Internal document model — maps Elasticsearch fields (snake_case from ES)
internal record ElasticsearchSongDocument(
    [property: JsonPropertyName("id")]           string Id,
    [property: JsonPropertyName("title")]        string Title,
    [property: JsonPropertyName("artist")]       string Artist,
    [property: JsonPropertyName("album")]        string? Album,
    [property: JsonPropertyName("genre")]        string Genre,
    [property: JsonPropertyName("mood")]         string? Mood,
    [property: JsonPropertyName("language")]     string? Language,
    [property: JsonPropertyName("is_explicit")]  bool IsExplicit,
    [property: JsonPropertyName("is_published")] bool IsPublished,
    [property: JsonPropertyName("play_count")]   long PlayCount,
    [property: JsonPropertyName("cover_url")]    string? CoverUrl,
    [property: JsonPropertyName("duration_sec")] int? DurationSec
);
