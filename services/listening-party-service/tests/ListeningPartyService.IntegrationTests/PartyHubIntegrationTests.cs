using System.Diagnostics;
using FluentAssertions;
using ListeningPartyService.Application.DTOs;
using ListeningPartyService.Application.Services;
using ListeningPartyService.Domain.Models;
using Microsoft.AspNetCore.SignalR.Client;
using Moq;

namespace ListeningPartyService.IntegrationTests;

/// <summary>
/// Integration tests for PartyHub via real SignalR TestServer connections.
/// Covers: AC7.2.1 (broadcast), AC7.2.2 (member reject), AC7.3.1 (connect sync).
/// Infrastructure: WebApplicationFactory + LongPolling transport.
/// </summary>
public class PartyHubIntegrationTests : IClassFixture<PartyHubWebApplicationFactory>, IAsyncLifetime
{
    private readonly PartyHubWebApplicationFactory _factory;

    public PartyHubIntegrationTests(PartyHubWebApplicationFactory factory)
    {
        _factory = factory;
        _factory.ServiceMock.Reset();
    }

    public Task InitializeAsync() => Task.CompletedTask;
    public Task DisposeAsync() => Task.CompletedTask;

    // ─── Helper ───────────────────────────────────────────────────────────────

    private static Room MakeRoom(string roomId, string hostId, string songId = "song-001",
        bool isPlaying = false, int positionSec = 0)
        => new() { RoomId = roomId, HostId = hostId, SongId = songId, IsPlaying = isPlaying, PositionSec = positionSec };

    // ─── AC7.3.1: OnConnected sends SYNC_STATE to new caller ─────────────────

