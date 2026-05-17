using System.Security.Claims;
using ListeningPartyService.Api.Models;
using ListeningPartyService.Application.DTOs;
using ListeningPartyService.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ListeningPartyService.Api.Controllers;

[ApiController]
[Route("api/v1/parties")]
[Authorize]
public class PartiesController(IPartyService partyService) : ControllerBase
{
    // Contract-First Checklist:
    // [1] POST /api/v1/parties
    // [2] Body: { songId: string }
    // [3] 201: { success, data: { roomId, joinCode, hostId }, meta, error: null }
    // [4] 400 VALIDATION_ERROR, 401 UNAUTHORIZED
    // [5] GatewayAuth [Authorize]
    // [6] 200ms
    // [7] YES
    // [8] Redis HSET party:room:{roomId} TTL 24h; joinCode = 6 alphanumeric chars

    [HttpPost]
    public async Task<IActionResult> CreateParty([FromBody] CreatePartyRequest request, CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromMilliseconds(200));

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var requestId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();

        var result = await partyService.CreatePartyAsync(userId, request.Name, request.SongId, cts.Token);
        return StatusCode(201, ApiResponse<CreatePartyResponse>.Ok(result, requestId));
    }

    // Contract-First Checklist:
    // [1] POST /api/v1/parties/{joinCode}/join
    // [2] Path: joinCode (6 chars)
    // [3] 200: { success, data: { roomId, hostId, currentSongId, playbackPositionSec }, meta, error: null }
    // [4] 404 ROOM_NOT_FOUND, 401 UNAUTHORIZED
    // [5] GatewayAuth [Authorize]
    // [6] 150ms
    // [7] YES
    // [8] Redis GET party:joincode:{joinCode} → HGETALL party:room:{roomId}

    [HttpPost("{joinCode}/join")]
    public async Task<IActionResult> JoinParty(string joinCode, CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromMilliseconds(150));

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var requestId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();

        var result = await partyService.JoinPartyAsync(joinCode, userId, cts.Token);
        return Ok(ApiResponse<JoinPartyResponse>.Ok(result, requestId));
    }
}
