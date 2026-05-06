using ListeningPartyService.Application.DTOs;

namespace ListeningPartyService.Application.Services;

public interface IPartyService
{
    Task<CreatePartyResponse> CreatePartyAsync(string hostId, string songId, CancellationToken ct = default);
    Task<JoinPartyResponse> JoinPartyAsync(string joinCode, string userId, CancellationToken ct = default);
}
