using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StreamingService.Api.Models;
using StreamingService.Application.Interfaces;

namespace StreamingService.Api.Controllers;

[ApiController]
[Route("api/v1/streaming")]
[Authorize]
public class StreamingController : ControllerBase
{
    private readonly IStreamingService _streaming;

    public StreamingController(IStreamingService streaming)
    {
        _streaming = streaming;
    }

    // ----------------------------------------------------------------
    // Contract-First Checklist — GET /api/v1/streaming/{songId}/url
    // [1] GET /api/v1/streaming/{songId}/url
    // [2] Path: songId (GUID); Headers: X-User-Id, X-User-Role
    // [3] 200: { success, data: { url, expiresIn: 900 }, meta }
    // [4] 401 UNAUTHORIZED, 404 SONG_NOT_FOUND, 503 SERVICE_UNAVAILABLE
    // [5] GatewayAuth
    // [6] 150ms (CancellationToken timeout set inside service)
    // [7] YES
    // [8] Pre-signed URL expiry = 900s; music-service call timeout = 150ms
    // ----------------------------------------------------------------

    [HttpGet("{songId:guid}/url")]
    public async Task<IActionResult> GetStreamUrl(Guid songId)
    {
        var requestId = HttpContext.Items["X-Correlation-Id"]?.ToString() ?? Guid.NewGuid().ToString();

        try
        {
            var result = await _streaming.GetStreamUrlAsync(songId, HttpContext.RequestAborted);
            return Ok(ApiResponse<object>.Ok(new
            {
                url = result.Url,
                expiresIn = result.ExpiresIn
            }, requestId));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail("SONG_NOT_FOUND", $"Song {songId} not found.", requestId));
        }
        catch (OperationCanceledException)
        {
            return StatusCode(503, ApiResponse<object>.Fail("SERVICE_UNAVAILABLE", "Request timed out.", requestId));
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(503, ApiResponse<object>.Fail("SERVICE_UNAVAILABLE", ex.Message, requestId));
        }
        catch (Exception)
        {
            return StatusCode(500, ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.", requestId));
        }
    }

    // ----------------------------------------------------------------
    // Contract-First Checklist — GET /api/v1/streaming/{songId}/chunk
    // [1] GET /api/v1/streaming/{songId}/chunk
    // [2] Path: songId; Header: Range: bytes=X-Y (optional)
    // [3] 206 Partial Content: binary audio bytes + Content-Range header
    //     200 OK: full content when no Range header
    // [4] 401 UNAUTHORIZED, 404 SONG_NOT_FOUND, 503 SERVICE_UNAVAILABLE
    // [5] GatewayAuth
    // [6] 1000ms (CancellationToken timeout set inside service)
    // [7] YES
    // [8] S3 proxy via ByteRange; no Range header → 200 full content — AC3.1.2
    // ----------------------------------------------------------------

    [HttpGet("{songId:guid}/chunk")]
    public async Task<IActionResult> GetChunk(Guid songId)
    {
        var requestId = HttpContext.Items["X-Correlation-Id"]?.ToString() ?? Guid.NewGuid().ToString();

        long? rangeStart = null;
        long? rangeEnd = null;

        var rangeHeader = Request.Headers.Range.FirstOrDefault();
        if (!string.IsNullOrEmpty(rangeHeader))
        {
            var parsed = TryParseRange(rangeHeader);
            if (parsed is null)
            {
                Response.Headers.ContentRange = "bytes */*";
                return StatusCode(416, ApiResponse<object>.Fail("VALIDATION_ERROR", "Invalid Range header.", requestId));
            }
            (rangeStart, rangeEnd) = parsed.Value;
        }

        try
        {
            var result = await _streaming.GetChunkAsync(songId, rangeStart, rangeEnd, HttpContext.RequestAborted);

            Response.StatusCode = result.IsPartial ? 206 : 200;
            Response.ContentType = result.ContentType;
            Response.Headers.ContentRange = result.ContentRange;
            Response.ContentLength = result.TotalBytes;

            await result.Content.CopyToAsync(Response.Body, HttpContext.RequestAborted);
            return new EmptyResult();
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail("SONG_NOT_FOUND", $"Song {songId} not found.", requestId));
        }
        catch (OperationCanceledException)
        {
            return StatusCode(503, ApiResponse<object>.Fail("SERVICE_UNAVAILABLE", "Request timed out.", requestId));
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(503, ApiResponse<object>.Fail("SERVICE_UNAVAILABLE", ex.Message, requestId));
        }
        catch (Exception)
        {
            return StatusCode(500, ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.", requestId));
        }
    }

    private static (long Start, long? End)? TryParseRange(string rangeHeader)
    {
        // Expects format: "bytes=X-Y" or "bytes=X-"
        if (!rangeHeader.StartsWith("bytes=", StringComparison.OrdinalIgnoreCase))
            return null;

        var range = rangeHeader["bytes=".Length..];
        var parts = range.Split('-');
        if (parts.Length != 2)
            return null;

        if (!long.TryParse(parts[0], out var start))
            return null;

        long? end = null;
        if (!string.IsNullOrEmpty(parts[1]))
        {
            if (!long.TryParse(parts[1], out var e))
                return null;
            end = e;
        }

        return (start, end);
    }
}
