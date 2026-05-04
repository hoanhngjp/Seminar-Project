using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ApiGateway.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace ApiGateway.UnitTests.Services;

public class JwtValidationServiceTests
{
    private const string TestSecret = "test-secret-key-that-is-long-enough-for-hs256";
    private readonly Mock<IDatabase> _redisMock = new();
    private readonly IConfiguration _configuration;
    private readonly JwtValidationService _sut;

    public JwtValidationServiceTests()
    {
        _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["JWT_SECRET"] = TestSecret })
            .Build();

        _sut = new JwtValidationService(_configuration, _redisMock.Object);
    }

    private string GenerateToken(Guid userId, string role, int expiryMinutes = 15, string? jti = null)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(TestSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(ClaimTypes.Role, role),
            new Claim(JwtRegisteredClaimNames.Jti, jti ?? Guid.NewGuid().ToString())
        };
        var token = new JwtSecurityToken(claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    [Fact]
    public async Task ValidateAsync_ValidToken_ReturnsSuccess()
    {
        // Happy path — valid JWT, not blacklisted → IsValid = true
        var userId = Guid.NewGuid();
        var jti = Guid.NewGuid().ToString();
        var token = GenerateToken(userId, "Listener", jti: jti);

        _redisMock.Setup(r => r.KeyExistsAsync($"token:blacklist:{jti}", CommandFlags.None))
            .ReturnsAsync(false);

        var result = await _sut.ValidateAsync(token);

        result.IsValid.Should().BeTrue();
        result.UserId.Should().Be(userId.ToString());
        result.Jti.Should().Be(jti);
        result.Code.Should().BeNull();
    }

    [Fact]
    public async Task ValidateAsync_ExpiredToken_ReturnsTokenExpired()
    {
        // AC0.1.1: expired JWT → not valid, code TOKEN_EXPIRED
        var token = GenerateToken(Guid.NewGuid(), "Listener", expiryMinutes: -1);

        var result = await _sut.ValidateAsync(token);

        result.IsValid.Should().BeFalse();
        result.Code.Should().Be("TOKEN_EXPIRED");
    }

    [Fact]
    public async Task ValidateAsync_InvalidSignature_ReturnsUnauthorized()
    {
        // Wrong secret → signature invalid
        var wrongKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("wrong-secret-key-that-is-long-enough!"));
        var creds = new SigningCredentials(wrongKey, SecurityAlgorithms.HmacSha256);
        var jwtToken = new JwtSecurityToken(claims: [new Claim(JwtRegisteredClaimNames.Sub, "user-id")],
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: creds);
        var token = new JwtSecurityTokenHandler().WriteToken(jwtToken);

        var result = await _sut.ValidateAsync(token);

        result.IsValid.Should().BeFalse();
        result.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task ValidateAsync_BlacklistedToken_ReturnsTokenExpired()
    {
        // Token is valid JWT but JTI is in Redis blacklist
        var jti = Guid.NewGuid().ToString();
        var token = GenerateToken(Guid.NewGuid(), "Creator", jti: jti);

        _redisMock.Setup(r => r.KeyExistsAsync($"token:blacklist:{jti}", CommandFlags.None))
            .ReturnsAsync(true);

        var result = await _sut.ValidateAsync(token);

        result.IsValid.Should().BeFalse();
        result.Code.Should().Be("TOKEN_EXPIRED");
    }

    [Fact]
    public async Task ValidateAsync_MalformedToken_ReturnsUnauthorized()
    {
        var result = await _sut.ValidateAsync("not.a.jwt");

        result.IsValid.Should().BeFalse();
        result.Code.Should().Be("UNAUTHORIZED");
    }

    [Fact]
    public async Task ValidateAsync_ValidToken_ChecksBlacklistKey()
    {
        // Verify correct Redis key is checked
        var jti = Guid.NewGuid().ToString();
        var token = GenerateToken(Guid.NewGuid(), "Admin", jti: jti);

        _redisMock.Setup(r => r.KeyExistsAsync(It.IsAny<RedisKey>(), CommandFlags.None))
            .ReturnsAsync(false);

        await _sut.ValidateAsync(token);

        _redisMock.Verify(r => r.KeyExistsAsync($"token:blacklist:{jti}", CommandFlags.None), Times.Once);
    }
}
