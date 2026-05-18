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

    // Contract-First Checklist:
    // [1] GET /api/v1/parties/{joinCode}
    // [2] Path: joinCode (6 chars)
    // [3] 200: { success, data: { roomId, name, memberCount, currentSongTitle, hostAvatarUrl, hostDisplayName }, meta }
    // [4] 404 ROOM_NOT_FOUND, 401 UNAUTHORIZED
    // [5] GatewayAuth [Authorize]
    // [6] 300ms (includes calls to UserService + MusicService)
    // [7] YES
    // [8] Enriches room data with user profile and song title for preview card

    [HttpGet("{joinCode}")]
    public async Task<IActionResult> GetPartyPreview(string joinCode, CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromMilliseconds(300));

        var requestId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();

        var result = await partyService.GetPartyPreviewAsync(joinCode, cts.Token);
        if (result is null)
            return NotFound(ApiResponse<object>.Fail("ROOM_NOT_FOUND", "Phòng không tồn tại hoặc đã đóng.", requestId));

        return Ok(ApiResponse<PartyPreviewResponse>.Ok(result, requestId));
    }

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

    // Contract-First Checklist:
    // [1] GET /api/v1/parties/{roomId}/queue
    // [2] Path: roomId (UUID string)
    // [3] 200: { success, data: { roomId, queue: [{ songId, addedByUserId }] }, meta }
    // [4] 404 ROOM_NOT_FOUND, 401 UNAUTHORIZED
    // [5] GatewayAuth [Authorize]
    // [6] 150ms
    // [7] YES
    // [8] Returns current queue snapshot; empty array [] when queue is empty

    [HttpGet("{roomId}/queue")]
    public async Task<IActionResult> GetQueue(string roomId, CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromMilliseconds(150));

        var requestId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();

        var queue = await partyService.GetQueueAsync(roomId, cts.Token);
        return Ok(ApiResponse<GetQueueResponse>.Ok(new GetQueueResponse(roomId, queue), requestId));
    }
}
