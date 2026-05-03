namespace AuthService.Application.Interfaces;

public interface ITokenGenerator
{
    string GenerateAccessToken(Guid userId, string role, int expiresInMinutes);
    int AccessTokenExpiryMinutes { get; }
    int RefreshTokenExpiryDays { get; }
}
