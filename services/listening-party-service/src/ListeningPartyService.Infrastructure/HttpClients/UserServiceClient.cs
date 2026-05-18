using System.Text.Json;
using ListeningPartyService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace ListeningPartyService.Infrastructure.HttpClients;

public class UserServiceClient(HttpClient httpClient, ILogger<UserServiceClient> logger) : IUserServiceClient
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public async Task<UserMiniProfile?> GetUserProfileAsync(string userId, CancellationToken ct = default)
    {
        try
        {
            var response = await httpClient.GetAsync($"/internal/users/{userId}/profile", ct);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync(ct);
            var dto  = JsonSerializer.Deserialize<UserMiniProfileJson>(json, JsonOpts);
            if (dto is null) return null;

            return new UserMiniProfile(dto.UserId, dto.DisplayName, dto.AvatarUrl);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to fetch user profile for userId={UserId}", userId);
            return null;
        }
    }

    private record UserMiniProfileJson(string UserId, string DisplayName, string? AvatarUrl);
}
