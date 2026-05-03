namespace UserService.Application.DTOs;

public record UpdatePreferencesRequest(
    List<string> PreferredGenres,
    List<string> PreferredLanguages,
    string AudioQuality
);
