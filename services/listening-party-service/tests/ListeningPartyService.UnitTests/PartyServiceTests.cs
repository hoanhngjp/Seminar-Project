using FluentAssertions;
using ListeningPartyService.Application.Interfaces;
using ListeningPartyService.Application.Services;
using ListeningPartyService.Domain.Exceptions;
using ListeningPartyService.Domain.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ListeningPartyService.UnitTests;

public class PartyServiceTests
{
    private readonly Mock<IPartyRepository> _repoMock = new();
    private readonly PartyService _sut;

    public PartyServiceTests()
    {
        _sut = new PartyService(_repoMock.Object, NullLogger<PartyService>.Instance);
    }

    // ─── CreatePartyAsync ────────────────────────────────────────────────

    [Fact]
    public async Task CreatePartyAsync_HappyPath_ReturnsRoomWithJoinCode_AC7_1_1()
    {
        // AC7.1.1: create party → roomId (UUID) + joinCode (6 ký tự)
        var hostId = Guid.NewGuid().ToString();
        var songId = "song-001";

        _repoMock.Setup(r => r.CreateAsync(It.IsAny<Room>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _repoMock.Setup(r => r.AddMemberAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await _sut.CreatePartyAsync(hostId, songId);

        result.HostId.Should().Be(hostId);
        result.RoomId.Should().NotBeNullOrEmpty();
        Guid.TryParse(result.RoomId, out _).Should().BeTrue("RoomId phải là UUID");
        result.JoinCode.Should().HaveLength(6);
        result.JoinCode.Should().MatchRegex("^[A-Z0-9]{6}$", "JoinCode phải là 6 ký tự alphanumeric uppercase");
    }

    [Fact]
    public async Task CreatePartyAsync_StoresRoomInRepository()
    {
        var hostId = Guid.NewGuid().ToString();
        var songId = "song-002";

        Room? capturedRoom = null;
        _repoMock.Setup(r => r.CreateAsync(It.IsAny<Room>(), It.IsAny<CancellationToken>()))
            .Callback<Room, CancellationToken>((room, _) => capturedRoom = room)
            .Returns(Task.CompletedTask);
        _repoMock.Setup(r => r.AddMemberAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await _sut.CreatePartyAsync(hostId, songId);

        capturedRoom.Should().NotBeNull();
        capturedRoom!.HostId.Should().Be(hostId);
        capturedRoom.SongId.Should().Be(songId);
        capturedRoom.IsPlaying.Should().BeFalse("room bắt đầu ở trạng thái paused");
        capturedRoom.PositionSec.Should().Be(0);
    }

    [Fact]
    public async Task CreatePartyAsync_AddsHostAsMember()
    {
        var hostId = Guid.NewGuid().ToString();
        string? capturedRoomId = null;
        string? capturedUserId = null;

        _repoMock.Setup(r => r.CreateAsync(It.IsAny<Room>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _repoMock.Setup(r => r.AddMemberAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, CancellationToken>((roomId, userId, _) =>
            {
                capturedRoomId = roomId;
                capturedUserId = userId;
            })
            .Returns(Task.CompletedTask);

        var result = await _sut.CreatePartyAsync(hostId, "song-001");

        capturedUserId.Should().Be(hostId, "host phải được add vào members ngay khi tạo room");
        capturedRoomId.Should().Be(result.RoomId);
    }

    [Fact]
    public async Task CreatePartyAsync_JoinCodeIsUnique_AcrossMultipleCalls()
    {
        _repoMock.Setup(r => r.CreateAsync(It.IsAny<Room>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _repoMock.Setup(r => r.AddMemberAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var codes = new HashSet<string>();
        for (int i = 0; i < 100; i++)
        {
            var result = await _sut.CreatePartyAsync(Guid.NewGuid().ToString(), "song-001");
            codes.Add(result.JoinCode);
        }

        // Với charset 36^6 = 2.1 tỷ possibilities, 100 calls gần như chắc chắn unique
        codes.Count.Should().BeGreaterThan(90, "joinCodes nên gần như luôn unique");
    }

    // ─── JoinPartyAsync ──────────────────────────────────────────────────

    [Fact]
    public async Task JoinPartyAsync_HappyPath_ReturnsRoomState_AC7_1_2()
    {
        // AC7.1.2: join hợp lệ → room state đầy đủ
        var roomId = Guid.NewGuid().ToString();
        var hostId = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid().ToString();
        var joinCode = "ABC123";

        _repoMock.Setup(r => r.GetRoomIdByJoinCodeAsync(joinCode, It.IsAny<CancellationToken>()))
            .ReturnsAsync(roomId);
        _repoMock.Setup(r => r.GetRoomAsync(roomId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Room
            {
                RoomId = roomId,
                HostId = hostId,
                SongId = "song-001",
                IsPlaying = false,
                PositionSec = 42,
                JoinCode = joinCode
            });
        _repoMock.Setup(r => r.AddMemberAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await _sut.JoinPartyAsync(joinCode, userId);

        result.RoomId.Should().Be(roomId);
        result.HostId.Should().Be(hostId);
        result.CurrentSongId.Should().Be("song-001");
        result.PlaybackPositionSec.Should().Be(42);
    }

    [Fact]
    public async Task JoinPartyAsync_JoinCodeNotFound_ThrowsRoomNotFoundException_AC7_1_3()
    {
        // AC7.1.3: joinCode không tồn tại → 404 ROOM_NOT_FOUND
        var joinCode = "BADCOD";

        _repoMock.Setup(r => r.GetRoomIdByJoinCodeAsync(joinCode, It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);

        var act = () => _sut.JoinPartyAsync(joinCode, Guid.NewGuid().ToString());

        await act.Should().ThrowAsync<RoomNotFoundException>();
    }

    [Fact]
    public async Task JoinPartyAsync_RoomDataMissing_ThrowsRoomNotFoundException()
    {
        // Edge case: joinCode exists but room hash expired (race condition)
        var roomId = Guid.NewGuid().ToString();
        var joinCode = "EXPIRED";

        _repoMock.Setup(r => r.GetRoomIdByJoinCodeAsync(joinCode, It.IsAny<CancellationToken>()))
            .ReturnsAsync(roomId);
        _repoMock.Setup(r => r.GetRoomAsync(roomId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Room?)null);

        var act = () => _sut.JoinPartyAsync(joinCode, Guid.NewGuid().ToString());

        await act.Should().ThrowAsync<RoomNotFoundException>();
    }

    [Fact]
    public async Task JoinPartyAsync_AddsMemberToRoom()
    {
        var roomId = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid().ToString();
        var joinCode = "JOIN01";
        string? capturedMemberId = null;

        _repoMock.Setup(r => r.GetRoomIdByJoinCodeAsync(joinCode, It.IsAny<CancellationToken>()))
            .ReturnsAsync(roomId);
        _repoMock.Setup(r => r.GetRoomAsync(roomId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Room { RoomId = roomId, HostId = Guid.NewGuid().ToString(), SongId = "s1", JoinCode = joinCode });
        _repoMock.Setup(r => r.AddMemberAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, CancellationToken>((_, uid, _) => capturedMemberId = uid)
            .Returns(Task.CompletedTask);

        await _sut.JoinPartyAsync(joinCode, userId);

        capturedMemberId.Should().Be(userId);
    }
}
