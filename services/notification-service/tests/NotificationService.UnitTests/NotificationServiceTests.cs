using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NotificationService.Application.DTOs;
using NotificationService.Application.Interfaces;
using NotificationService.Application.Services;
using NotificationService.Domain.Exceptions;
using NotificationService.Domain.Models;

namespace NotificationService.UnitTests;

public class NotificationServiceTests
{
    private readonly Mock<INotificationRepository> _repoMock = new();
    private readonly Mock<IIdempotencyRepository> _idemMock = new();
    private readonly Mock<IUserServiceClient> _userClientMock = new();
    private readonly Mock<IEventPublisher> _publisherMock = new();
    private readonly Application.Services.NotificationService _sut;

    public NotificationServiceTests()
    {
        _sut = new Application.Services.NotificationService(
            _repoMock.Object,
            _idemMock.Object,
            _userClientMock.Object,
            _publisherMock.Object,
            NullLogger<Application.Services.NotificationService>.Instance);
    }

    // ─── GetUnreadAsync ────────────────────────────────────────────────

    [Fact]
    public async Task GetUnreadAsync_WithValidLimit_ReturnsMappedDtos()
    {
        // AC6.1.2: GET /notifications/unread returns items with pagination
        var userId = Guid.NewGuid();
        var notification = new Notification
        {
            Id = "507f1f77bcf86cd799439011",
            RecipientId = userId,
            Type = NotificationType.NewRelease,
            Status = NotificationStatus.Delivered,
            Title = "Test Title",
            Body = "Test Body",
            CreatedAt = DateTime.UtcNow
        };

        _repoMock
            .Setup(r => r.GetUnreadAsync(userId, 10, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Notification> { notification }, (string?)null));

        var result = await _sut.GetUnreadAsync(userId, 10, null, CancellationToken.None);

        result.Items.Should().HaveCount(1);
        result.Items[0].NotificationId.Should().Be("507f1f77bcf86cd799439011");
        result.Items[0].Message.Should().Be("Test Body");
        result.Items[0].Type.Should().Be("new_release");
        result.Items[0].Read.Should().BeFalse();
        result.HasMore.Should().BeFalse();
        result.NextCursor.Should().BeNull();
    }

    [Fact]
    public async Task GetUnreadAsync_WithNextCursor_ReturnsHasMoreTrue()
    {
        // AC6.1.2: hasMore = true when nextCursor is present
        var userId = Guid.NewGuid();
        var nextCursor = "507f1f77bcf86cd799439022";

        _repoMock
            .Setup(r => r.GetUnreadAsync(userId, 5, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<Notification>(), nextCursor));

        var result = await _sut.GetUnreadAsync(userId, 5, null, CancellationToken.None);

        result.HasMore.Should().BeTrue();
        result.NextCursor.Should().Be(nextCursor);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(51)]
    [InlineData(-1)]
    public async Task GetUnreadAsync_WithInvalidLimit_ThrowsValidationException(int limit)
    {
        var act = () => _sut.GetUnreadAsync(Guid.NewGuid(), limit, null, CancellationToken.None);
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*limit*");
    }

