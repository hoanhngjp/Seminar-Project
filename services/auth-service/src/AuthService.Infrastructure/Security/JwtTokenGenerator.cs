using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using AuthService.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace AuthService.Infrastructure.Security;

public class JwtTokenGenerator(IConfiguration configuration) : ITokenGenerator
{
    public int AccessTokenExpiryMinutes => configuration.GetValue<int>("Jwt:AccessTokenExpiryMinutes", 15);
    public int RefreshTokenExpiryDays => configuration.GetValue<int>("Jwt:RefreshTokenExpiryDays", 7);

    public string GenerateAccessToken(Guid userId, string role, int expiresInMinutes)
    {
        // Docker sets Jwt__SecretKey; local dev may use JWT_SECRET env var
        var secret = configuration["Jwt:SecretKey"]
            ?? configuration["JWT_SECRET"]
            ?? throw new InvalidOperationException("JWT secret is required (Jwt:SecretKey or JWT_SECRET).");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(ClaimTypes.Role, role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiresInMinutes),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
