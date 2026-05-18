using FluentAssertions;
using ListeningPartyService.Api.Hubs;
using ListeningPartyService.Application.DTOs;
using ListeningPartyService.Application.Interfaces;
using ListeningPartyService.Application.Services;
using ListeningPartyService.Domain.Exceptions;
using ListeningPartyService.Domain.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ListeningPartyService.IntegrationTests;

/// <summary>
/// Unit tests for PartyHub using TestablePartyHub (overrides GetRoomId/GetUserId).
/// In SignalR 8: Clients.Caller → ISingleClientProxy; Clients.Group/OthersInGroup → IClientProxy.
/// </summary>
public class PartyHubUnitTests
{
    private readonly Mock<IPartyService>      _serviceMock    = new();
    private readonly Mock<IUserServiceClient> _userClientMock = new();

    // ─── Testable subclass (avoids HttpContext and ClaimsPrincipal mocking) ───

    private sealed class TestablePartyHub(
        IPartyService service,
        IUserServiceClient userClient,
        string roomId,
        string userId) : PartyHub(service, userClient, NullLogger<PartyHub>.Instance)
    {
        protected override string GetRoomId() => roomId;
        protected override string GetUserId() => userId;
    }

    private record HubMocks(
        Mock<IHubCallerClients> Clients,
        Mock<ISingleClientProxy> Caller,
        Mock<IClientProxy> GroupProxy,
        Mock<IClientProxy> OthersProxy,
        Mock<IGroupManager> Groups,
        Mock<HubCallerContext> Context);

    private TestablePartyHub BuildHub(string roomId, string userId, HubMocks? mocks = null)
    {
        mocks ??= BuildMocks(roomId);

        var hub = new TestablePartyHub(_serviceMock.Object, _userClientMock.Object, roomId, userId);
        hub.Clients = mocks.Clients.Object;
        hub.Groups  = mocks.Groups.Object;
        hub.Context = mocks.Context.Object;
        return hub;
    }

