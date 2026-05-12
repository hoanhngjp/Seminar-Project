namespace UserService.Application.DTOs;

public record UpdatePreferencesRequest(
    List<string> PreferredGenres,
    List<string> PreferredArtists,
    string AudioQuality
);