    [Fact]
    public async Task OnConnected_ValidRoom_CallerReceivesInitialSyncState_AC7_3_1()
    {
        // AC7.3.1: On connect, caller receives current SYNC_STATE (songId, isPlaying, positionSec)
        var roomId = Guid.NewGuid().ToString();
        var hostId = Guid.NewGuid().ToString();
        var room = MakeRoom(roomId, hostId, "song-001", isPlaying: true, positionSec: 42);

        _factory.ServiceMock
            .Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(room);
        _factory.ServiceMock
            .Setup(s => s.HandleMemberDisconnectAsync(roomId, hostId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var connection = _factory.CreateHubConnection(roomId, hostId, "Creator");
        var syncTcs = new TaskCompletionSource<SyncStateMessage>();

        connection.On<SyncStateMessage>("SYNC_STATE", msg => syncTcs.TrySetResult(msg));

        try
        {
            await connection.StartAsync();
            var syncMsg = await syncTcs.Task.WaitAsync(TimeSpan.FromSeconds(5));

            syncMsg.SongId.Should().Be("song-001");
            syncMsg.IsPlaying.Should().BeTrue();
            syncMsg.PositionSec.Should().Be(42);
            syncMsg.HostId.Should().Be(hostId);
        }
        finally
        {
            await connection.StopAsync();
        }
    }

    // ─── AC7.2.1: Host PLAYER_ACTION → all members receive SYNC_STATE ─────────

    [Fact]
    public async Task PlayerAction_HostPlays_MemberReceivesSyncState_AC7_2_1()
    {
        // AC7.2.1: Host sends PLAY → all clients receive SYNC_STATE < 500ms
        var roomId = Guid.NewGuid().ToString();
        var hostId = Guid.NewGuid().ToString();
        var memberId = Guid.NewGuid().ToString();
        var room = MakeRoom(roomId, hostId, "song-001", isPlaying: false, positionSec: 0);

        _factory.ServiceMock
            .Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(room);
        _factory.ServiceMock
            .Setup(s => s.UpdateRoomStateAsync(roomId, true, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Room { RoomId = roomId, HostId = hostId, SongId = "song-001", IsPlaying = true, PositionSec = 0 });
        _factory.ServiceMock
            .Setup(s => s.HandleMemberDisconnectAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var hostConn = _factory.CreateHubConnection(roomId, hostId, "Creator");
        var memberConn = _factory.CreateHubConnection(roomId, memberId, "Listener");

        // Member collects SYNC_STATE messages: [0] = initial on connect, [1] = from Host action
        var memberSyncMessages = new List<SyncStateMessage>();
        var secondSyncTcs = new TaskCompletionSource<SyncStateMessage>();

        memberConn.On<SyncStateMessage>("SYNC_STATE", msg =>
        {
            memberSyncMessages.Add(msg);
            if (memberSyncMessages.Count >= 2)
                secondSyncTcs.TrySetResult(msg);
        });

        try
        {
            await hostConn.StartAsync();
            await memberConn.StartAsync();

            var sw = Stopwatch.StartNew();
            await hostConn.InvokeAsync("PlayerAction", new PlayerActionMessage(
                Guid.NewGuid().ToString(), "PLAY", null, null, DateTime.UtcNow.ToString("O")));

            var syncFromAction = await secondSyncTcs.Task.WaitAsync(TimeSpan.FromMilliseconds(500));
            sw.Stop();

            syncFromAction.IsPlaying.Should().BeTrue("Host sent PLAY");
            sw.ElapsedMilliseconds.Should().BeLessThan(500, "AC7.2.1: broadcast must arrive within 500ms");
        }
        finally
        {
            await hostConn.StopAsync();
            await memberConn.StopAsync();
        }
    }

    // ─── AC7.2.2: Member PLAYER_ACTION → silently ignored ────────────────────

    [Fact]
    public async Task PlayerAction_ByMember_NotBroadcastToHost_AC7_2_2()
    {
        // AC7.2.2: Member sends PLAYER_ACTION → no SYNC_STATE beyond initial connect event
        var roomId = Guid.NewGuid().ToString();
        var hostId = Guid.NewGuid().ToString();
        var memberId = Guid.NewGuid().ToString();
        var room = MakeRoom(roomId, hostId, "song-001");

        _factory.ServiceMock
            .Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(room);
        _factory.ServiceMock
            .Setup(s => s.HandleMemberDisconnectAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var hostConn = _factory.CreateHubConnection(roomId, hostId, "Creator");
        var memberConn = _factory.CreateHubConnection(roomId, memberId, "Listener");

        var hostSyncCount = 0;
        hostConn.On<SyncStateMessage>("SYNC_STATE", _ => Interlocked.Increment(ref hostSyncCount));

        try
        {
            await hostConn.StartAsync();
            await memberConn.StartAsync();

            // Reset counter after initial connect SYNC_STATEs
            await Task.Delay(200);
            var syncCountAfterConnect = hostSyncCount;

            // Member attempts PlayerAction
            await memberConn.InvokeAsync("PlayerAction", new PlayerActionMessage(
                Guid.NewGuid().ToString(), "PLAY", null, null, DateTime.UtcNow.ToString("O")));

            // Wait briefly — no additional SYNC_STATE should arrive
            await Task.Delay(300);

            hostSyncCount.Should().Be(syncCountAfterConnect,
                "Member PlayerAction must be silently ignored — no SYNC_STATE broadcast");
            _factory.ServiceMock.Verify(
                s => s.UpdateRoomStateAsync(It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<int>(), It.IsAny<CancellationToken>()),
                Times.Never);
        }
        finally
        {
            await hostConn.StopAsync();
            await memberConn.StopAsync();
        }
    }

    // ─── Host disconnect → ROOM_CLOSED broadcast ──────────────────────────────

    [Fact]
    public async Task OnDisconnected_HostLeaves_MemberReceivesRoomClosed()
    {
        var roomId = Guid.NewGuid().ToString();
        var hostId = Guid.NewGuid().ToString();
        var memberId = Guid.NewGuid().ToString();
        var room = MakeRoom(roomId, hostId);

        _factory.ServiceMock
            .Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(room);
        // Host disconnect returns isHost = true
        _factory.ServiceMock
            .Setup(s => s.HandleMemberDisconnectAsync(roomId, hostId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        // Member disconnect returns isHost = false
        _factory.ServiceMock
            .Setup(s => s.HandleMemberDisconnectAsync(roomId, memberId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var hostConn = _factory.CreateHubConnection(roomId, hostId, "Creator");
        var memberConn = _factory.CreateHubConnection(roomId, memberId, "Listener");

        var roomClosedTcs = new TaskCompletionSource<RoomClosedMessage>();
        memberConn.On<RoomClosedMessage>("ROOM_CLOSED", msg => roomClosedTcs.TrySetResult(msg));

        try
        {
            await hostConn.StartAsync();
            await memberConn.StartAsync();

            // Host disconnects
            await hostConn.StopAsync();

            var roomClosed = await roomClosedTcs.Task.WaitAsync(TimeSpan.FromSeconds(5));
            roomClosed.Reason.Should().Be("host_disconnected");
        }
        finally
        {
            await memberConn.StopAsync();
        }
    }

    // ─── MEMBER_JOIN broadcast ────────────────────────────────────────────────

    [Fact]
    public async Task OnConnected_NewMemberJoins_HostReceivesMemberJoin()
    {
        var roomId = Guid.NewGuid().ToString();
        var hostId = Guid.NewGuid().ToString();
        var memberId = Guid.NewGuid().ToString();
        var room = MakeRoom(roomId, hostId);

        _factory.ServiceMock
            .Setup(s => s.GetRoomAsync(roomId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(room);
        _factory.ServiceMock
            .Setup(s => s.HandleMemberDisconnectAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var hostConn = _factory.CreateHubConnection(roomId, hostId, "Creator");
        var memberConn = _factory.CreateHubConnection(roomId, memberId, "Listener");

        var memberJoinTcs = new TaskCompletionSource<MemberJoinMessage>();
        hostConn.On<MemberJoinMessage>("MEMBER_JOIN", msg =>
        {
            if (msg.UserId == memberId) memberJoinTcs.TrySetResult(msg);
        });

        try
        {
            await hostConn.StartAsync();
            await memberConn.StartAsync();

            var joinMsg = await memberJoinTcs.Task.WaitAsync(TimeSpan.FromSeconds(5));
            joinMsg.UserId.Should().Be(memberId);
            joinMsg.JoinedAt.Should().NotBeNullOrEmpty();
        }
        finally
        {
            await hostConn.StopAsync();
            await memberConn.StopAsync();
        }
    }
}
