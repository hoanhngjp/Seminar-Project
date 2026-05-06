namespace AnalyticsService.Application.Interfaces;

public interface IMusicServiceClient
{
    /// <summary>Returns artistId for the song, or null if not found.</summary>
    Task<Guid?> GetSongArtistIdAsync(Guid songId, CancellationToken ct = default);
}
