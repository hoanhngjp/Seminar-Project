using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UserService.Api.Common;
using UserService.Application.DTOs;
using UserService.Application.Services;
using UserService.Domain.Exceptions;

namespace UserService.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize]
public class UsersController(IUserService userService, ILogger<UsersController> logger) : ControllerBase
{
    // GET /api/v1/users/me  — latency budget 300ms
    [HttpGet("me")]
    public async Task<IActionResult> GetMe(CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromMilliseconds(300));

        var userId = GetCurrentUserId();
        var (profile, cacheHit) = await userService.GetMyProfileAsync(userId, cts.Token);
        return Ok(ApiResponse<UserProfileDto>.Ok(profile, HttpContext, cacheHit ? "HIT" : "MISS"));
    }

    // POST /api/v1/users/me/preferences  — latency budget 400ms
    [HttpPost("me/preferences")]
    public async Task<IActionResult> UpdatePreferences(
        [FromBody] UpdatePreferencesRequest request, CancellationToken ct)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromMilliseconds(400));

        if (request.PreferredGenres is null || request.PreferredLanguages is null)
            throw new ValidationException("preferredGenres and preferredLanguages are required.");

        var userId = GetCurrentUserId();
        var correlationId = HttpContext.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString();
        await userService.UpdatePreferencesAsync(userId, request, correlationId, cts.Token);

        logger.LogInformation("Preferences updated. UserId={UserId}", userId);
        return Ok(ApiResponse<object>.Ok(new { updated = true }, HttpContext));
    }

    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(sub) || !Guid.TryParse(sub, out var id))
            throw new UnauthorizedException();
        return id;
    }
}
