using AnalyticsService.Application.Interfaces;
using AnalyticsService.Domain.Models;
using AnalyticsService.Infrastructure.Kafka.Handlers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AnalyticsService.UnitTests;

public class KafkaHandlerTests
{
    private readonly Mock<IAnalyticsRepository> _analyticsRepo = new();
    private readonly Mock<IIdempotencyRepository> _idempotency = new();

    // ── SongPlayedHandler ─────────────────────────────────────────────

    [Fact]
    public async Task SongPlayedHandler_ValidPayload_WritesToInfluxDB()
    {
        // AC4.1.1: stream start → Song_Played Kafka event → write InfluxDB
        _idempotency.Setup(i => i.CheckAndSetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false); // not duplicate

        _analyticsRepo.Setup(r => r.WritePlayEventAsync(It.IsAny<PlayEvent>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var handler = new SongPlayedHandler(
            _analyticsRepo.Object,
            _idempotency.Object,
            NullLogger<SongPlayedHandler>.Instance);

        var payload = """
            {
                "EventId": "evt-001",
                "UserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "SongId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
                "DurationSec": 240,
                "ListenedSec": 180,
                "Platform": "web",
                "OccurredAt": "2026-05-05T10:00:00Z"
            }
            """;

        await handler.HandleAsync("key", payload, CancellationToken.None);

        _analyticsRepo.Verify(r => r.WritePlayEventAsync(
            It.Is<PlayEvent>(e => e.EventId == "evt-001" && e.DurationSec == 240),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SongPlayedHandler_DuplicateEvent_SkipsWrite_AC4_1_3()
    {
        // AC4.1.3: duplicate eventId → skip InfluxDB write
        _idempotency.Setup(i => i.CheckAndSetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true); // duplicate

        var handler = new SongPlayedHandler(
            _analyticsRepo.Object,
            _idempotency.Object,
            NullLogger<SongPlayedHandler>.Instance);

        var payload = """
            {
                "EventId": "dup-evt",
                "UserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "SongId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
                "DurationSec": 240,
                "ListenedSec": 180,
                "Platform": "web",
                "OccurredAt": "2026-05-05T10:00:00Z"
            }
            """;

        await handler.HandleAsync("key", payload, CancellationToken.None);

        _analyticsRepo.Verify(r => r.WritePlayEventAsync(
            It.IsAny<PlayEvent>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SongPlayedHandler_InvalidJson_DoesNotThrow()
    {
        // Bad message → log and skip, no exception
        _idempotency.Setup(i => i.CheckAndSetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var handler = new SongPlayedHandler(
            _analyticsRepo.Object,
            _idempotency.Object,
            NullLogger<SongPlayedHandler>.Instance);

        var act = async () => await handler.HandleAsync("key", "not-json{{{", CancellationToken.None);

        await act.Should().NotThrowAsync();
        _analyticsRepo.Verify(r => r.WritePlayEventAsync(
            It.IsAny<PlayEvent>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SongPlayedHandler_UsesCorrectDedupKey()
    {
        // Dedup key must follow pattern: dedup:analytics:Song_Played:{eventId}
        string? capturedKey = null;
        _idempotency.Setup(i => i.CheckAndSetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Callback<string, TimeSpan, CancellationToken>((k, _, _) => capturedKey = k)
            .ReturnsAsync(false);

        _analyticsRepo.Setup(r => r.WritePlayEventAsync(It.IsAny<PlayEvent>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var handler = new SongPlayedHandler(
            _analyticsRepo.Object,
            _idempotency.Object,
            NullLogger<SongPlayedHandler>.Instance);

        var payload = """
            {
                "EventId": "unique-evt-abc",
                "UserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "SongId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
                "DurationSec": 120,
                "ListenedSec": 100,
                "Platform": "mobile",
                "OccurredAt": "2026-05-05T12:00:00Z"
            }
            """;

        await handler.HandleAsync("key", payload, CancellationToken.None);

        capturedKey.Should().Be("dedup:analytics:Song_Played:unique-evt-abc");
    }

    [Fact]
    public void SongPlayedHandler_TopicAndGroup_AreCorrect()
    {
        var handler = new SongPlayedHandler(
            _analyticsRepo.Object,
            _idempotency.Object,
            NullLogger<SongPlayedHandler>.Instance);

        handler.Topic.Should().Be("Song_Played");
        handler.ConsumerGroup.Should().Be("analytics-service");
    }
}
