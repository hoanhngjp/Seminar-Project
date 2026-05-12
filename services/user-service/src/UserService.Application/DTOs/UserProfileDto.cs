namespace UserService.Application.DTOs;

public record UserProfileDto(
    Guid Id,
    string Email,
    string Username,
    string DisplayName,
    string Role,
    string? AvatarUrl,
    string? Bio,
    DateTime CreatedAt,
    bool HasCompletedOnboarding
);
