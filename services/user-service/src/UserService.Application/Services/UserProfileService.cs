using Microsoft.Extensions.Logging;
using UserService.Application.DTOs;
using UserService.Application.Events;
using UserService.Application.Interfaces;
using UserService.Domain.Exceptions;
using UserService.Domain.Models;

namespace UserService.Application.Services;

public class UserProfileService(
    IUserRepository userRepo,
    IUserPreferencesRepository prefsRepo,
    IRedisCache cache,
    IKafkaProducer kafka,
    ILogger<UserProfileService> logger) : IUserService
{
    private static readonly TimeSpan ProfileCacheTtl = TimeSpan.FromSeconds(900); // 15 min

    public async Task<(UserProfileDto Profile, bool CacheHit)> GetMyProfileAsync(Guid userId, CancellationToken ct)
    {
        var cacheKey = $"user:profile:{userId}";
        var cached = await cache.GetAsync<UserProfileDto>(cacheKey, ct);
        if (cached is not null)
        {
            logger.LogInformation("Profile cache HIT. UserId={UserId}", userId);
            return (cached, true);
        }

        var user = await userRepo.GetByIdAsync(userId, ct)
            ?? throw new NotFoundException("User");

        var prefs = await prefsRepo.GetByUserIdAsync(userId, ct);
        var hasCompletedOnboarding = prefs != null && prefs.PreferredGenres.Count >= 3;

        var dto = MapToDto(user, hasCompletedOnboarding);
        await cache.SetAsync(cacheKey, dto, ProfileCacheTtl, ct);
        logger.LogInformation("Profile cache MISS — loaded from DB. UserId={UserId}", userId);
        return (dto, false);
    }

    public async Task UpdatePreferencesAsync(Guid userId, UpdatePreferencesRequest request, string correlationId, CancellationToken ct)
    {
        var validQualities = new HashSet<string> { "low", "standard", "high", "lossless" };
        if (!validQualities.Contains(request.AudioQuality))
            throw new ValidationException($"audioQuality must be one of: {string.Join(", ", validQualities)}");

        if (request.PreferredGenres.Count > 50)
            throw new ValidationException("preferredGenres cannot exceed 50 items.");

        var user = await userRepo.GetByIdAsync(userId, ct)
            ?? throw new NotFoundException("User");

        var existing = await prefsRepo.GetByUserIdAsync(userId, ct);
        if (existing is null)
        {
            existing = new UserPreferences
            {
                Id = Guid.NewGuid(),
                UserId = userId,
            };
        }

        // Parse genre strings as Guids where possible; ignore invalid values
        var genreIds = request.PreferredGenres
            .Select(g => Guid.TryParse(g, out var id) ? id : (Guid?)null)
            .Where(g => g.HasValue)
            .Select(g => g!.Value)
            .ToList();

        existing.PreferredGenres = genreIds;
        existing.PreferredArtists = request.PreferredArtists;
        existing.AudioQuality = request.AudioQuality;
        existing.UpdatedAt = DateTime.UtcNow;

        await prefsRepo.UpsertAsync(existing, ct);

        // Invalidate profile cache
        await cache.DeleteAsync($"user:profile:{userId}");

        // Publish Kafka event
        var @event = new UserPreferencesUpdatedEvent(
            EventId: Guid.NewGuid().ToString(),
            Version: "v1",
            Timestamp: DateTime.UtcNow.ToString("O"),
            CorrelationId: correlationId,
            UserId: userId.ToString(),
            PreferredGenres: request.PreferredGenres,
            PreferredArtists: request.PreferredArtists,
            AudioQuality: request.AudioQuality
        );
        await kafka.PublishAsync("User_Preferences_Updated", @event, ct);
        logger.LogInformation("Preferences updated and event published. UserId={UserId}", userId);
    }

    public async Task<UserPreferencesDto?> GetPreferencesByUserIdAsync(Guid userId, CancellationToken ct)
    {
        var prefs = await prefsRepo.GetByUserIdAsync(userId, ct);
        if (prefs is null) return null;
        return new UserPreferencesDto(
            prefs.PreferredGenres.Select(g => g.ToString()).ToList(),
            prefs.PreferredArtists,
            prefs.AudioQuality
        );
    }

    public async Task<VerifyCredentialsResult?> VerifyCredentialsAsync(VerifyCredentialsRequest request, CancellationToken ct)
    {
        var user = await userRepo.GetByEmailAsync(request.Email, ct);
        if (user is null) return null;
        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash)) return null;
        return new VerifyCredentialsResult(user.Id, user.Role, user.IsActive, user.DisplayName);
    }

    public Task<(IReadOnlyList<Guid> FollowerIds, string? NextCursor)> GetArtistFollowersAsync(
        Guid artistId, int limit, string? cursor, CancellationToken ct)
        => userRepo.GetFollowerIdsAsync(artistId, limit, cursor, ct);

    private static UserProfileDto MapToDto(User u, bool hasCompletedOnboarding) => new(
        u.Id, u.Email, u.Username, u.DisplayName, u.Role, u.AvatarUrl, u.Bio, u.CreatedAt, hasCompletedOnboarding);
}