    private static HubMocks BuildMocks(string roomId)
    {
        var caller = new Mock<ISingleClientProxy>();
        var group  = new Mock<IClientProxy>();
        var others = new Mock<IClientProxy>();

        var clients = new Mock<IHubCallerClients>();
        clients.Setup(c => c.Caller).Returns(caller.Object);
        clients.Setup(c => c.Group(roomId)).Returns(group.Object);
        clients.Setup(c => c.Group(It.IsAny<string>())).Returns(group.Object);
        clients.Setup(c => c.OthersInGroup(roomId)).Returns(others.Object);
        clients.Setup(c => c.OthersInGroup(It.IsAny<string>())).Returns(others.Object);

        var groups = new Mock<IGroupManager>();
        groups.Setup(g => g.AddToGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);
        groups.Setup(g => g.RemoveFromGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var ctx = new Mock<HubCallerContext>();
        ctx.Setup(c => c.ConnectionId).Returns("conn-test-1");

        return new HubMocks(clients, caller, group, others, groups, ctx);
    }

    private static Room MakeRoom(string roomId, string hostId, string songId = "song-1",
        bool isPlaying = false, int positionSec = 0, DateTime? lastUpdatedAt = null)
        => new()
        {
            RoomId        = roomId,
            HostId        = hostId,
            SongId        = songId,
            IsPlaying     = isPlaying,
            PositionSec   = positionSec,
            LastUpdatedAt = lastUpdatedAt ?? DateTime.UtcNow,
        };

    // ─── PlayerAction — authorization ─────────────────────────────────────────

    [Fact]
    public async Task PlayerAction_ByHost_UpdatesStateAndBroadcastsSyncState_AC7_2_1()
    {
        // AC7.2.1: Host PlayerAction → UpdateRoomStateAsync called + SYNC_STATE broadcast to group
        var roomId = Guid.NewGuid().ToString();
        var hostId = Guid.NewGuid().ToString();
        var room        = MakeRoom(roomId, hostId, isPlaying: false);
        var updatedRoom = MakeRoom(roomId, hostId, isPlaying: true);

        _serviceMock.Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>())).ReturnsAsync(room);
        _serviceMock.Setup(s => s.UpdateRoomStateAsync(roomId, true, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(updatedRoom);

        var mocks = BuildMocks(roomId);
        var hub   = BuildHub(roomId, hostId, mocks);

        await hub.PlayerAction(new PlayerActionMessage(Guid.NewGuid().ToString(), "PLAY", null, null, DateTime.UtcNow.ToString("O")));

        _serviceMock.Verify(s => s.UpdateRoomStateAsync(roomId, true, 0, It.IsAny<CancellationToken>()), Times.Once);
        mocks.GroupProxy.Verify(p => p.SendCoreAsync("SYNC_STATE", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PlayerAction_ByMember_IsIgnoredNoBroadcast_AC7_2_2()
    {
        // AC7.2.2: Member PlayerAction → no update, no SYNC_STATE broadcast
        var roomId   = Guid.NewGuid().ToString();
        var hostId   = Guid.NewGuid().ToString();
        var memberId = Guid.NewGuid().ToString();
        var room     = MakeRoom(roomId, hostId);

        _serviceMock.Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>())).ReturnsAsync(room);

        var mocks = BuildMocks(roomId);
        var hub   = BuildHub(roomId, memberId, mocks); // userId = memberId, NOT host

        await hub.PlayerAction(new PlayerActionMessage(Guid.NewGuid().ToString(), "PLAY", null, null, DateTime.UtcNow.ToString("O")));

        _serviceMock.Verify(s => s.UpdateRoomStateAsync(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
        mocks.GroupProxy.Verify(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Never);
        mocks.OthersProxy.Verify(p => p.SendCoreAsync(It.IsAny<string>(), It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task PlayerAction_RoomNotFound_ReturnsWithoutAction()
    {
        var roomId = Guid.NewGuid().ToString();
        _serviceMock.Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>())).ReturnsAsync((Room?)null);

        var mocks = BuildMocks(roomId);
        var hub   = BuildHub(roomId, "any-user", mocks);

        await hub.PlayerAction(new PlayerActionMessage(Guid.NewGuid().ToString(), "PLAY", null, null, DateTime.UtcNow.ToString("O")));

        _serviceMock.Verify(s => s.UpdateRoomStateAsync(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── PlayerAction — action → isPlaying mapping ────────────────────────────

    [Theory]
    [InlineData("PLAY",  true)]
    [InlineData("PAUSE", false)]
    public async Task PlayerAction_PlayOrPause_SetsIsPlayingCorrectly(string action, bool expectedIsPlaying)
    {
        var roomId = Guid.NewGuid().ToString();
        var hostId = Guid.NewGuid().ToString();
        var room   = MakeRoom(roomId, hostId, isPlaying: !expectedIsPlaying, positionSec: 30);

        bool? capturedIsPlaying = null;
        _serviceMock.Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>())).ReturnsAsync(room);
        _serviceMock.Setup(s => s.UpdateRoomStateAsync(roomId, It.IsAny<bool>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Callback<string, bool, int, CancellationToken>((_, ip, _, _) => capturedIsPlaying = ip)
            .ReturnsAsync(MakeRoom(roomId, hostId, isPlaying: expectedIsPlaying, positionSec: 30));

        var hub = BuildHub(roomId, hostId);
        await hub.PlayerAction(new PlayerActionMessage(Guid.NewGuid().ToString(), action, null, null, DateTime.UtcNow.ToString("O")));

        capturedIsPlaying.Should().Be(expectedIsPlaying);
    }

    [Fact]
    public async Task PlayerAction_SeekAction_PreservesIsPlayingAndUpdatesPosition()
    {
        // SEEK must not change isPlaying — only update positionSec
        var roomId = Guid.NewGuid().ToString();
        var hostId = Guid.NewGuid().ToString();
        var room   = MakeRoom(roomId, hostId, isPlaying: true, positionSec: 0);

        bool? capturedIsPlaying = null;
        int? capturedPosition   = null;
        _serviceMock.Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>())).ReturnsAsync(room);
        _serviceMock.Setup(s => s.UpdateRoomStateAsync(roomId, It.IsAny<bool>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Callback<string, bool, int, CancellationToken>((_, ip, pos, _) => { capturedIsPlaying = ip; capturedPosition = pos; })
            .ReturnsAsync(MakeRoom(roomId, hostId, isPlaying: true, positionSec: 90));

        var hub = BuildHub(roomId, hostId);
        await hub.PlayerAction(new PlayerActionMessage(Guid.NewGuid().ToString(), "SEEK", null, 90.0, DateTime.UtcNow.ToString("O")));

        capturedIsPlaying.Should().BeTrue("SEEK must preserve current isPlaying=true");
        capturedPosition.Should().Be(90);
    }

    // ─── OnConnectedAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task OnConnectedAsync_ValidRoom_SendsSyncStateToCallerAndJoinToOthers_AC7_3_1()
    {
        // AC7.3.1: On connect, caller receives SYNC_STATE; others receive MEMBER_JOIN
        var roomId = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid().ToString();
        var room   = MakeRoom(roomId, "host-x", isPlaying: true, positionSec: 42);

        _serviceMock.Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>())).ReturnsAsync(room);
        _serviceMock.Setup(s => s.StoreMemberProfileAsync(roomId, userId, It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _userClientMock.Setup(u => u.GetUserProfileAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserMiniProfile(userId, "Test User", null));

        var mocks = BuildMocks(roomId);
        var hub   = BuildHub(roomId, userId, mocks);

        await hub.OnConnectedAsync();

        mocks.Caller.Verify(p => p.SendCoreAsync("SYNC_STATE", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
        mocks.OthersProxy.Verify(p => p.SendCoreAsync("MEMBER_JOIN", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
        mocks.Groups.Verify(g => g.AddToGroupAsync("conn-test-1", roomId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task OnConnectedAsync_IsPlaying_AdjustsPositionSecForElapsedTime()
    {
        // Late-join: when isPlaying=true and 5s have elapsed since lastUpdatedAt,
        // the SYNC_STATE sent to caller must have positionSec ≥ room.PositionSec + 5.
        var roomId = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid().ToString();
        var room   = MakeRoom(roomId, "host-x", isPlaying: true, positionSec: 100,
                              lastUpdatedAt: DateTime.UtcNow.AddSeconds(-5));

        _serviceMock.Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>())).ReturnsAsync(room);
        _serviceMock.Setup(s => s.StoreMemberProfileAsync(roomId, userId, It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _userClientMock.Setup(u => u.GetUserProfileAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserMiniProfile(userId, "Test User", null));

        object?[]? capturedArgs = null;
        var mocks = BuildMocks(roomId);
        mocks.Caller
            .Setup(p => p.SendCoreAsync("SYNC_STATE", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Callback<string, object?[], CancellationToken>((_, args, _) => capturedArgs = args)
            .Returns(Task.CompletedTask);

        var hub = BuildHub(roomId, userId, mocks);
        await hub.OnConnectedAsync();

        capturedArgs.Should().NotBeNull();
        var syncState = capturedArgs![0] as SyncStateMessage;
        syncState.Should().NotBeNull();
        // adjustedPos = 100 + ~5 = ~105; allow ±2s clock tolerance
        syncState!.PositionSec.Should().BeGreaterThanOrEqualTo(104);
    }

    [Fact]
    public async Task OnConnectedAsync_IsPaused_DoesNotAdjustPositionSec()
    {
        // When isPlaying=false (paused), positionSec must NOT change regardless of elapsed time.
        var roomId = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid().ToString();
        var room   = MakeRoom(roomId, "host-x", isPlaying: false, positionSec: 60,
                              lastUpdatedAt: DateTime.UtcNow.AddSeconds(-30));

        _serviceMock.Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>())).ReturnsAsync(room);
        _serviceMock.Setup(s => s.StoreMemberProfileAsync(roomId, userId, It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _userClientMock.Setup(u => u.GetUserProfileAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new UserMiniProfile(userId, "Test User", null));

        object?[]? capturedArgs = null;
        var mocks = BuildMocks(roomId);
        mocks.Caller
            .Setup(p => p.SendCoreAsync("SYNC_STATE", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()))
            .Callback<string, object?[], CancellationToken>((_, args, _) => capturedArgs = args)
            .Returns(Task.CompletedTask);

        var hub = BuildHub(roomId, userId, mocks);
        await hub.OnConnectedAsync();

        var syncState = capturedArgs![0] as SyncStateMessage;
        syncState!.PositionSec.Should().Be(60, "paused room must not adjust position");
    }

    [Fact]
    public async Task OnConnectedAsync_RoomNotFound_SendsRoomClosedAndAborts()
    {
        var roomId = Guid.NewGuid().ToString();
        _serviceMock.Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>())).ReturnsAsync((Room?)null);

        var mocks = BuildMocks(roomId);
        mocks.Context.Setup(c => c.Abort());

        var hub = BuildHub(roomId, "any-user", mocks);
        await hub.OnConnectedAsync();

        mocks.Caller.Verify(p => p.SendCoreAsync("ROOM_CLOSED", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
        mocks.Context.Verify(c => c.Abort(), Times.Once);
        mocks.Groups.Verify(g => g.AddToGroupAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── OnDisconnectedAsync ──────────────────────────────────────────────────

    [Fact]
    public async Task OnDisconnectedAsync_HostDisconnects_BroadcastsRoomClosedToGroup()
    {
        var roomId = Guid.NewGuid().ToString();
        var hostId = Guid.NewGuid().ToString();

        _serviceMock.Setup(s => s.HandleMemberDisconnectAsync(roomId, hostId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true); // isHost = true

        var mocks = BuildMocks(roomId);
        var hub   = BuildHub(roomId, hostId, mocks);

        await hub.OnDisconnectedAsync(null);

        mocks.GroupProxy.Verify(p => p.SendCoreAsync("ROOM_CLOSED", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
        mocks.Groups.Verify(g => g.RemoveFromGroupAsync("conn-test-1", roomId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task OnDisconnectedAsync_MemberDisconnects_BroadcastsMemberLeaveNotRoomClosed()
    {
        var roomId   = Guid.NewGuid().ToString();
        var memberId = Guid.NewGuid().ToString();

        _serviceMock.Setup(s => s.HandleMemberDisconnectAsync(roomId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false); // isHost = false

        var mocks = BuildMocks(roomId);
        var hub   = BuildHub(roomId, memberId, mocks);

        await hub.OnDisconnectedAsync(null);

        mocks.OthersProxy.Verify(p => p.SendCoreAsync("MEMBER_LEAVE", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Once);
        mocks.GroupProxy.Verify(p => p.SendCoreAsync("ROOM_CLOSED", It.IsAny<object?[]>(), It.IsAny<CancellationToken>()), Times.Never);
        mocks.Groups.Verify(g => g.RemoveFromGroupAsync("conn-test-1", roomId, It.IsAny<CancellationToken>()), Times.Once);
    }
}
