using FluentAssertions;
using ListeningPartyService.Application.DTOs;
using ListeningPartyService.Application.Interfaces;
using ListeningPartyService.Application.Services;
using ListeningPartyService.Domain.Exceptions;
using ListeningPartyService.Domain.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ListeningPartyService.UnitTests;

public class PartyServiceQueueTests
{
    private readonly Mock<IPartyRepository> _repoMock = new();
    private readonly Mock<IUserServiceClient> _userClientMock = new();
    private readonly Mock<IMusicServiceClient> _musicClientMock = new();
    private readonly PartyService _sut;

    private const string RoomId  = "room-abc-123";
    private const string UserId1 = "user-aaa-111";
    private const string UserId2 = "user-bbb-222";
    private const string SongA   = "song-aaaa-0001";
    private const string SongB   = "song-bbbb-0002";

    public PartyServiceQueueTests()
    {
        _sut = new PartyService(
            _repoMock.Object,
            _userClientMock.Object,
            _musicClientMock.Object,
            NullLogger<PartyService>.Instance);
    }

    // ─── GetQueueAsync ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetQueueAsync_WhenQueueIsEmpty_ReturnsEmptyList()
    {
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([]);

        var result = await _sut.GetQueueAsync(RoomId);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetQueueAsync_WhenQueueHasItems_ReturnsMappedDtos()
    {
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([
            new QueueItem { SongId = SongA, AddedByUserId = UserId1 },
            new QueueItem { SongId = SongB, AddedByUserId = UserId2 },
        ]);

        var result = await _sut.GetQueueAsync(RoomId);

        result.Should().HaveCount(2);
        result[0].Should().Be(new QueueItemDto(SongA, UserId1));
        result[1].Should().Be(new QueueItemDto(SongB, UserId2));
    }

    // ─── AddToQueueAsync ─────────────────────────────────────────────────────

    [Fact]
    public async Task AddToQueueAsync_WhenBelowMax_AddsItemAndReturnsMappedQueue()
    {
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([]);
        _repoMock.Setup(r => r.SaveQueueAsync(RoomId, It.IsAny<List<QueueItem>>(), default))
            .Returns(Task.CompletedTask);

        var result = await _sut.AddToQueueAsync(RoomId, SongA, UserId1);

        result.Should().HaveCount(1);
        result[0].Should().Be(new QueueItemDto(SongA, UserId1));
        _repoMock.Verify(r => r.SaveQueueAsync(
            RoomId,
            It.Is<List<QueueItem>>(q => q.Count == 1 && q[0].SongId == SongA && q[0].AddedByUserId == UserId1),
            default), Times.Once);
    }

    [Fact]
    public async Task AddToQueueAsync_WhenAtMax50_ThrowsQueueFullException()
    {
        // 50 existing items → adding one more should throw
        var full = Enumerable.Range(0, 50)
            .Select(i => new QueueItem { SongId = $"song-{i:000}", AddedByUserId = UserId1 })
            .ToList();
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync(full);

        var act = async () => await _sut.AddToQueueAsync(RoomId, SongA, UserId1);

        await act.Should().ThrowAsync<QueueFullException>();
        _repoMock.Verify(r => r.SaveQueueAsync(It.IsAny<string>(), It.IsAny<List<QueueItem>>(), default), Times.Never);
    }

    [Fact]
    public async Task AddToQueueAsync_MultipleSongsFromDifferentUsers_AllAppended()
    {
        // Queue already has SongA from UserId1
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([
            new QueueItem { SongId = SongA, AddedByUserId = UserId1 },
        ]);
        _repoMock.Setup(r => r.SaveQueueAsync(RoomId, It.IsAny<List<QueueItem>>(), default))
            .Returns(Task.CompletedTask);

        var result = await _sut.AddToQueueAsync(RoomId, SongB, UserId2);

        result.Should().HaveCount(2);
        result[1].Should().Be(new QueueItemDto(SongB, UserId2));
    }

    // ─── RemoveFromQueueAsync ────────────────────────────────────────────────

    [Fact]
    public async Task RemoveFromQueueAsync_WhenOwner_RemovesItemAndReturnsShorterQueue()
    {
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([
            new QueueItem { SongId = SongA, AddedByUserId = UserId1 },
            new QueueItem { SongId = SongB, AddedByUserId = UserId2 },
        ]);
        _repoMock.Setup(r => r.SaveQueueAsync(RoomId, It.IsAny<List<QueueItem>>(), default))
            .Returns(Task.CompletedTask);

        var result = await _sut.RemoveFromQueueAsync(RoomId, SongA, UserId1);

        result.Should().HaveCount(1);
        result[0].SongId.Should().Be(SongB);
        _repoMock.Verify(r => r.SaveQueueAsync(
            RoomId,
            It.Is<List<QueueItem>>(q => q.Count == 1 && q[0].SongId == SongB),
            default), Times.Once);
    }

    [Fact]
    public async Task RemoveFromQueueAsync_WhenNotOwner_ReturnsUnchangedQueue()
    {
        // UserId2 tries to remove SongA that was added by UserId1
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([
            new QueueItem { SongId = SongA, AddedByUserId = UserId1 },
        ]);

        var result = await _sut.RemoveFromQueueAsync(RoomId, SongA, UserId2);

        result.Should().HaveCount(1);
        result[0].SongId.Should().Be(SongA);
        _repoMock.Verify(r => r.SaveQueueAsync(It.IsAny<string>(), It.IsAny<List<QueueItem>>(), default), Times.Never);
    }

    [Fact]
    public async Task RemoveFromQueueAsync_WhenSongNotFound_ReturnsUnchangedQueue()
    {
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([
            new QueueItem { SongId = SongA, AddedByUserId = UserId1 },
        ]);

        var result = await _sut.RemoveFromQueueAsync(RoomId, "song-does-not-exist", UserId1);

        result.Should().HaveCount(1);
        _repoMock.Verify(r => r.SaveQueueAsync(It.IsAny<string>(), It.IsAny<List<QueueItem>>(), default), Times.Never);
    }

    // ─── DequeueNextAsync ────────────────────────────────────────────────────

    [Fact]
    public async Task DequeueNextAsync_WhenQueueEmpty_ReturnsNull()
    {
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([]);

        var result = await _sut.DequeueNextAsync(RoomId);

        result.Should().BeNull();
        _repoMock.Verify(r => r.UpdateRoomSongAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<int>(), default), Times.Never);
    }

