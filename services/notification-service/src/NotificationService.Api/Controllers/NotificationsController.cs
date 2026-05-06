using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NotificationService.Api.Models;
using NotificationService.Application.Services;

namespace NotificationService.Api.Controllers;

[ApiController]
[Route("api/v1/notifications")]
[Authorize]
public class NotificationsController(INotificationService notificationService) : ControllerBase
{
    // ----------------------------------------------------------------
    // Contract-First Checklist — GET /api/v1/notifications/unread
    // [1] GET /api/v1/notifications/unread
    // [2] Query: limit (1–50, default 20), cursor (base64 string)
    // [3] 200: { success, data: { items, nextCursor, hasMore }, meta }
    // [4] 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 500 INTERNAL_ERROR
    // [5] GatewayAuth
    // [6] 150ms
    // [7] YES
    // [8] Filter: recipientId == currentUserId AND status IN [Pending, Delivered]
    // ----------------------------------------------------------------

    [HttpGet("unread")]
    public async Task<IActionResult> GetUnread(
        [FromQuery] int limit = 20,
        [FromQuery] string? cursor = null,
        CancellationToken ct = default)
    {
        var requestId = GetRequestId();

        if (!TryGetUserId(out var userId))
            return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Missing user identity.", requestId));

        if (limit is < 1 or > 50)
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR",
                "limit must be between 1 and 50.", requestId));

        var result = await notificationService.GetUnreadAsync(userId, limit, cursor, ct);

        return Ok(ApiResponse<object>.Ok(new
        {
            items = result.Items,
            nextCursor = result.NextCursor,
            hasMore = result.HasMore
        }, requestId));
    }

    // ----------------------------------------------------------------
    // Contract-First Checklist — PATCH /api/v1/notifications/{id}/read
    // [1] PATCH /api/v1/notifications/{id}/read
    // [2] Header: Idempotency-Key (required); Path: id (MongoDB ObjectId string)
    // [3] 200: { success, data: { notificationId, readAt }, meta }
    // [4] 400 VALIDATION_ERROR, 401 UNAUTHORIZED, 404 NOTIFICATION_NOT_FOUND,
    //     409 IDEMPOTENCY_CONFLICT, 500 INTERNAL_ERROR
    // [5] GatewayAuth; Idempotency-Key → Redis SETNX notification:idem:{key} TTL 24h
    // [6] 150ms
    // [7] NO — idempotent via Idempotency-Key
    // [8] Only recipient can mark their own notification
    // ----------------------------------------------------------------

    [HttpPatch("{id}/read")]
    public async Task<IActionResult> MarkRead(
        string id,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken ct = default)
    {
        var requestId = GetRequestId();

        if (string.IsNullOrWhiteSpace(idempotencyKey))
            return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR",
                "Idempotency-Key header is required.", requestId));

        if (!TryGetUserId(out var userId))
            return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Missing user identity.", requestId));

        var (success, markResult) = await notificationService.MarkReadAsync(id, userId, idempotencyKey, ct);

        if (!success)
            return Conflict(ApiResponse<object>.Fail("IDEMPOTENCY_CONFLICT",
                "This request has already been processed.", requestId));

        return Ok(ApiResponse<object>.Ok(new
        {
            notificationId = markResult!.NotificationId,
            readAt = markResult.ReadAt
        }, requestId));
    }

    // ----------------------------------------------------------------
    // Contract-First Checklist — PATCH /api/v1/notifications/read-all
    // [1] PATCH /api/v1/notifications/read-all
    // [2] Headers: X-User-Id, X-User-Role
    // [3] 202: { success, data: { queued: true }, meta }
    // [4] 401 UNAUTHORIZED, 500 INTERNAL_ERROR
    // [5] GatewayAuth
    // [6] 200ms — trả 202 ngay, background async
    // [7] YES
    // [8] Bulk update all Pending/Delivered → Read for current user
    // ----------------------------------------------------------------

    [HttpPatch("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct = default)
    {
        var requestId = GetRequestId();

        if (!TryGetUserId(out var userId))
            return Unauthorized(ApiResponse<object>.Fail("UNAUTHORIZED", "Missing user identity.", requestId));

        await notificationService.QueueMarkAllReadAsync(userId, ct);

        return StatusCode(202, ApiResponse<object>.Ok(new { queued = true }, requestId));
    }

    private bool TryGetUserId(out Guid userId)
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claim, out userId);
    }

    private string GetRequestId() =>
        HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();
}
