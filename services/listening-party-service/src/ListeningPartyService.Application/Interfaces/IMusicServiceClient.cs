namespace ListeningPartyService.Application.Interfaces;

public interface IMusicServiceClient
{
    Task<string?> GetSongTitleAsync(string songId, CancellationToken ct = default);
}
