using System.Text.Json;
using AnalyticsService.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace AnalyticsService.Infrastructure.Http;

public class MusicServiceClient(HttpClient httpClient, ILogger<MusicServiceClient> logger)
    : IMusicServiceClient
{
    public async Task<Guid?> GetSongArtistIdAsync(Guid songId, CancellationToken ct = default)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromMilliseconds(150)); // timeout budget for internal call

            var response = await httpClient.GetAsync($"internal/songs/{songId}", cts.Token);
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound) return null;

            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(cts.Token);
            var doc = JsonDocument.Parse(json);

            if (doc.RootElement.TryGetProperty("artistId", out var artistIdEl)
                && artistIdEl.TryGetGuid(out var artistId))
            {
                return artistId;
            }

            return null;
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("Music Service call timed out for song {SongId}.", songId);
            return null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Music Service call failed for song {SongId}.", songId);
            return null;
        }
    }
}
