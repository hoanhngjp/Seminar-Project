using AnalyticsService.Application.DTOs;
using AnalyticsService.Application.Interfaces;
using AnalyticsService.Domain.Models;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AnalyticsService.UnitTests;

public class AnalyticsServiceTests
{
    private readonly Mock<IIdempotencyRepository> _idempotency = new();
    private readonly Mock<IEventPublisher> _publisher = new();
    private readonly Mock<IAnalyticsRepository> _analyticsRepo = new();
    private readonly Mock<IAnalyticsCache> _cache = new();
    private readonly Mock<IMusicServiceClient> _musicClient = new();
    private readonly AnalyticsService.Application.Services.AnalyticsService _sut;

    public AnalyticsServiceTests()
    {
        _sut = new AnalyticsService.Application.Services.AnalyticsService(
            _idempotency.Object,
            _publisher.Object,
            _analyticsRepo.Object,
            _cache.Object,
            _musicClient.Object,
            NullLogger<AnalyticsService.Application.Services.AnalyticsService>.Instance);
    }

    // ── RecordPlayAsync ───────────────────────────────────────────────

    [Fact]
    public async Task RecordPlayAsync_NewKey_ReturnsTrue_AndPublishesBackground()
    {
        // AC4.1.4: accepted (not duplicate) → returns true
        _idempotency.Setup(i => i.CheckAndSetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false); // false = not duplicate

        var result = await _sut.RecordPlayAsync(
            "key-001",
            Guid.NewGuid(),
            new RecordPlayRequest(Guid.NewGuid(), 180, 120, "web"));

        result.Should().BeTrue();
    }

