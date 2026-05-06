using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using MusicService.Api.Models;
using MusicService.Application.Interfaces;

namespace MusicService.Api.Controllers;

/// <summary>
/// Internal endpoints — NOT exposed through API Gateway.
/// Called only by other services within the cluster (Streaming Service, Recommendation Service).
/// No authentication required: service-to-service trust within the Docker network.
/// </summary>
[ApiController]
[Route("internal/songs")]
public class InternalSongsController : ControllerBase
{
    private readonly ISongService _songService;

    public InternalSongsController(ISongService songService)
    {
        _songService = songService;
    }

    // ----------------------------------------------------------------
    // GET /internal/songs/{songId}/storage-key
    // Caller: Streaming Service
    // Returns: { storageKey, bucket } — used to generate pre-signed URL
    // Timeout caller must enforce: 150ms
    // ----------------------------------------------------------------

    [HttpGet("{songId:guid}/storage-key")]
    public async Task<IActionResult> GetStorageKey(Guid songId)
    {
        try
        {
            var result = await _songService.GetSongStorageKeyAsync(songId, HttpContext.RequestAborted);
            return Ok(new { storageKey = result.StorageKey, bucket = result.Bucket });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "SONG_NOT_FOUND" });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "INTERNAL_ERROR" });
        }
    }

    // ----------------------------------------------------------------
    // GET /internal/songs/{songId}
    // Caller: Analytics Service (ownership check: song.artistId == currentUserId)
    // Returns: { id, artistId, title } — minimal shape for auth checks
    // Timeout caller must enforce: 150ms
    // ----------------------------------------------------------------

    [HttpGet("{songId:guid}")]
    public async Task<IActionResult> GetSongMeta(Guid songId)
    {
        try
        {
            var (song, _) = await _songService.GetSongAsync(songId, HttpContext.RequestAborted);
            return Ok(new { id = song.Id, artistId = song.Artist.Id, title = song.Title });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { error = "SONG_NOT_FOUND" });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "INTERNAL_ERROR" });
        }
    }

    // ----------------------------------------------------------------
    // GET /internal/songs/batch?ids=id1,id2,...
    // Caller: Recommendation Service
    // Returns: { songs: [{ id, title, artistName, genreId, moodTags }] }
    // Missing IDs are silently skipped — caller handles partial results.
    // Timeout caller must enforce: 200ms
    // ----------------------------------------------------------------

    [HttpGet("batch")]
    public async Task<IActionResult> GetBatch([FromQuery] string? ids)
    {
        if (string.IsNullOrWhiteSpace(ids))
            return Ok(new { songs = Array.Empty<object>() });

        var songIds = ids
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(id => Guid.TryParse(id.Trim(), out var g) ? g : (Guid?)null)
            .Where(g => g.HasValue)
            .Select(g => g!.Value)
            .Distinct()
            .ToList();

        if (songIds.Count == 0)
            return Ok(new { songs = Array.Empty<object>() });

        try
        {
            var songs = await _songService.GetSongsBatchAsync(songIds, HttpContext.RequestAborted);
            return Ok(new { songs });
        }
        catch (Exception)
        {
            return StatusCode(500, new { error = "INTERNAL_ERROR" });
        }
    }
}