    // ─── MarkReadAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task MarkReadAsync_FirstTime_ReturnsSuccessWithReadAt()
    {
        // AC6.1.3: PATCH /{id}/read first call → 200 with readAt
        var userId = Guid.NewGuid();
        var notifId = "507f1f77bcf86cd799439011";
        var notification = new Notification
        {
            Id = notifId,
            RecipientId = userId,
            Type = NotificationType.NewRelease,
            Status = NotificationStatus.Delivered,
            CreatedAt = DateTime.UtcNow
        };

        _idemMock
            .Setup(i => i.TrySetAsync("notification:idem:key-abc", TimeSpan.FromHours(24), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _repoMock
            .Setup(r => r.GetByIdAsync(notifId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notification);

        _repoMock
            .Setup(r => r.MarkReadAsync(notifId, It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var (success, result) = await _sut.MarkReadAsync(notifId, userId, "key-abc", CancellationToken.None);

        success.Should().BeTrue();
        result.Should().NotBeNull();
        result!.NotificationId.Should().Be(notifId);
        result.ReadAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public async Task MarkReadAsync_DuplicateIdempotencyKey_ReturnsFalse()
    {
        // AC6.1.3: PATCH /{id}/read with same Idempotency-Key → false (caller returns 409)
        _idemMock
            .Setup(i => i.TrySetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var (success, result) = await _sut.MarkReadAsync(
            "507f1f77bcf86cd799439011", Guid.NewGuid(), "key-dup", CancellationToken.None);

        success.Should().BeFalse();
        result.Should().BeNull();

        _repoMock.Verify(r => r.GetByIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task MarkReadAsync_WhenNotificationNotFound_ThrowsNotFoundException()
    {
        _idemMock
            .Setup(i => i.TrySetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _repoMock
            .Setup(r => r.GetByIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification?)null);

        var act = () => _sut.MarkReadAsync(
            "nonexistent-id", Guid.NewGuid(), "key-xyz", CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task MarkReadAsync_WhenDifferentUser_ThrowsForbiddenException()
    {
        var ownerId = Guid.NewGuid();
        var otherUser = Guid.NewGuid();
        var notifId = "507f1f77bcf86cd799439011";

        _idemMock
            .Setup(i => i.TrySetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _repoMock
            .Setup(r => r.GetByIdAsync(notifId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Notification { Id = notifId, RecipientId = ownerId });

        var act = () => _sut.MarkReadAsync(notifId, otherUser, "key-xyz", CancellationToken.None);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    // ─── FanOutNewReleaseAsync ─────────────────────────────────────────

    [Fact]
    public async Task FanOutNewReleaseAsync_WithFollowers_InsertsNotificationsAndPublishesEvents()
    {
        // AC6.1.1: New_Release event → MongoDB document per follower + Notification_Sent published
        var follower1 = Guid.NewGuid();
        var follower2 = Guid.NewGuid();

        _userClientMock
            .Setup(c => c.GetFollowersAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(AsyncEnumerableOf(follower1, follower2));

        _repoMock
            .Setup(r => r.InsertManyAsync(It.IsAny<IEnumerable<Notification>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _publisherMock
            .Setup(p => p.PublishAsync(It.IsAny<string>(), It.IsAny<NotificationSentEventDto>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var @event = BuildNewReleaseEvent();

        await _sut.FanOutNewReleaseAsync(@event, CancellationToken.None);

        _repoMock.Verify(r =>
            r.InsertManyAsync(
                It.Is<IEnumerable<Notification>>(n => n.Count() == 2),
                It.IsAny<CancellationToken>()),
            Times.Once);

        _publisherMock.Verify(p =>
            p.PublishAsync("Notification_Sent", It.IsAny<NotificationSentEventDto>(), It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Fact]
    public async Task FanOutNewReleaseAsync_WithNoFollowers_InsertsNothing()
    {
        _userClientMock
            .Setup(c => c.GetFollowersAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(AsyncEnumerableOf<Guid>());

        var @event = BuildNewReleaseEvent();
        await _sut.FanOutNewReleaseAsync(@event, CancellationToken.None);

        _repoMock.Verify(r =>
            r.InsertManyAsync(It.IsAny<IEnumerable<Notification>>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task FanOutNewReleaseAsync_WithInvalidArtistId_ReturnsEarly()
    {
        var @event = BuildNewReleaseEvent() with { ArtistId = "not-a-guid" };

        var result = await _sut.FanOutNewReleaseAsync(@event, CancellationToken.None);

        result.NotificationsCreated.Should().Be(0);
        _userClientMock.Verify(c =>
            c.GetFollowersAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task FanOutNewReleaseAsync_BatchOf500_FlushesCorrectly()
    {
        // Verify batch flushing: 1001 followers → 2 InsertMany calls (500 + 500 + 1)
        var followers = Enumerable.Range(0, 1001).Select(_ => Guid.NewGuid()).ToArray();

        _userClientMock
            .Setup(c => c.GetFollowersAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(AsyncEnumerableOf(followers));

        _repoMock
            .Setup(r => r.InsertManyAsync(It.IsAny<IEnumerable<Notification>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _publisherMock
            .Setup(p => p.PublishAsync(It.IsAny<string>(), It.IsAny<NotificationSentEventDto>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await _sut.FanOutNewReleaseAsync(BuildNewReleaseEvent(), CancellationToken.None);

        // 3 batches: 500 + 500 + 1
        _repoMock.Verify(r =>
            r.InsertManyAsync(It.IsAny<IEnumerable<Notification>>(), It.IsAny<CancellationToken>()),
            Times.Exactly(3));
    }

    [Fact]
    public async Task FanOutNewReleaseAsync_NotificationTitleContainsArtistName()
    {
        var follower = Guid.NewGuid();
        Notification? captured = null;

        _userClientMock
            .Setup(c => c.GetFollowersAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(AsyncEnumerableOf(follower));

        _repoMock
            .Setup(r => r.InsertManyAsync(It.IsAny<IEnumerable<Notification>>(), It.IsAny<CancellationToken>()))
            .Callback<IEnumerable<Notification>, CancellationToken>((notifications, _) =>
                captured = notifications.First())
            .Returns(Task.CompletedTask);

        _publisherMock
            .Setup(p => p.PublishAsync(It.IsAny<string>(), It.IsAny<object>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var @event = BuildNewReleaseEvent();
        await _sut.FanOutNewReleaseAsync(@event, CancellationToken.None);

        captured.Should().NotBeNull();
        captured!.Title.Should().Contain(@event.ArtistName);
        captured.RecipientId.Should().Be(follower);
        captured.Type.Should().Be(NotificationType.NewRelease);
    }

    [Fact]
    public async Task FanOutNewReleaseAsync_PublishFailure_DoesNotCrashFanOut()
    {
        // Notification_Sent is best-effort — publish failure must not fail fan-out
        var follower = Guid.NewGuid();

        _userClientMock
            .Setup(c => c.GetFollowersAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(AsyncEnumerableOf(follower));

        _repoMock
            .Setup(r => r.InsertManyAsync(It.IsAny<IEnumerable<Notification>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        _publisherMock
            .Setup(p => p.PublishAsync(It.IsAny<string>(), It.IsAny<NotificationSentEventDto>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Kafka down"));

        var act = () => _sut.FanOutNewReleaseAsync(BuildNewReleaseEvent(), CancellationToken.None);

        await act.Should().NotThrowAsync();
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    private static NewReleaseEventDto BuildNewReleaseEvent() => new(
        EventId: Guid.NewGuid().ToString(),
        Version: "v1",
        Timestamp: DateTime.UtcNow.ToString("O"),
        CorrelationId: Guid.NewGuid().ToString(),
        ArtistId: Guid.NewGuid().ToString(),
        ArtistName: "Son Tung M-TP",
        SongId: Guid.NewGuid().ToString(),
        SongTitle: "Chung Ta Cua Hien Tai",
        AlbumId: null,
        GenreIds: new[] { Guid.NewGuid().ToString() },
        ThumbnailUrl: "https://cdn.example.com/thumb.jpg",
        S3StorageKey: "audio/2026/04/song.mp3",
        DurationSec: 287,
        Explicit: false
    );

    private static async IAsyncEnumerable<T> AsyncEnumerableOf<T>(params T[] items)
    {
        foreach (var item in items)
        {
            yield return item;
            await Task.Yield();
        }
    }
}
