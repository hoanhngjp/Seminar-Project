using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MusicService.Api.Models;
using MusicService.Application.DTOs;
using MusicService.Application.Interfaces;

namespace MusicService.Api.Controllers;

[ApiController]
[Route("api/v1/music/[controller]")]
[Authorize]
public class ArtistsController : ControllerBase
{
    private readonly ISongService _songService;

    public ArtistsController(ISongService songService)
    {
        _songService = songService;
    }

    // ----------------------------------------------------------------
    // Contract-First Checklist — GET /api/v1/music/artists/{artistId}
    // [1] GET /api/v1/music/artists/{artistId}
    // [2] Path: artistId (UUID)
    // [3] 200: { success, data: ArtistResponseDto, meta }
    // [4] 401 UNAUTHORIZED, 404 SONG_NOT_FOUND (reusing SONG_NOT_FOUND as artist proxy)
    // [5] Auth (GatewayAuth)
    // [6] 200ms
    // [7] YES
    // [8] Returns top songs ordered by PlayCount desc
    // ----------------------------------------------------------------

    [HttpGet("{artistId:guid}")]
    public async Task<IActionResult> GetArtist(Guid artistId)
    {
        var requestId = HttpContext.Items["X-Correlation-Id"]?.ToString() ?? Guid.NewGuid().ToString();

        try
        {
            var artist = await _songService.GetArtistAsync(artistId, HttpContext.RequestAborted);
            return Ok(ApiResponse<ArtistResponseDto>.Ok(artist, requestId));
        }
        catch (KeyNotFoundException)
        {
            return NotFound(ApiResponse<object>.Fail("SONG_NOT_FOUND", $"Artist {artistId} not found.", requestId));
        }
        catch (Exception)
        {
            return StatusCode(500, ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.", requestId));
        }
    }
}
