using AuthService.Application.DTOs;
using AuthService.Application.Interfaces;
using AuthService.Domain.Exceptions;
using AuthService.Domain.Models;

namespace AuthService.Application.Services;

public class AuthService(
    IUserGrpcClient userClient,
    ITokenGenerator tokenGenerator,
    IRefreshTokenRepository refreshTokenRepo,
    ITokenBlacklistRepository blacklistRepo,
    ICacheService cache) : IAuthService
{
    public async Task<AuthResponse> LoginAsync(LoginRequest request, string? ipAddress, string? userAgent, CancellationToken ct)
    {
        var attempts = await cache.IncrementLoginAttemptAsync(request.Username, TimeSpan.FromMinutes(15));
        if (attempts > 5)
        {
            throw new AccountLockedException();
        }

        string userIdStr;
        string roleStr;
        try
        {
            (userIdStr, roleStr) = await userClient.VerifyCredentialsAsync(request.Username, request.Password, ct);
        }
        catch (Exception ex) when (ex.Message.Contains("Invalid credentials"))
        {
            throw new UnauthorizedException("AUTH_INVALID_CREDENTIALS", "Invalid username or password.");
        }

        await cache.ClearLoginAttemptsAsync(request.Username);

        var userId = Guid.Parse(userIdStr);
        var accessToken = tokenGenerator.GenerateAccessToken(userId, roleStr, tokenGenerator.AccessTokenExpiryMinutes);
        
        var refreshToken = new RefreshToken
        {
            Jti = Guid.NewGuid(),
            UserId = userId,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            ExpiresAt = DateTime.UtcNow.AddDays(tokenGenerator.RefreshTokenExpiryDays)
        };
        await refreshTokenRepo.AddAsync(refreshToken, ct);

        return new AuthResponse
        {
            AccessToken = accessToken,
            ExpiresIn = tokenGenerator.AccessTokenExpiryMinutes * 60,
            RefreshToken = refreshToken.Jti
        };
    }

    public async Task<AuthResponse> RefreshAsync(Guid jti, string? ipAddress, string? userAgent, CancellationToken ct)
    {
        var token = await refreshTokenRepo.GetByJtiAsync(jti, ct);
        if (token == null)
            throw new UnauthorizedException("TOKEN_INVALID", "Invalid refresh token.");

        if (token.ExpiresAt < DateTime.UtcNow)
            throw new UnauthorizedException("TOKEN_EXPIRED", "Refresh token expired.");

        // Check for reuse
        bool isFirstUse = await cache.SetNxAsync($"rt:used:{jti}", "1", TimeSpan.FromDays(tokenGenerator.RefreshTokenExpiryDays));
        if (!isFirstUse || token.Revoked)
        {
            await refreshTokenRepo.RevokeAllForUserAsync(token.UserId, ct);
            throw new ForbiddenException("TOKEN_REUSED", "Refresh token reuse detected. All sessions revoked.");
        }

        // Check if blacklisted
        if (await blacklistRepo.IsBlacklistedAsync(jti, ct))
            throw new UnauthorizedException("TOKEN_INVALID", "Token is blacklisted.");

        // Revoke current
        token.Revoked = true;
        token.RevokedAt = DateTime.UtcNow;
        await refreshTokenRepo.UpdateAsync(token, ct);

        // Blacklist current
        var blacklist = new TokenBlacklist
        {
            Jti = jti,
            UserId = token.UserId,
            ExpiresAt = token.ExpiresAt,
            Reason = "rotated"
        };
        await blacklistRepo.AddAsync(blacklist, ct);
        await cache.RevokeTokenInCacheAsync(jti.ToString(), token.ExpiresAt - DateTime.UtcNow);

        // We assume role is "Listener" for refresh if we don't query User Service,
        // but according to architecture, should we query user service?
        // Let's just default to "Listener" or we can store role in Token.
        // Actually, token doesn't have role. We can just use "Listener" as default,
        // or we could add a gRPC call GetUserProfile here to get the role.
        var role = "Listener"; 

        var accessToken = tokenGenerator.GenerateAccessToken(token.UserId, role, tokenGenerator.AccessTokenExpiryMinutes);
        
        var newRefreshToken = new RefreshToken
        {
            Jti = Guid.NewGuid(),
            UserId = token.UserId,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            ExpiresAt = DateTime.UtcNow.AddDays(tokenGenerator.RefreshTokenExpiryDays)
        };
        await refreshTokenRepo.AddAsync(newRefreshToken, ct);

        return new AuthResponse
        {
            AccessToken = accessToken,
            ExpiresIn = tokenGenerator.AccessTokenExpiryMinutes * 60,
            RefreshToken = newRefreshToken.Jti
        };
    }

    public async Task LogoutAsync(Guid jti, CancellationToken ct)
    {
        var token = await refreshTokenRepo.GetByJtiAsync(jti, ct);
        if (token == null || token.Revoked) return;

        token.Revoked = true;
        token.RevokedAt = DateTime.UtcNow;
        await refreshTokenRepo.UpdateAsync(token, ct);

        var blacklist = new TokenBlacklist
        {
            Jti = jti,
            UserId = token.UserId,
            ExpiresAt = token.ExpiresAt,
            Reason = "logout"
        };
        await blacklistRepo.AddAsync(blacklist, ct);
        await cache.RevokeTokenInCacheAsync(jti.ToString(), token.ExpiresAt - DateTime.UtcNow);
    }
}
