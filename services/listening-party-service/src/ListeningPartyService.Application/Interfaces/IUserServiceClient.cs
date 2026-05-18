namespace ListeningPartyService.Application.Interfaces;

public record UserMiniProfile(string UserId, string DisplayName, string? AvatarUrl);

public interface IUserServiceClient
{
    Task<UserMiniProfile?> GetUserProfileAsync(string userId, CancellationToken ct = default);
}
