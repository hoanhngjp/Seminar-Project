using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using UserService.Application.DTOs;
using UserService.Application.Events;
using UserService.Application.Interfaces;
using UserService.Application.Services;
using UserService.Domain.Exceptions;
using UserService.Domain.Models;

namespace UserService.UnitTests;

public class UserProfileServiceTests
{
    private readonly Mock<IUserRepository> _userRepoMock = new();
    private readonly Mock<IUserPreferencesRepository> _prefsRepoMock = new();
    private readonly Mock<IRedisCache> _cacheMock = new();
    private readonly Mock<IKafkaProducer> _kafkaMock = new();
    private readonly UserProfileService _sut;

    public UserProfileServiceTests()
    {
        _sut = new UserProfileService(
            _userRepoMock.Object,
            _prefsRepoMock.Object,
            _cacheMock.Object,
            _kafkaMock.Object,
            NullLogger<UserProfileService>.Instance);
    }

    // -------------------------------------------------------------------------
    // GetMyProfileAsync
    // -------------------------------------------------------------------------

    [Fact]
    public async Task GetMyProfileAsync_WhenCacheHit_ReturnsCachedProfile_AndSkipsRepo()
    {
        // AC1.2.3: cache-aside — Redis HIT → skip PostgreSQL
        var userId = Guid.NewGuid();
        var cached = new UserProfileDto(userId, "test@example.com", "test", "Test User", "Listener", null, null, DateTime.UtcNow, false);
        _cacheMock.Setup(c => c.GetAsync<UserProfileDto>($"user:profile:{userId}", It.IsAny<CancellationToken>()))
            .ReturnsAsync(cached);

        var (profile, cacheHit) = await _sut.GetMyProfileAsync(userId, CancellationToken.None);

        cacheHit.Should().BeTrue();
        profile.Should().BeEquivalentTo(cached);
        _userRepoMock.Verify(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetMyProfileAsync_WhenCacheMiss_LoadsFromDb_AndCachesResult()
    {
        // cache MISS → DB lookup → write to cache
        var userId = Guid.NewGuid();
        var user = MakeUser(userId);
        _cacheMock.Setup(c => c.GetAsync<UserProfileDto>(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserProfileDto?)null);
        _userRepoMock.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var (profile, cacheHit) = await _sut.GetMyProfileAsync(userId, CancellationToken.None);

        cacheHit.Should().BeFalse();
        profile.Id.Should().Be(userId);
        _cacheMock.Verify(c => c.SetAsync(
            $"user:profile:{userId}",
            It.IsAny<UserProfileDto>(),
            TimeSpan.FromSeconds(900),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetMyProfileAsync_WhenUserNotFound_ThrowsNotFoundException()
    {
        // 404 USER_NOT_FOUND
        var userId = Guid.NewGuid();
        _cacheMock.Setup(c => c.GetAsync<UserProfileDto>(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserProfileDto?)null);
        _userRepoMock.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        var act = () => _sut.GetMyProfileAsync(userId, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*User*");
    }

    // -------------------------------------------------------------------------
    // UpdatePreferencesAsync
    // -------------------------------------------------------------------------

    [Fact]
    public async Task UpdatePreferencesAsync_WithValidRequest_UpsertsPref_AndPublishesKafka()
    {
        // AC1.2.2: POST /preferences → Kafka User_Preferences_Updated published
        var userId = Guid.NewGuid();
        _userRepoMock.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeUser(userId));
        _prefsRepoMock.Setup(p => p.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserPreferences?)null);

        var request = new UpdatePreferencesRequest(["genre-id-1"], ["vi", "en"], "high");
        await _sut.UpdatePreferencesAsync(userId, request, "corr-id", CancellationToken.None);

        _prefsRepoMock.Verify(p => p.UpsertAsync(It.IsAny<UserPreferences>(), It.IsAny<CancellationToken>()), Times.Once);
        _kafkaMock.Verify(k => k.PublishAsync(
            "User_Preferences_Updated",
            It.Is<UserPreferencesUpdatedEvent>(e => e.UserId == userId.ToString() && e.AudioQuality == "high"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdatePreferencesAsync_WithInvalidAudioQuality_ThrowsValidationException()
    {
        // 400 VALIDATION_ERROR
        var userId = Guid.NewGuid();
        _userRepoMock.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeUser(userId));

        var request = new UpdatePreferencesRequest([], [], "ultra-hd");
        var act = () => _sut.UpdatePreferencesAsync(userId, request, "corr-id", CancellationToken.None);

        await act.Should().ThrowAsync<ValidationException>();
    }

    [Fact]
    public async Task UpdatePreferencesAsync_WithExistingPreferences_UpdatesExistingRow()
    {
        // AC1.2.3: idempotent — existing prefs row updated, not duplicated
        var userId = Guid.NewGuid();
        var existingPrefs = new UserPreferences { Id = Guid.NewGuid(), UserId = userId, AudioQuality = "standard" };
        _userRepoMock.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeUser(userId));
        _prefsRepoMock.Setup(p => p.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingPrefs);

        var request = new UpdatePreferencesRequest([], ["en"], "lossless");
        await _sut.UpdatePreferencesAsync(userId, request, "corr-id", CancellationToken.None);

        _prefsRepoMock.Verify(p => p.UpsertAsync(
            It.Is<UserPreferences>(p => p.Id == existingPrefs.Id && p.AudioQuality == "lossless"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdatePreferencesAsync_InvalidatesProfileCache()
    {
        // cache invalidated on write
        var userId = Guid.NewGuid();
        _userRepoMock.Setup(r => r.GetByIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeUser(userId));
        _prefsRepoMock.Setup(p => p.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserPreferences?)null);

        await _sut.UpdatePreferencesAsync(userId, new UpdatePreferencesRequest([], [], "standard"), "cid", CancellationToken.None);

        _cacheMock.Verify(c => c.DeleteAsync($"user:profile:{userId}"), Times.Once);
    }

    // -------------------------------------------------------------------------
    // VerifyCredentialsAsync
    // -------------------------------------------------------------------------

    [Fact]
    public async Task VerifyCredentialsAsync_WithValidCredentials_ReturnsResult()
    {
        var userId = Guid.NewGuid();
        var hash = BCrypt.Net.BCrypt.HashPassword("Test1234!");
        var user = MakeUser(userId, passwordHash: hash);
        _userRepoMock.Setup(r => r.GetByEmailAsync("test@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var result = await _sut.VerifyCredentialsAsync(
            new VerifyCredentialsRequest("test@example.com", "Test1234!"), CancellationToken.None);

        result.Should().NotBeNull();
        result!.UserId.Should().Be(userId);
        result.Role.Should().Be("Listener");
    }

    [Fact]
    public async Task VerifyCredentialsAsync_WithWrongPassword_ReturnsNull()
    {
        var userId = Guid.NewGuid();
        var hash = BCrypt.Net.BCrypt.HashPassword("CorrectPassword");
        var user = MakeUser(userId, passwordHash: hash);
        _userRepoMock.Setup(r => r.GetByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var result = await _sut.VerifyCredentialsAsync(
            new VerifyCredentialsRequest("test@example.com", "WrongPassword"), CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyCredentialsAsync_WithUnknownEmail_ReturnsNull()
    {
        _userRepoMock.Setup(r => r.GetByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        var result = await _sut.VerifyCredentialsAsync(
            new VerifyCredentialsRequest("nobody@example.com", "pass"), CancellationToken.None);

        result.Should().BeNull();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static User MakeUser(Guid id, string passwordHash = "hash") => new()
    {
        Id = id,
        Email = "test@example.com",
        Username = "testuser",
        DisplayName = "Test User",
        PasswordHash = passwordHash,
        Role = "Listener",
        IsActive = true,
        CreatedAt = DateTime.UtcNow
    };
}