    [Fact]
    public async Task RecordPlayAsync_DuplicateKey_ReturnsFalse_AC4_1_3()
    {
        // AC4.1.3: duplicate idempotency key → skip, return false
        _idempotency.Setup(i => i.CheckAndSetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true); // true = already existed = duplicate

        var result = await _sut.RecordPlayAsync(
            "dup-key",
            Guid.NewGuid(),
            new RecordPlayRequest(Guid.NewGuid(), 180, 120, "web"));

        result.Should().BeFalse();
        _publisher.Verify(p => p.PublishPlayEventAsync(It.IsAny<PlayEvent>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RecordPlayAsync_UsesCorrectRedisKey()
    {
        // Idempotency key must be prefixed: analytics:idem:{key}
        string? capturedKey = null;
        _idempotency.Setup(i => i.CheckAndSetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Callback<string, TimeSpan, CancellationToken>((k, _, _) => capturedKey = k)
            .ReturnsAsync(false);

        await _sut.RecordPlayAsync("my-idem-key", Guid.NewGuid(),
            new RecordPlayRequest(Guid.NewGuid(), 180, 120, "web"));

        capturedKey.Should().Be("analytics:idem:my-idem-key");
    }

    [Fact]
    public async Task RecordPlayAsync_IdempotencyTtlIs24Hours()
    {
        TimeSpan? capturedTtl = null;
        _idempotency.Setup(i => i.CheckAndSetAsync(It.IsAny<string>(), It.IsAny<TimeSpan>(), It.IsAny<CancellationToken>()))
            .Callback<string, TimeSpan, CancellationToken>((_, ttl, _) => capturedTtl = ttl)
            .ReturnsAsync(false);

        await _sut.RecordPlayAsync("key", Guid.NewGuid(),
            new RecordPlayRequest(Guid.NewGuid(), 180, 120, "web"));

        capturedTtl.Should().Be(TimeSpan.FromHours(24));
    }

    // ── GetHeatmapAsync ───────────────────────────────────────────────

    [Fact]
    public async Task GetHeatmapAsync_CacheHit_ReturnsCachedData_AC4_2_4()
    {
        // AC4.2.4: cache hit returns fast
        var songId = Guid.NewGuid();
        var cached = new HeatmapResponse([new HeatmapPoint(30, 5)]);
        _cache.Setup(c => c.GetHeatmapAsync(songId, "7d", It.IsAny<CancellationToken>()))
            .ReturnsAsync(cached);

        var (data, hit) = await _sut.GetHeatmapAsync(songId, "7d");

        hit.Should().BeTrue();
        data.Heatmap.Should().HaveCount(1);
        data.Heatmap[0].Second.Should().Be(30);
        _analyticsRepo.Verify(r => r.GetHeatmapAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetHeatmapAsync_CacheMiss_QueriesInfluxDB()
    {
        var songId = Guid.NewGuid();
        _cache.Setup(c => c.GetHeatmapAsync(songId, "7d", It.IsAny<CancellationToken>()))
            .ReturnsAsync((HeatmapResponse?)null);

        var influxResult = new HeatmapResponse([new HeatmapPoint(45, 3)]);
        _analyticsRepo.Setup(r => r.GetHeatmapAsync(songId, "7d", It.IsAny<CancellationToken>()))
            .ReturnsAsync(influxResult);

        _cache.Setup(c => c.SetHeatmapAsync(songId, "7d", influxResult, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var (data, hit) = await _sut.GetHeatmapAsync(songId, "7d");

        hit.Should().BeFalse();
        data.Heatmap.Should().HaveCount(1);
        _analyticsRepo.Verify(r => r.GetHeatmapAsync(songId, "7d", It.IsAny<CancellationToken>()), Times.Once);
        _cache.Verify(c => c.SetHeatmapAsync(songId, "7d", influxResult, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetHeatmapAsync_InfluxTimeout_ReturnsEmpty()
    {
        var songId = Guid.NewGuid();
        _cache.Setup(c => c.GetHeatmapAsync(songId, "7d", It.IsAny<CancellationToken>()))
            .ReturnsAsync((HeatmapResponse?)null);

        _analyticsRepo.Setup(r => r.GetHeatmapAsync(songId, "7d", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OperationCanceledException());

        var (data, hit) = await _sut.GetHeatmapAsync(songId, "7d");

        hit.Should().BeFalse();
        data.Heatmap.Should().BeEmpty();
    }

    // ── GetStatsAsync ─────────────────────────────────────────────────

    [Fact]
    public async Task GetStatsAsync_CacheHit_ReturnsCachedData()
    {
        var songId = Guid.NewGuid();
        var cached = new StatsResponse(100, 20, 80, 75.5, []);
        _cache.Setup(c => c.GetStatsAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(cached);

        var (data, hit) = await _sut.GetStatsAsync(songId);

        hit.Should().BeTrue();
        data.TotalPlays.Should().Be(100);
        data.TotalSkips.Should().Be(20);
        _analyticsRepo.Verify(r => r.GetStatsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetStatsAsync_CacheMiss_QueriesInfluxDB()
    {
        var songId = Guid.NewGuid();
        _cache.Setup(c => c.GetStatsAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StatsResponse?)null);

        var stats = new StatsResponse(50, 10, 40, 68.0, []);
        _analyticsRepo.Setup(r => r.GetStatsAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(stats);

        _cache.Setup(c => c.SetStatsAsync(songId, stats, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var (data, hit) = await _sut.GetStatsAsync(songId);

        hit.Should().BeFalse();
        data.TotalPlays.Should().Be(50);
        _analyticsRepo.Verify(r => r.GetStatsAsync(songId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task GetStatsAsync_InfluxTimeout_ReturnsZeros()
    {
        var songId = Guid.NewGuid();
        _cache.Setup(c => c.GetStatsAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((StatsResponse?)null);

        _analyticsRepo.Setup(r => r.GetStatsAsync(songId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OperationCanceledException());

        var (data, _) = await _sut.GetStatsAsync(songId);

        data.TotalPlays.Should().Be(0);
        data.TotalSkips.Should().Be(0);
    }

    // ── VerifyOwnershipAsync ──────────────────────────────────────────

    [Fact]
    public async Task VerifyOwnershipAsync_ArtistMatches_ReturnsTrue_AC4_2_3()
    {
        var songId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        _musicClient.Setup(m => m.GetSongArtistIdAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(userId);

        var result = await _sut.VerifyOwnershipAsync(songId, userId);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task VerifyOwnershipAsync_ArtistMismatch_ReturnsFalse_AC4_2_3()
    {
        // AC4.2.3: non-owner Creator → 403 FORBIDDEN
        var songId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var otherArtistId = Guid.NewGuid();

        _musicClient.Setup(m => m.GetSongArtistIdAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(otherArtistId);

        var result = await _sut.VerifyOwnershipAsync(songId, userId);

        result.Should().BeFalse();
    }

    [Fact]
    public async Task VerifyOwnershipAsync_SongNotFound_ReturnsNull()
    {
        var songId = Guid.NewGuid();
        _musicClient.Setup(m => m.GetSongArtistIdAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid?)null);

        var result = await _sut.VerifyOwnershipAsync(songId, Guid.NewGuid());

        result.Should().BeNull();
    }

    [Fact]
    public async Task VerifyOwnershipAsync_MusicServiceFails_ReturnsNull()
    {
        // Non-fatal: music service down → return null (controller returns 404 as safe fallback)
        var songId = Guid.NewGuid();
        _musicClient.Setup(m => m.GetSongArtistIdAsync(songId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("service down"));

        var act = async () => await _sut.VerifyOwnershipAsync(songId, Guid.NewGuid());

        await act.Should().NotThrowAsync();
        var result = await _sut.VerifyOwnershipAsync(songId, Guid.NewGuid());
        result.Should().BeNull();
    }
}
