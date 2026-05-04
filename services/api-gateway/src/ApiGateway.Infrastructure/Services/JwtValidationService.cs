using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ApiGateway.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;

namespace ApiGateway.Infrastructure.Services;

public class JwtValidationService(IConfiguration configuration, IDatabase redis) : IJwtValidationService
{
    private static readonly JwtSecurityTokenHandler Handler = new();

    public async Task<JwtValidationResult> ValidateAsync(string token, CancellationToken ct = default)
    {
        // Docker sets Jwt__SecretKey; local dev may use JWT_SECRET env var
        var secret = configuration["Jwt:SecretKey"]
            ?? configuration["JWT_SECRET"]
            ?? throw new InvalidOperationException("JWT secret is required (Jwt:SecretKey or JWT_SECRET).");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));

        var validationParams = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
            ValidateIssuer = false,
            ValidateAudience = false
        };

        TokenValidationResult result;
        try
        {
            result = await Handler.ValidateTokenAsync(token, validationParams);
        }
        catch (Exception)
        {
            return new JwtValidationResult(false, "UNAUTHORIZED", null, null, null);
        }

        if (!result.IsValid)
        {
            var code = result.Exception is SecurityTokenExpiredException ? "TOKEN_EXPIRED" : "UNAUTHORIZED";
            return new JwtValidationResult(false, code, null, null, null);
        }

        var jwtToken = (JwtSecurityToken)result.SecurityToken;
        var jti = jwtToken.Id;
        var userId = jwtToken.Subject;
        var role = jwtToken.Claims
            .FirstOrDefault(c => c.Type == ClaimTypes.Role || c.Type == "role")?.Value;

        // Check blacklist — key written by Auth Service RedisCacheService.RevokeTokenInCacheAsync
        var blacklistKey = $"token:blacklist:{jti}";
        var isBlacklisted = await redis.KeyExistsAsync(blacklistKey);
        if (isBlacklisted)
            return new JwtValidationResult(false, "TOKEN_EXPIRED", null, null, null);

        return new JwtValidationResult(true, null, userId, role, jti);
    }
}
