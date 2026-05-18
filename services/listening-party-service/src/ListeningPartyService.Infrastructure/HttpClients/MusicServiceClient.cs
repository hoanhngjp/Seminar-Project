using System.Text.Json;
using ListeningPartyService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace ListeningPartyService.Infrastructure.HttpClients;

public class MusicServiceClient(HttpClient httpClient, ILogger<MusicServiceClient> logger) : IMusicServiceClient
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public async Task<string?> GetSongTitleAsync(string songId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(songId)) return null;
        try
        {
            var response = await httpClient.GetAsync($"/internal/songs/{songId}", ct);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync(ct);
            var dto  = JsonSerializer.Deserialize<SongMetaJson>(json, JsonOpts);
            return dto?.Title;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to fetch song title for songId={SongId}", songId);
            return null;
        }
    }

    private record SongMetaJson(string Id, string Title, string? ArtistId);
}
