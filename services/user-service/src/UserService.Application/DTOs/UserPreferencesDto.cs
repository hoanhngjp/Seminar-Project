namespace UserService.Application.DTOs;

public record UserPreferencesDto(
    List<string> PreferredGenres,
    List<string> PreferredArtists,
    string AudioQuality
);
