using ListeningPartyService.Application.DTOs;
using ListeningPartyService.Application.Interfaces;
using ListeningPartyService.Application.Services;
using ListeningPartyService.Domain.Exceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ListeningPartyService.Api.Hubs;

[Authorize]
public class PartyHub(
    IPartyService partyService,
    IUserServiceClient userServiceClient,
    ILogger<PartyHub> logger) : Hub
{
    // Virtual — overridable in unit tests to avoid HttpContext dependency
    protected virtual string GetRoomId() =>
        Context.GetHttpContext()?.Request.Query["roomId"].ToString() ?? string.Empty;

    protected virtual string GetUserId() =>
        Context.UserIdentifier ?? string.Empty;

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    public override async Task OnConnectedAsync()
    {
        var roomId = GetRoomId();
        var userId = GetUserId();

        var room = await partyService.GetRoomAsync(roomId);
        if (room is null)
        {
            // Room expired or never existed — abort immediately
            await Clients.Caller.SendAsync("ROOM_CLOSED", new RoomClosedMessage("host_disconnected"));
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

        // AC7.3.1: Send current playback state to the connecting client
        await Clients.Caller.SendAsync("SYNC_STATE", new SyncStateMessage(
            room.SongId,
            room.IsPlaying,
            room.PositionSec,
            room.HostId,
            DateTime.UtcNow.ToString("O")));

        // Read display name + avatar from query params (set by FE at connect time)
        var query       = Context.GetHttpContext()?.Request.Query;
        var displayName = query?["displayName"].ToString();
        var avatarUrl   = query?["avatarUrl"].ToString();

        // Fallback to User Service if FE didn't pass name or name is empty
        if (string.IsNullOrWhiteSpace(displayName))
        {
            var profile = await userServiceClient.GetUserProfileAsync(userId);
            displayName = string.IsNullOrWhiteSpace(profile?.DisplayName) ? "Người dùng" : profile.DisplayName;
            avatarUrl   = profile?.AvatarUrl;
        }

        // Cache in Redis so BuildMemberDtosAsync can read without HTTP call
        await partyService.StoreMemberProfileAsync(roomId, userId, displayName, avatarUrl);

        await Clients.OthersInGroup(roomId).SendAsync("MEMBER_JOIN", new MemberJoinMessage(
            userId,
            displayName,
            avatarUrl,
            DateTime.UtcNow.ToString("O")));

        logger.LogInformation("User {UserId} connected to room {RoomId} (connId={ConnId})",
            userId, roomId, Context.ConnectionId);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var roomId = GetRoomId();
        var userId = GetUserId();

        var isHostDisconnected = await partyService.HandleMemberDisconnectAsync(roomId, userId);

        if (isHostDisconnected)
        {
            // Phase 1: Host leaves → room terminates. Host re-election is Phase 2.
            logger.LogWarning("Host {UserId} disconnected from room {RoomId} — room terminating", userId, roomId);
            await Clients.Group(roomId).SendAsync("ROOM_CLOSED",
                new RoomClosedMessage("host_disconnected"));
        }
        else
        {
            await Clients.OthersInGroup(roomId).SendAsync("MEMBER_LEAVE",
                new MemberLeaveMessage(userId, "voluntary"));
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);

        logger.LogInformation("User {UserId} disconnected from room {RoomId}", userId, roomId);

        await base.OnDisconnectedAsync(exception);
    }

    // ─── Client → Server ──────────────────────────────────────────────────────

    /// <summary>
    /// PLAYER_ACTION — only Host may call. Members are silently ignored (AC7.2.2).
    /// On valid Host call: update Redis state + broadcast SYNC_STATE to all (AC7.2.1).
    /// </summary>
    public async Task PlayerAction(PlayerActionMessage message)
    {
        var roomId = GetRoomId();
        var userId = GetUserId();

        var room = await partyService.GetRoomAsync(roomId);
        if (room is null)
        {
            logger.LogWarning("PlayerAction received for non-existent room {RoomId} from {UserId}", roomId, userId);
            return;
        }

        if (room.HostId != userId)
        {
            // AC7.2.2: Member sends PLAYER_ACTION → silently ignore, log warning
            logger.LogWarning("Non-host {UserId} attempted PlayerAction in room {RoomId} — ignored", userId, roomId);
            return;
        }

        var isPlaying = message.Action switch
        {
            "PLAY"  => true,
            "PAUSE" => false,
            _       => room.IsPlaying, // SEEK preserves current play/pause state
        };
        var positionSec = (int)(message.PositionSec ?? room.PositionSec);

        var updatedRoom = await partyService.UpdateRoomStateAsync(roomId, isPlaying, positionSec);

        // AC7.2.1: Broadcast SYNC_STATE to ALL members in the room (including Host)
        await Clients.Group(roomId).SendAsync("SYNC_STATE", new SyncStateMessage(
            updatedRoom.SongId,
            updatedRoom.IsPlaying,
            updatedRoom.PositionSec,
            updatedRoom.HostId,
            DateTime.UtcNow.ToString("O")));

        logger.LogDebug("Room {RoomId} SYNC_STATE broadcast: action={Action} isPlaying={IsPlaying} pos={Pos}",
            roomId, message.Action, isPlaying, positionSec);
    }

    // ─── Queue Hub methods ────────────────────────────────────────────────────

    /// <summary>
    /// QUEUE_ADD — any authenticated member may add a song; max 50 items per room.
    /// Broadcasts QUEUE_UPDATED to all room members on success.
    /// Sends QUEUE_ERROR back to caller if queue is full.
    /// </summary>
    public async Task QueueAdd(QueueAddMessage message)
    {
        var roomId = GetRoomId();
        var userId = GetUserId();

        if (string.IsNullOrWhiteSpace(message.SongId)) return;

        try
        {
            var updatedQueue = await partyService.AddToQueueAsync(roomId, message.SongId, userId);
            await Clients.Group(roomId).SendAsync("QUEUE_UPDATED", new QueueUpdatedMessage(updatedQueue));

            logger.LogDebug("QUEUE_ADD: user={UserId} song={SongId} room={RoomId}", userId, message.SongId, roomId);
        }
        catch (QueueFullException ex)
        {
            await Clients.Caller.SendAsync("QUEUE_ERROR", ex.Message);
        }
    }

    /// <summary>
    /// QUEUE_REMOVE — only the member who added the song may remove it.
    /// Silently ignores if song not found or not owned by caller.
    /// Broadcasts QUEUE_UPDATED to all room members.
    /// </summary>
    public async Task QueueRemove(QueueRemoveMessage message)
    {
        var roomId = GetRoomId();
        var userId = GetUserId();

        if (string.IsNullOrWhiteSpace(message.SongId)) return;

        var updatedQueue = await partyService.RemoveFromQueueAsync(roomId, message.SongId, userId);
        await Clients.Group(roomId).SendAsync("QUEUE_UPDATED", new QueueUpdatedMessage(updatedQueue));

        logger.LogDebug("QUEUE_REMOVE: user={UserId} song={SongId} room={RoomId}", userId, message.SongId, roomId);
    }

    /// <summary>
    /// QUEUE_NEXT — Host only. Dequeues the next song, updates room playback state,
    /// and broadcasts SYNC_STATE + QUEUE_UPDATED to all room members.
    /// If queue is empty, broadcasts QUEUE_UPDATED with an empty list (no playback change).
    /// </summary>
    public async Task QueueNext(QueueNextMessage message)
    {
        var roomId = GetRoomId();
        var userId = GetUserId();

        var room = await partyService.GetRoomAsync(roomId);
        if (room is null) return;

        if (room.HostId != userId)
        {
            logger.LogWarning("Non-host {UserId} attempted QueueNext in room {RoomId} — ignored", userId, roomId);
            return;
        }

        var result = await partyService.DequeueNextAsync(roomId);
        if (result is null)
        {
            // Queue empty — inform all members
            await Clients.Group(roomId).SendAsync("QUEUE_UPDATED", new QueueUpdatedMessage([]));
            return;
        }

        await Clients.Group(roomId).SendAsync("SYNC_STATE", new SyncStateMessage(
            result.UpdatedRoom.SongId,
            result.UpdatedRoom.IsPlaying,
            result.UpdatedRoom.PositionSec,
            result.UpdatedRoom.HostId,
            DateTime.UtcNow.ToString("O")));

        await Clients.Group(roomId).SendAsync("QUEUE_UPDATED", new QueueUpdatedMessage(result.UpdatedQueue));

        logger.LogInformation("QUEUE_NEXT: room={RoomId} advanced to song={SongId}", roomId, result.UpdatedRoom.SongId);
    }
}
