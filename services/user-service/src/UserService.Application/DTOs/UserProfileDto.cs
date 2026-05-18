namespace UserService.Application.DTOs;

public record UserMiniProfileDto(Guid UserId, string DisplayName, string? AvatarUrl);

public record UserProfileDto(
    Guid Id,
    string Email,
    string Username,
    string DisplayName,
    string Role,
    string? AvatarUrl,
    string? Bio,
    DateTime CreatedAt,
    bool HasCompletedOnboarding,
    List<string> PreferredGenres,
    List<string> PreferredArtists
);
