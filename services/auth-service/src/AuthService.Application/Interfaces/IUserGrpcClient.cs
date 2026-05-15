using AuthService.Application.DTOs;

namespace AuthService.Application.Interfaces;

public interface IUserGrpcClient
{
    Task<(string UserId, string Role)> VerifyCredentialsAsync(string username, string password, CancellationToken ct);
    Task<RegisterResponse> CreateUserAsync(RegisterRequest request, CancellationToken ct);
    // Returns null if user not found (NOT_FOUND gRPC status)
    Task<(string UserId, string Role)?> GetUserByEmailAsync(string email, CancellationToken ct);
    Task<RegisterResponse> CreateOAuthUserAsync(string email, string displayName, string? pictureUrl, CancellationToken ct);
}
