using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SearchService.Api.Models;
using SearchService.Application.Services;

namespace SearchService.Api.Controllers;

[ApiController]
[Route("api/v1/search")]
[Authorize]
public class SearchController(ISearchService searchService, ILogger<SearchController> logger)
    : ControllerBase
{
    // ----------------------------------------------------------------
    // Contract-First Checklist — GET /api/v1/search
    // [1] GET /api/v1/search
    // [2] Query: q (required), type (song|artist|all), limit (1-20), cursor (base64 offset)
    // [3] 200: { success, data: { items, nextCursor, hasMore }, meta: { cache: HIT|MISS } }
    // [4] 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 500 INTERNAL_ERROR
    // [5] GatewayAuth (X-User-Id required)
    // [6] 200ms — CancellationToken with 200ms timeout passed to service
    // [7] YES — safe to retry
    // [8] Fallback on Elasticsearch timeout → return []; Redis cache 10min; stateless
    // ----------------------------------------------------------------

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] string type = "all",
        [FromQuery] int limit = 10,
        [FromQuery] string? cursor = null)
    {
        var requestId = HttpContext.Items["X-Correlation-Id"]?.ToString() ?? Guid.NewGuid().ToString();

        // AC5.1.1–AC5.1.4: q is required
        if (string.IsNullOrWhiteSpace(q))
        {
            return BadRequest(ApiResponse<object>.Fail(
                "VALIDATION_ERROR", "Query parameter 'q' is required.", requestId));
        }

        // Clamp limit to [1, 20]
        limit = Math.Clamp(limit, 1, 20);

        if (!IsValidType(type))
        {
            return BadRequest(ApiResponse<object>.Fail(
                "VALIDATION_ERROR", "Parameter 'type' must be one of: song, artist, all.", requestId));
        }

        // 200ms budget — timeout enforced here so even slow ES returns []
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(HttpContext.RequestAborted);
        cts.CancelAfter(TimeSpan.FromMilliseconds(200));

        try
        {
            var (result, cacheHit) = await searchService.SearchAsync(q, type, limit, cursor, cts.Token);

            return Ok(ApiResponse<object>.Ok(
                new
                {
                    items = result.Items,
                    nextCursor = result.NextCursor,
                    hasMore = result.HasMore
                },
                requestId,
                cache: cacheHit ? "HIT" : "MISS"
            ));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled error in SearchController for query '{Q}'", q);
            return StatusCode(500, ApiResponse<object>.Fail(
                "INTERNAL_ERROR", "An unexpected error occurred.", requestId));
        }
    }

    private static bool IsValidType(string type) =>
        type is "song" or "artist" or "all";
}
