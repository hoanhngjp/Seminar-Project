using ListeningPartyService.Application.DTOs;
using ListeningPartyService.Application.Interfaces;
using ListeningPartyService.Domain.Exceptions;
using ListeningPartyService.Domain.Models;
using Microsoft.Extensions.Logging;

namespace ListeningPartyService.Application.Services;

public class PartyService(IPartyRepository repository, ILogger<PartyService> logger) : IPartyService
{
    public async Task<CreatePartyResponse> CreatePartyAsync(string hostId, string? name, string? songId, CancellationToken ct = default)
    {
        var roomId = Guid.NewGuid().ToString();
        var joinCode = GenerateJoinCode();
        var roomName = string.IsNullOrWhiteSpace(name) ? "Listening Party" : name.Trim();

        var room = new Room
        {
            RoomId = roomId,
            Name = roomName,
            HostId = hostId,
            SongId = songId ?? string.Empty,
            IsPlaying = false,
            PositionSec = 0,
            JoinCode = joinCode
        };

        await repository.CreateAsync(room, ct);
        await repository.AddMemberAsync(roomId, hostId, ct);

        logger.LogInformation("Party created: roomId={RoomId} joinCode={JoinCode} hostId={HostId}",
            roomId, joinCode, hostId);

        return new CreatePartyResponse(roomId, joinCode, hostId, roomName);
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

    public Task<Room?> GetRoomAsync(string roomId, CancellationToken ct = default)
        => repository.GetRoomAsync(roomId, ct);

    public async Task<Room> UpdateRoomStateAsync(string roomId, bool isPlaying, int positionSec, CancellationToken ct = default)
    {
        await repository.UpdateRoomStateAsync(roomId, isPlaying, positionSec, ct);
        var room = await repository.GetRoomAsync(roomId, ct);
        if (room is null) throw new RoomNotFoundException(roomId);

        logger.LogDebug("Room {RoomId} state updated: isPlaying={IsPlaying} positionSec={Pos}",
            roomId, isPlaying, positionSec);
        return room;
    }

    public async Task<bool> HandleMemberDisconnectAsync(string roomId, string userId, CancellationToken ct = default)
    {
        await repository.RemoveMemberAsync(roomId, userId, ct);

        var room = await repository.GetRoomAsync(roomId, ct);
        if (room is null) return false; // room already cleaned up

        bool isHost = room.HostId == userId;
        if (isHost)
        {
            await repository.DeleteRoomAsync(roomId, ct);
            logger.LogInformation("Room {RoomId} deleted after host {UserId} disconnected", roomId, userId);
        }

        return isHost;
    }

    private static string GenerateJoinCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return new string(Enumerable.Range(0, 6)
            .Select(_ => chars[Random.Shared.Next(chars.Length)])
            .ToArray());
    }
}
