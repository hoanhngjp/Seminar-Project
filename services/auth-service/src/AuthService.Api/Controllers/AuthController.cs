using AuthService.Application.DTOs;
using AuthService.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    // Contract-First Checklist — POST /api/v1/auth/register
    // [1] POST /api/v1/auth/register
    // [2] Body: { email, password, displayName, role? ("Listener"|"Creator") }
    // [3] 201: { success, data: { userId, email, displayName, role }, meta, error:null }
    // [4] 400 VALIDATION_ERROR (missing/invalid fields, email taken)
    //     500 INTERNAL_ERROR
    // [5] No auth required
    // [6] 3000ms budget (bcrypt in User Service)
    // [7] YES (idempotent on same email → 400 not 201)
    // [8] Admin role not creatable via API. TODO: propose USER_ALREADY_EXISTS error code.
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var result = await authService.RegisterAsync(request, ct);
        return StatusCode(201, ApiResponse<RegisterResponse>.CreateSuccess(result, HttpContext));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var response = await authService.LoginAsync(request, ipAddress, userAgent, ct);

        AppendRefreshTokenCookie(response.RefreshToken.ToString());

        // Remove RefreshToken from the payload response
        var dto = new { response.AccessToken, response.ExpiresIn };
        return Ok(ApiResponse<object>.CreateSuccess(dto, HttpContext));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(CancellationToken ct)
    {
        if (!Request.Cookies.TryGetValue("refreshToken", out var refreshTokenStr) ||
            !Guid.TryParse(refreshTokenStr, out var jti))
        {
            return Unauthorized(ApiResponse<object>.CreateFail("TOKEN_INVALID", "Refresh token missing or invalid.", HttpContext));
        }

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = Request.Headers.UserAgent.ToString();

        var response = await authService.RefreshAsync(jti, ipAddress, userAgent, ct);

        AppendRefreshTokenCookie(response.RefreshToken.ToString());

        var dto = new { response.AccessToken, response.ExpiresIn };
        return Ok(ApiResponse<object>.CreateSuccess(dto, HttpContext));
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        if (Request.Cookies.TryGetValue("refreshToken", out var refreshTokenStr) &&
            Guid.TryParse(refreshTokenStr, out var jti))
        {
            await authService.LogoutAsync(jti, ct);
        }

        Response.Cookies.Delete("refreshToken");
        return Ok(ApiResponse<object>.CreateSuccess(new { }, HttpContext));
    }

    private void AppendRefreshTokenCookie(string token)
    {
        var cookieOptions = new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTime.UtcNow.AddDays(7) // should match ITokenGenerator config
        };
        Response.Cookies.Append("refreshToken", token, cookieOptions);
    }
}
