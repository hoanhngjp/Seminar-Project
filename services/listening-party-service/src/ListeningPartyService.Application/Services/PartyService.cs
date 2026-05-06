using ListeningPartyService.Application.DTOs;
using ListeningPartyService.Application.Interfaces;
using ListeningPartyService.Domain.Exceptions;
using ListeningPartyService.Domain.Models;
using Microsoft.Extensions.Logging;

namespace ListeningPartyService.Application.Services;

public class PartyService(IPartyRepository repository, ILogger<PartyService> logger) : IPartyService
{
    public async Task<CreatePartyResponse> CreatePartyAsync(string hostId, string songId, CancellationToken ct = default)
    {
        var roomId = Guid.NewGuid().ToString();
        var joinCode = GenerateJoinCode();

        var room = new Room
        {
            RoomId = roomId,
            HostId = hostId,
            SongId = songId,
            IsPlaying = false,
            PositionSec = 0,
            JoinCode = joinCode
        };

        await repository.CreateAsync(room, ct);
        await repository.AddMemberAsync(roomId, hostId, ct);

        logger.LogInformation("Party created: roomId={RoomId} joinCode={JoinCode} hostId={HostId}",
            roomId, joinCode, hostId);

        return new CreatePartyResponse(roomId, joinCode, hostId);
    }

    public async Task<JoinPartyResponse> JoinPartyAsync(string joinCode, string userId, CancellationToken ct = default)
    {
        var roomId = await repository.GetRoomIdByJoinCodeAsync(joinCode, ct);
        if (roomId is null)
            throw new RoomNotFoundException(joinCode);

        var room = await repository.GetRoomAsync(roomId, ct);
        if (room is null)
            throw new RoomNotFoundException(joinCode);

        await repository.AddMemberAsync(roomId, userId, ct);

        logger.LogInformation("User {UserId} joined party roomId={RoomId}", userId, roomId);

        return new JoinPartyResponse(roomId, room.HostId, room.SongId, room.PositionSec);
    }

    private static string GenerateJoinCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return new string(Enumerable.Range(0, 6)
            .Select(_ => chars[Random.Shared.Next(chars.Length)])
            .ToArray());
    }
}
