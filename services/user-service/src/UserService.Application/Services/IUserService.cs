using UserService.Application.DTOs;

namespace UserService.Application.Services;

public interface IUserService
{
    Task<(UserProfileDto Profile, bool CacheHit)> GetMyProfileAsync(Guid userId, CancellationToken ct);
    Task UpdatePreferencesAsync(Guid userId, UpdatePreferencesRequest request, string correlationId, CancellationToken ct);
    Task<UserPreferencesDto?> GetPreferencesByUserIdAsync(Guid userId, CancellationToken ct);
    Task<VerifyCredentialsResult?> VerifyCredentialsAsync(VerifyCredentialsRequest request, CancellationToken ct);

    Task<(IReadOnlyList<Guid> FollowerIds, string? NextCursor)> GetArtistFollowersAsync(
        Guid artistId, int limit, string? cursor, CancellationToken ct);
}
