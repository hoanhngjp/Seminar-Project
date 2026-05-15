using System;
using System.Threading;
using System.Threading.Tasks;
using AuthService.Application.DTOs;
using AuthService.Application.Interfaces;
using AuthService.Domain.Exceptions;
using AuthService.Domain.Models;
using FluentAssertions;
using Moq;
using Xunit;

namespace AuthService.UnitTests;

public class AuthServiceTests
{
    private readonly Mock<IUserGrpcClient> _userClientMock = new();
    private readonly Mock<ITokenGenerator> _tokenGeneratorMock = new();
    private readonly Mock<IRefreshTokenRepository> _refreshTokenRepoMock = new();
    private readonly Mock<ITokenBlacklistRepository> _blacklistRepoMock = new();
    private readonly Mock<ICacheService> _cacheMock = new();
    private readonly Mock<IGoogleTokenVerifier> _googleVerifierMock = new();

    private readonly Application.Services.AuthService _sut;

    public AuthServiceTests()
    {
        _sut = new Application.Services.AuthService(
            _userClientMock.Object,
            _tokenGeneratorMock.Object,
            _refreshTokenRepoMock.Object,
            _blacklistRepoMock.Object,
            _cacheMock.Object,
            _googleVerifierMock.Object
        );
    }

    [Fact]
    public async Task LoginAsync_ValidCredentials_ReturnsTokens()
    {
        // Arrange — FE gửi email field (không phải username)
        var request = new LoginRequest { Email = "test@example.com", Password = "password" };
        var userId = Guid.NewGuid().ToString();
        var role = "Listener";

        _cacheMock.Setup(c => c.IncrementLoginAttemptAsync(It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ReturnsAsync(1);
        _userClientMock.Setup(u => u.VerifyCredentialsAsync(request.Email, request.Password, It.IsAny<CancellationToken>()))
            .ReturnsAsync((userId, role));
        _tokenGeneratorMock.Setup(t => t.GenerateAccessToken(It.IsAny<Guid>(), role, It.IsAny<int>()))
            .Returns("access_token");

        // Act
        var result = await _sut.LoginAsync(request, "127.0.0.1", "test-agent", CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("access_token");
        result.RefreshToken.Should().NotBeEmpty();
        _refreshTokenRepoMock.Verify(r => r.AddAsync(It.Is<RefreshToken>(rt => rt.UserId.ToString() == userId), It.IsAny<CancellationToken>()), Times.Once);
        _cacheMock.Verify(c => c.ClearLoginAttemptsAsync(request.Email), Times.Once);
    }

    [Fact]
    public async Task LoginAsync_AccountLocked_ThrowsAccountLockedException()
    {
        // Arrange
        var request = new LoginRequest { Email = "locked@example.com", Password = "password" };

        _cacheMock.Setup(c => c.IncrementLoginAttemptAsync(It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ReturnsAsync(6); // 5 is limit

        // Act
        var act = async () => await _sut.LoginAsync(request, "127.0.0.1", "test-agent", CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<AccountLockedException>();
    }

    [Fact]
    public async Task RefreshAsync_ValidToken_ReturnsNewTokens()
    {
        // Arrange
        var jti = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var token = new RefreshToken
        {
            Jti = jti,
            UserId = userId,
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };

        _refreshTokenRepoMock.Setup(r => r.GetByJtiAsync(jti, It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);
        _cacheMock.Setup(c => c.SetNxAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ReturnsAsync(true);
        _blacklistRepoMock.Setup(b => b.IsBlacklistedAsync(jti, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        _tokenGeneratorMock.Setup(t => t.GenerateAccessToken(userId, "Listener", It.IsAny<int>()))
            .Returns("new_access_token");

        // Act
        var result = await _sut.RefreshAsync(jti, "127.0.0.1", "test-agent", CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.AccessToken.Should().Be("new_access_token");
        token.Revoked.Should().BeTrue();
        _blacklistRepoMock.Verify(b => b.AddAsync(It.Is<TokenBlacklist>(tb => tb.Jti == jti), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RegisterAsync_ValidRequest_DelegatesAndReturnsResponse()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "new@example.com",
            Password = "Password1",
            DisplayName = "New User",
            Role = "Listener"
        };
        var expected = new RegisterResponse
        {
            UserId = Guid.NewGuid().ToString(),
            Email = request.Email,
            DisplayName = request.DisplayName,
            Role = "Listener"
        };

        _userClientMock.Setup(u => u.CreateUserAsync(request, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        // Act
        var result = await _sut.RegisterAsync(request, CancellationToken.None);

        // Assert
        result.Should().BeEquivalentTo(expected);
        _userClientMock.Verify(u => u.CreateUserAsync(request, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("", "Password1", "Name")]
    [InlineData("e@e.com", "", "Name")]
    [InlineData("e@e.com", "Password1", "")]
    public async Task RegisterAsync_MissingFields_ThrowsValidationException(string email, string password, string displayName)
    {
        var request = new RegisterRequest { Email = email, Password = password, DisplayName = displayName };

        var act = async () => await _sut.RegisterAsync(request, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task RegisterAsync_WeakPassword_ThrowsValidationException()
    {
        var request = new RegisterRequest
        {
            Email = "e@e.com",
            Password = "short",
            DisplayName = "Name"
        };

        var act = async () => await _sut.RegisterAsync(request, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*8 characters*");
    }

    [Fact]
    public async Task RegisterAsync_DuplicateEmail_PropagatesValidationException()
    {
        // Arrange — gRPC client throws (maps AlreadyExists → ValidationException)
        var request = new RegisterRequest
        {
            Email = "taken@example.com",
            Password = "Password1",
            DisplayName = "Someone"
        };

        _userClientMock.Setup(u => u.CreateUserAsync(request, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ValidationException("Email is already registered."));

        // Act
        var act = async () => await _sut.RegisterAsync(request, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*already registered*");
    }

    [Fact]
    public async Task RefreshAsync_ReusedToken_RevokesAllAndThrowsForbidden()
    {
        // Arrange
        var jti = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var token = new RefreshToken
        {
            Jti = jti,
            UserId = userId,
            ExpiresAt = DateTime.UtcNow.AddDays(1)
        };

        _refreshTokenRepoMock.Setup(r => r.GetByJtiAsync(jti, It.IsAny<CancellationToken>()))
            .ReturnsAsync(token);
        _cacheMock.Setup(c => c.SetNxAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<TimeSpan>()))
            .ReturnsAsync(false); // Indicates it was already used

        // Act
        var act = async () => await _sut.RefreshAsync(jti, "127.0.0.1", "test-agent", CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ForbiddenException>()
            .WithMessage("*reuse detected*");
        _refreshTokenRepoMock.Verify(r => r.RevokeAllForUserAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    // -------------------------------------------------------------------------
    // GoogleSignInAsync tests
    // -------------------------------------------------------------------------

    [Fact]
    public async Task GoogleSignInAsync_ExistingUser_ReturnsTokens()
    {
        // Arrange — Google token valid, user already registered
        var userId = Guid.NewGuid().ToString();
        var payload = new GooglePayload("user@gmail.com", "User Name", null, "google-sub-123");

        _googleVerifierMock.Setup(g => g.VerifyAsync("valid-id-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(payload);
        _userClientMock.Setup(u => u.GetUserByEmailAsync("user@gmail.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((userId, "Listener"));
        _tokenGeneratorMock.Setup(t => t.GenerateAccessToken(It.IsAny<Guid>(), "Listener", It.IsAny<int>()))
            .Returns("access_token");

        // Act
        var result = await _sut.GoogleSignInAsync("valid-id-token", "127.0.0.1", "agent", CancellationToken.None);

        // Assert
        result.AccessToken.Should().Be("access_token");
        _userClientMock.Verify(u => u.CreateOAuthUserAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GoogleSignInAsync_NewUser_AutoRegistersAndReturnsTokens()
    {
        // Arrange — Google token valid, user NOT in system yet → auto-register
        var newUserId = Guid.NewGuid().ToString();
        var payload = new GooglePayload("new@gmail.com", "New User", "https://pic.url/avatar.jpg", "sub-new");

        _googleVerifierMock.Setup(g => g.VerifyAsync("valid-id-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(payload);
        _userClientMock.Setup(u => u.GetUserByEmailAsync("new@gmail.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((ValueTuple<string, string>?)null);
        _userClientMock.Setup(u => u.CreateOAuthUserAsync("new@gmail.com", "New User", "https://pic.url/avatar.jpg", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new RegisterResponse { UserId = newUserId, Email = "new@gmail.com", DisplayName = "New User", Role = "Listener" });
        _tokenGeneratorMock.Setup(t => t.GenerateAccessToken(It.IsAny<Guid>(), "Listener", It.IsAny<int>()))
            .Returns("new_access_token");

        // Act
        var result = await _sut.GoogleSignInAsync("valid-id-token", "127.0.0.1", "agent", CancellationToken.None);

        // Assert
        result.AccessToken.Should().Be("new_access_token");
        _userClientMock.Verify(u => u.CreateOAuthUserAsync("new@gmail.com", "New User", "https://pic.url/avatar.jpg", It.IsAny<CancellationToken>()), Times.Once);
        _refreshTokenRepoMock.Verify(r => r.AddAsync(It.IsAny<RefreshToken>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GoogleSignInAsync_InvalidToken_ThrowsUnauthorized()
    {
        // Arrange — Google verification fails
        _googleVerifierMock.Setup(g => g.VerifyAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Token signature invalid."));

        // Act
        var act = async () => await _sut.GoogleSignInAsync("bad-token", null, null, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>()
            .Where(e => e.Message.Contains("invalid") || e.ErrorCode == "UNAUTHORIZED");
    }

    [Fact]
    public async Task GoogleSignInAsync_MissingIdToken_ThrowsValidationException()
    {
        // Arrange — empty idToken
        var act = async () => await _sut.GoogleSignInAsync("", null, null, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*idToken*");
    }
}
