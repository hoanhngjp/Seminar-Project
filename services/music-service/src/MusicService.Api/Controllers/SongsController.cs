using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MusicService.Api.Filters;
using MusicService.Api.Models;
using MusicService.Application.DTOs;
using MusicService.Application.Interfaces;

namespace MusicService.Api.Controllers;

[ApiController]
[Route("api/v1/music/[controller]")]
[Authorize]
public class SongsController : ControllerBase
{
    private readonly ISongService _songService;

    public SongsController(ISongService songService)
    {
        _songService = songService;
    }

    // ----------------------------------------------------------------
    // Contract-First Checklist — POST /api/v1/music/songs
    // [1] POST /api/v1/music/songs
    // [2] multipart/form-data: file + title + genreIds + mood + language + isExplicit
    // [3] 201: { success, data: { songId, title, storageKey, status }, meta }
    // [4] 400 VALIDATION_ERROR, 403 FORBIDDEN, 409 IDEMPOTENCY_CONFLICT,
    //     413 PAYLOAD_TOO_LARGE, 429 RATE_LIMIT_EXCEEDED, 503 SERVICE_UNAVAILABLE
    // [5] Auth (GatewayAuth), Idempotency-Key, Rate Limit 10/min
    // [6] 5000ms
    // [7] YES (idempotent via Idempotency-Key)
    // [8] S3 first then DB; Kafka New_Release after commit; Creator role required
    // ----------------------------------------------------------------

    [HttpPost]
    [IdempotencyFilter]
    [RequestSizeLimit(52_428_800)]
    [RequestFormLimits(MultipartBodyLengthLimit = 52_428_800)]
    public async Task<IActionResult> UploadSong([FromForm] UploadSongRequest request)
    {
        var requestId = HttpContext.Items["X-Correlation-Id"]?.ToString() ?? Guid.NewGuid().ToString();

        if (request.File == null || request.File.Length == 0)
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Audio file is required.", requestId));

        if (request.File.Length > 50 * 1024 * 1024)
            return StatusCode(413, ApiResponse<object>.Fail("PAYLOAD_TOO_LARGE", "File exceeds 50MB limit.", requestId));

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var role = User.FindFirstValue(ClaimTypes.Role);

        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Authentication required.", requestId));

        if (role != "Creator" && role != "Admin")
            return StatusCode(403, ApiResponse<object>.Fail("FORBIDDEN", "Only Creators can upload songs.", requestId));

        var genreIds = string.IsNullOrEmpty(request.GenreIds)
            ? new List<string>()
            : request.GenreIds.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(g => g.Trim()).ToList();

        var dto = new UploadSongDto
        {
            Title = request.Title ?? "Untitled",
            GenreIds = genreIds,
            Mood = request.Mood,
            Language = request.Language,
            IsExplicit = request.IsExplicit,
            AudioStream = request.File.OpenReadStream(),
            ContentType = request.File.ContentType,
            Length = request.File.Length,
            FileName = request.File.FileName
        };

        try
        {
            var song = await _songService.UploadSongAsync(userId, dto, HttpContext.RequestAborted);
            return StatusCode(201, ApiResponse<object>.Ok(new
            {
                songId = song.Id,
                title = song.Title,
                storageKey = song.S3AudioKey,
                status = "processing"
            }, requestId));
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("Creator profile not found"))
        {
            return StatusCode(403, ApiResponse<object>.Fail("FORBIDDEN", "Creator profile not found.", requestId));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", ex.Message, requestId));
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("storage service"))
        {
            return StatusCode(503, ApiResponse<object>.Fail("SERVICE_UNAVAILABLE", "Storage service is currently unavailable.", requestId));
        }
        catch (Exception)
        {
            return StatusCode(500, ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.", requestId));
        }
    }

    // ----------------------------------------------------------------
    // Contract-First Checklist — GET /api/v1/music/songs/{songId}
    // [1] GET /api/v1/music/songs/{songId}
    // [2] Path: songId (UUID)
    // [3] 200: { success, data: { id, title, artist, album, duration, coverUrl, isExplicit }, meta: { cache: HIT|MISS } }
    // [4] 401 UNAUTHORIZED, 404 SONG_NOT_FOUND
    // [5] Auth (GatewayAuth)
    // [6] 200ms
    // [7] YES
    // [8] Redis cache key: song:meta:{songId} TTL 30m
    // ----------------------------------------------------------------

    [HttpGet("{songId:guid}")]
    public async Task<IActionResult> GetSong(Guid songId)
    {
        var requestId = HttpContext.Items["X-Correlation-Id"]?.ToString() ?? Guid.NewGuid().ToString();

        try
        {
            var (song, cacheHit) = await _songService.GetSongAsync(songId, HttpContext.RequestAborted);
            return Ok(ApiResponse<SongResponseDto>.Ok(song, requestId, cacheHit ? "HIT" : "MISS"));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail("SONG_NOT_FOUND", $"Song {songId} not found.", requestId));
        }
        catch (Exception)
        {
            return StatusCode(500, ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.", requestId));
        }
    }
}

public class UploadSongRequest
{
    public IFormFile File { get; set; } = null!;
    public string? Title { get; set; }
    public string? GenreIds { get; set; }
    public string? Mood { get; set; }
    public string? Language { get; set; }
    public bool IsExplicit { get; set; }
}
