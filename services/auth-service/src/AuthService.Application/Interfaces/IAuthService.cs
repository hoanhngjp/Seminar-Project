using AuthService.Application.DTOs;

namespace AuthService.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent, CancellationToken ct);
    Task<AuthResponse> RefreshAsync(Guid jti, string? ipAddress, string? userAgent, CancellationToken ct);
    Task LogoutAsync(Guid jti, CancellationToken ct);
}
