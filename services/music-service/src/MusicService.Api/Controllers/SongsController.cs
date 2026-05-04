using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MusicService.Api.Filters;
using MusicService.Api.Models;
using MusicService.Application.DTOs;
using MusicService.Application.Interfaces;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace MusicService.Api.Controllers;

[ApiController]
[Route("api/v1/music/[controller]")]
public class SongsController : ControllerBase
{
    private readonly ISongService _songService;

    public SongsController(ISongService songService)
    {
        _songService = songService;
    }

    [HttpPost]
    [IdempotencyFilter]
    // [Authorize] // Temporarily commented until auth is fully integrated across the API gateway
    [RequestSizeLimit(52428800)] // 50MB
    [RequestFormLimits(MultipartBodyLengthLimit = 52428800)]
    public async Task<IActionResult> UploadSong([FromForm] UploadSongRequest request)
    {
        if (request.File == null || request.File.Length == 0)
            return BadRequest(ApiResponse<object>.Fail("File is required."));

        // Extract UserId from Claims or use a dummy one for testing
        var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "sub")?.Value;
        
        // For development/testing: 
        // We will fallback to a seed user id if the token is missing.
        Guid userId = string.IsNullOrEmpty(userIdClaim) 
            ? Guid.Parse("11111111-1111-1111-1111-111111111111") // Default artist for testing
            : Guid.Parse(userIdClaim);

        var genreIdsList = new List<string>();
        if (!string.IsNullOrEmpty(request.GenreIds))
        {
            genreIdsList = request.GenreIds.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(g => g.Trim()).ToList();
        }

        var dto = new UploadSongDto
        {
            Title = request.Title ?? "Untitled",
            GenreIds = genreIdsList,
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
            
            return Ok(ApiResponse<object>.Ok(new
            {
                songId = song.Id,
                title = song.Title,
                storageKey = song.S3AudioKey,
                status = "processing"
            }));
        }
        catch (InvalidOperationException ex) when (ex.Message.Contains("Creator profile not found"))
        {
            return StatusCode(403, ApiResponse<object>.Fail("FORBIDDEN: Creator profile not found."));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<object>.Fail($"VALIDATION_ERROR: {ex.Message}"));
        }
        catch (Exception ex)
        {
            if (ex.Message.Contains("storage service"))
            {
                return StatusCode(503, ApiResponse<object>.Fail("SERVICE_UNAVAILABLE: Storage service is currently down."));
            }
            return StatusCode(500, ApiResponse<object>.Fail("INTERNAL_ERROR"));
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
