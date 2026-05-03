using Microsoft.AspNetCore.Mvc;
using UserService.Api.Common;
using UserService.Application.DTOs;
using UserService.Application.Services;

namespace UserService.Api.Controllers;

/// <summary>
/// Internal endpoints — not exposed via API Gateway. Service-to-service trust only.
/// </summary>
[ApiController]
[Route("internal/users")]
public class InternalUsersController(IUserService userService) : ControllerBase
{
    // GET /internal/users/{id}/preferences — for Recommendation Service
    [HttpGet("{id:guid}/preferences")]
    public async Task<IActionResult> GetPreferences(Guid id, CancellationToken ct)
    {
        var prefs = await userService.GetPreferencesByUserIdAsync(id, ct);
        if (prefs is null)
            return Ok(new UserPreferencesDto([], [], "standard"));
        return Ok(prefs);
    }

    // POST /internal/users/verify-credentials — for Auth Service login flow
    [HttpPost("verify-credentials")]
    public async Task<IActionResult> VerifyCredentials(
        [FromBody] VerifyCredentialsRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
            return BadRequest(new { error = "email and password required" });

        var result = await userService.VerifyCredentialsAsync(request, ct);
        if (result is null)
            return Unauthorized();

        return Ok(result);
    }
}