    [Fact]
    public async Task DequeueNextAsync_WhenQueueHasItems_DequeuesFirstAndUpdatesRoom()
    {
        // Queue: SongA (first), SongB (second)
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([
            new QueueItem { SongId = SongA, AddedByUserId = UserId1 },
            new QueueItem { SongId = SongB, AddedByUserId = UserId2 },
        ]);
        _repoMock.Setup(r => r.UpdateRoomSongAsync(RoomId, SongA, true, 0, default))
            .Returns(Task.CompletedTask);
        _repoMock.Setup(r => r.SaveQueueAsync(RoomId, It.IsAny<List<QueueItem>>(), default))
            .Returns(Task.CompletedTask);
        _repoMock.Setup(r => r.GetRoomAsync(RoomId, default)).ReturnsAsync(new Room
        {
            RoomId = RoomId, HostId = "host-001", SongId = SongA, IsPlaying = true, PositionSec = 0, JoinCode = "ABCDE1"
        });

        var result = await _sut.DequeueNextAsync(RoomId);

        result.Should().NotBeNull();
        result!.UpdatedRoom.SongId.Should().Be(SongA);
        result.UpdatedRoom.IsPlaying.Should().BeTrue();
        result.UpdatedRoom.PositionSec.Should().Be(0);
        // Remaining queue should only have SongB
        result.UpdatedQueue.Should().HaveCount(1);
        result.UpdatedQueue[0].SongId.Should().Be(SongB);
    }

    [Fact]
    public async Task DequeueNextAsync_UpdatesRoomSongIdWithFirstQueueItem()
    {
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([
            new QueueItem { SongId = SongA, AddedByUserId = UserId1 },
        ]);
        _repoMock.Setup(r => r.UpdateRoomSongAsync(RoomId, SongA, true, 0, default))
            .Returns(Task.CompletedTask);
        _repoMock.Setup(r => r.SaveQueueAsync(RoomId, It.IsAny<List<QueueItem>>(), default))
            .Returns(Task.CompletedTask);
        _repoMock.Setup(r => r.GetRoomAsync(RoomId, default)).ReturnsAsync(new Room
        {
            RoomId = RoomId, HostId = "host-001", SongId = SongA, IsPlaying = true, PositionSec = 0, JoinCode = "ABCDE1"
        });

        await _sut.DequeueNextAsync(RoomId);

        // Must call UpdateRoomSongAsync with SongA, isPlaying=true, positionSec=0
        _repoMock.Verify(r => r.UpdateRoomSongAsync(RoomId, SongA, true, 0, default), Times.Once);
    }

    [Fact]
    public async Task DequeueNextAsync_SavesRemainingQueueAfterDequeue()
    {
        _repoMock.Setup(r => r.GetQueueAsync(RoomId, default)).ReturnsAsync([
            new QueueItem { SongId = SongA, AddedByUserId = UserId1 },
            new QueueItem { SongId = SongB, AddedByUserId = UserId2 },
        ]);
        _repoMock.Setup(r => r.UpdateRoomSongAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<bool>(), It.IsAny<int>(), default))
            .Returns(Task.CompletedTask);
        _repoMock.Setup(r => r.SaveQueueAsync(RoomId, It.IsAny<List<QueueItem>>(), default))
            .Returns(Task.CompletedTask);
        _repoMock.Setup(r => r.GetRoomAsync(RoomId, default)).ReturnsAsync(new Room
        {
            RoomId = RoomId, HostId = "host-001", SongId = SongA, IsPlaying = true, PositionSec = 0, JoinCode = "ABCDE1"
        });

        await _sut.DequeueNextAsync(RoomId);

        // Saved queue must only contain SongB (SongA was dequeued)
        _repoMock.Verify(r => r.SaveQueueAsync(
            RoomId,
            It.Is<List<QueueItem>>(q => q.Count == 1 && q[0].SongId == SongB),
            default), Times.Once);
    }
}
