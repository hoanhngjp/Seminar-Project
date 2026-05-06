using System.Security.Claims;
using AnalyticsService.Api.Models;
using AnalyticsService.Application.DTOs;
using AnalyticsService.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AnalyticsService.Api.Controllers;

[ApiController]
[Route("api/v1/analytics")]
[Authorize]
public class AnalyticsController(IAnalyticsService analyticsService)
    : ControllerBase
{
    // ----------------------------------------------------------------
    // Contract-First Checklist — POST /api/v1/analytics/events/play
    // [1] POST /api/v1/analytics/events/play
    // [2] Header: Idempotency-Key (required); Body: { songId, durationSec, listenedSec, platform }
    // [3] 202: { success, data: { queued: true }, meta }
    // [4] 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 409 IDEMPOTENCY_CONFLICT, 500 INTERNAL_ERROR
    // [5] GatewayAuth; Idempotency-Key → Redis SETNX analytics:idem:{key} TTL 24h
    // [6] 50ms — trả 202 ngay, background: Kafka + InfluxDB
    // [7] NO — idempotent via Idempotency-Key
    // [8] Fallback Kafka down → /tmp/analytics-dlq.jsonl; PII: userId UUID only
    // ----------------------------------------------------------------

    [HttpPost("events/play")]
    public async Task<IActionResult> RecordPlay(
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        [FromBody] RecordPlayRequest? request)
    {
        var requestId = HttpContext.Items["X-Correlation-Id"]?.ToString() ?? Guid.NewGuid().ToString();

        if (string.IsNullOrWhiteSpace(idempotencyKey))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Idempotency-Key header is required.", requestId));

        if (request is null)
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Request body is required.", requestId));

        if (!TryGetUserId(out var userId))
            return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Missing user identity.", requestId));

        // AC4.1.4: trả 202 ngay — background async handles Kafka + InfluxDB
        var accepted = await analyticsService.RecordPlayAsync(idempotencyKey, userId, request);

        if (!accepted)
            return Conflict(ApiResponse<object>.Fail("IDEMPOTENCY_CONFLICT",
                "This request has already been processed.", requestId));

        return StatusCode(202, ApiResponse<object>.Ok(new { queued = true }, requestId));
    }

    // ----------------------------------------------------------------
    // Contract-First Checklist — GET /api/v1/analytics/creator/heatmap/{songId}
    // [1] GET /api/v1/analytics/creator/heatmap/{songId}
    // [2] Path: songId (GUID); Query: timeRange (7d|30d, default 7d)
    // [3] 200: { success, data: { heatmap: [{second, skipRate}] }, meta: { cache: HIT|MISS } }
    // [4] 401 UNAUTHORIZED, 403 FORBIDDEN, 404 SONG_NOT_FOUND, 500 INTERNAL_ERROR
    // [5] GatewayAuth; Role: Creator|Admin; ownership: song.artistId == currentUserId
    // [6] 500ms
    // [7] YES
    // [8] Stale cache fallback; Admin bypasses ownership
    // ----------------------------------------------------------------

    [HttpGet("creator/heatmap/{songId:guid}")]
    [Authorize(Roles = "Creator,Admin")]
    public async Task<IActionResult> GetHeatmap(Guid songId, [FromQuery] string timeRange = "7d")
    {
        var requestId = HttpContext.Items["X-Correlation-Id"]?.ToString() ?? Guid.NewGuid().ToString();

        if (timeRange != "7d" && timeRange != "30d")
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "timeRange must be '7d' or '30d'.", requestId));

        if (!TryGetUserId(out var userId))
            return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Missing user identity.", requestId));

        // AC4.2.3: Creator ownership check; Admin bypasses
        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "Admin")
        {
            var ownership = await analyticsService.VerifyOwnershipAsync(songId, userId);
            if (ownership is null)
                return NotFound(ApiResponse<object>.Fail("SONG_NOT_FOUND", $"Song {songId} not found.", requestId));
            if (!ownership.Value)
                return StatusCode(403, ApiResponse<object>.Fail("FORBIDDEN", "You do not own this song.", requestId));
        }

        var (data, cacheHit) = await analyticsService.GetHeatmapAsync(songId, timeRange);

        return Ok(ApiResponse<object>.Ok(new { heatmap = data.Heatmap }, requestId, cache: cacheHit ? "HIT" : "MISS"));
    }

    // ----------------------------------------------------------------
    // Contract-First Checklist — GET /api/v1/analytics/creator/stats/{songId}
    // [1] GET /api/v1/analytics/creator/stats/{songId}
    // [2] Path: songId (GUID); Headers: X-User-Id, X-User-Role
    // [3] 200: { success, data: { totalPlays, totalSkips, uniqueListeners, avgListenPercent, dailyPlays }, meta }
    // [4] 401 UNAUTHORIZED, 403 FORBIDDEN, 404 SONG_NOT_FOUND, 500 INTERNAL_ERROR
    // [5] GatewayAuth; Role: Creator|Admin; ownership check
    // [6] 500ms
    // [7] YES
    // [8] Redis cache 6h; zero values on InfluxDB error
    // ----------------------------------------------------------------

    [HttpGet("creator/stats/{songId:guid}")]
    [Authorize(Roles = "Creator,Admin")]
    public async Task<IActionResult> GetStats(Guid songId)
    {
        var requestId = HttpContext.Items["X-Correlation-Id"]?.ToString() ?? Guid.NewGuid().ToString();

        if (!TryGetUserId(out var userId))
            return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Missing user identity.", requestId));

        var role = User.FindFirstValue(ClaimTypes.Role);
        if (role != "Admin")
        {
            var ownership = await analyticsService.VerifyOwnershipAsync(songId, userId);
            if (ownership is null)
                return NotFound(ApiResponse<object>.Fail("SONG_NOT_FOUND", $"Song {songId} not found.", requestId));
            if (!ownership.Value)
                return StatusCode(403, ApiResponse<object>.Fail("FORBIDDEN", "You do not own this song.", requestId));
        }

        var (data, cacheHit) = await analyticsService.GetStatsAsync(songId);

        return Ok(ApiResponse<object>.Ok(new
        {
            totalPlays = data.TotalPlays,
            totalSkips = data.TotalSkips,
            uniqueListeners = data.UniqueListeners,
            avgListenPercent = data.AvgListenPercent,
            dailyPlays = data.DailyPlays
        }, requestId, cache: cacheHit ? "HIT" : "MISS"));
    }

    private bool TryGetUserId(out Guid userId)
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out userId);
    }
}
