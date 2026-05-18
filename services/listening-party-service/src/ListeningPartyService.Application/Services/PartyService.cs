using ListeningPartyService.Application.DTOs;
using ListeningPartyService.Application.Interfaces;
using ListeningPartyService.Domain.Exceptions;
using ListeningPartyService.Domain.Models;
using Microsoft.Extensions.Logging;

namespace ListeningPartyService.Application.Services;

public class PartyService(
    IPartyRepository repository,
    IUserServiceClient userServiceClient,
    IMusicServiceClient musicServiceClient,
    ILogger<PartyService> logger) : IPartyService
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

        var hostProfile = await userServiceClient.GetUserProfileAsync(hostId, ct);
        var hostMember  = new MemberDto(
            UserId:   hostId,
            Name:     string.IsNullOrWhiteSpace(hostProfile?.DisplayName) ? "Host" : hostProfile.DisplayName,
            AvatarUrl: hostProfile?.AvatarUrl,
            IsHost:   true);

        logger.LogInformation("Party created: roomId={RoomId} joinCode={JoinCode} hostId={HostId}",
            roomId, joinCode, hostId);

        return new CreatePartyResponse(roomId, joinCode, hostId, roomName, songId ?? string.Empty, [hostMember]);
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

        var memberIds = await repository.GetMembersAsync(roomId, ct);
        var members   = await BuildMemberDtosAsync(memberIds, room.HostId, roomId, ct);

        logger.LogInformation("User {UserId} joined party roomId={RoomId}", userId, roomId);

        return new JoinPartyResponse(roomId, room.JoinCode, room.Name, room.HostId, room.SongId, room.PositionSec, members);
    }

    public async Task<PartyPreviewResponse?> GetPartyPreviewAsync(string joinCode, CancellationToken ct = default)
    {
        var roomId = await repository.GetRoomIdByJoinCodeAsync(joinCode, ct);
        if (roomId is null) return null;

        var room = await repository.GetRoomAsync(roomId, ct);
        if (room is null) return null;

        var memberIds   = await repository.GetMembersAsync(roomId, ct);
        var songTitle   = await musicServiceClient.GetSongTitleAsync(room.SongId, ct);
        var hostProfile = await userServiceClient.GetUserProfileAsync(room.HostId, ct);

        return new PartyPreviewResponse(
            RoomId:          roomId,
            Name:            room.Name,
            MemberCount:     memberIds.Count,
            CurrentSongTitle: songTitle,
            HostAvatarUrl:   hostProfile?.AvatarUrl,
            HostDisplayName: hostProfile?.DisplayName ?? "Host");
    }

    public Task StoreMemberProfileAsync(string roomId, string userId, string displayName, string? avatarUrl, CancellationToken ct = default)
        => repository.StoreMemberProfileAsync(roomId, userId, displayName, avatarUrl, ct);

    private async Task<List<MemberDto>> BuildMemberDtosAsync(ISet<string> memberIds, string hostId, string roomId, CancellationToken ct)
    {
        var tasks = memberIds.Select(async uid =>
        {
            // Try Redis profile cache first (populated by hub at connect time)
            var (cachedName, cachedAvatar) = await repository.GetMemberProfileAsync(roomId, uid, ct);
            if (cachedName is not null)
            {
                return new MemberDto(UserId: uid, Name: cachedName, AvatarUrl: cachedAvatar, IsHost: uid == hostId);
            }

            // Fallback to User Service HTTP call
            var profile = await userServiceClient.GetUserProfileAsync(uid, ct);
            var name = string.IsNullOrWhiteSpace(profile?.DisplayName) ? "Người dùng" : profile.DisplayName;
            return new MemberDto(
                UserId:   uid,
                Name:     name,
                AvatarUrl: profile?.AvatarUrl,
                IsHost:   uid == hostId);
        });

        var results = await Task.WhenAll(tasks);
        return [.. results.OrderByDescending(m => m.IsHost)];
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

    // ─── Queue operations ─────────────────────────────────────────────────────

    private const int MaxQueueSize = 50;

    public async Task<List<QueueItemDto>> GetQueueAsync(string roomId, CancellationToken ct = default)
    {
        var items = await repository.GetQueueAsync(roomId, ct);
        return items.Select(i => new QueueItemDto(i.SongId, i.AddedByUserId)).ToList();
    }

    public async Task<List<QueueItemDto>> AddToQueueAsync(string roomId, string songId, string userId, CancellationToken ct = default)
    {
        var queue = await repository.GetQueueAsync(roomId, ct);

        if (queue.Count >= MaxQueueSize)
            throw new QueueFullException(MaxQueueSize);

        queue.Add(new QueueItem { SongId = songId, AddedByUserId = userId });
        await repository.SaveQueueAsync(roomId, queue, ct);

        logger.LogDebug("User {UserId} added song {SongId} to queue in room {RoomId} (size={Size})",
            userId, songId, roomId, queue.Count);

        return queue.Select(i => new QueueItemDto(i.SongId, i.AddedByUserId)).ToList();
    }

    public async Task<List<QueueItemDto>> RemoveFromQueueAsync(string roomId, string songId, string userId, CancellationToken ct = default)
    {
        var queue = await repository.GetQueueAsync(roomId, ct);

        // Only remove the first matching item owned by this user
        var index = queue.FindIndex(i => i.SongId == songId && i.AddedByUserId == userId);
        if (index >= 0)
        {
            queue.RemoveAt(index);
            await repository.SaveQueueAsync(roomId, queue, ct);
            logger.LogDebug("User {UserId} removed song {SongId} from queue in room {RoomId}", userId, songId, roomId);
        }

        return queue.Select(i => new QueueItemDto(i.SongId, i.AddedByUserId)).ToList();
    }

    public async Task<QueueNextResult?> DequeueNextAsync(string roomId, CancellationToken ct = default)
    {
        var queue = await repository.GetQueueAsync(roomId, ct);
        if (queue.Count == 0) return null;

        var next = queue[0];
        queue.RemoveAt(0);

        await repository.UpdateRoomSongAsync(roomId, next.SongId, isPlaying: true, positionSec: 0, ct);
        await repository.SaveQueueAsync(roomId, queue, ct);

        var room = await repository.GetRoomAsync(roomId, ct)
            ?? throw new RoomNotFoundException(roomId);

        logger.LogInformation("Room {RoomId} advanced to next queued song {SongId}", roomId, next.SongId);

        return new QueueNextResult(
            room,
            queue.Select(i => new QueueItemDto(i.SongId, i.AddedByUserId)).ToList());
    }

    private static string GenerateJoinCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        return new string(Enumerable.Range(0, 6)
            .Select(_ => chars[Random.Shared.Next(chars.Length)])
            .ToArray());
    }
}
