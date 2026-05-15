using System.Security.Claims;
using AnalyticsService.Api.Controllers;
using AnalyticsService.Api.Models;
using AnalyticsService.Application.DTOs;
using AnalyticsService.Application.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace AnalyticsService.UnitTests;

public class AnalyticsControllerTests
{
    private readonly Mock<IAnalyticsService> _serviceMock = new();
    private readonly AnalyticsController _sut;

    public AnalyticsControllerTests()
    {
        _sut = new AnalyticsController(_serviceMock.Object);
    }

    private void SetUser(Guid userId, string role = "Listener")
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Role, role)
        };
        var identity = new ClaimsIdentity(claims, "Test");
        _sut.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(identity)
            }
        };
    }

    // ── POST /analytics/events/play ───────────────────────────────────

    [Fact]
    public async Task RecordPlay_ValidRequest_Returns202_AC4_1_4()
    {
        // AC4.1.4: endpoint returns 202 ngay
        var userId = Guid.NewGuid();
        SetUser(userId);

        _serviceMock.Setup(s => s.RecordPlayAsync(
                "key-001", userId, It.IsAny<RecordPlayRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var result = await _sut.RecordPlay("key-001",
            new RecordPlayRequest(Guid.NewGuid(), 180, 120, "web"));

        var accepted = result.Should().BeOfType<ObjectResult>().Subject;
        accepted.StatusCode.Should().Be(202);

        var body = accepted.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Success.Should().BeTrue();
        body.Error.Should().BeNull();
    }

    [Fact]
    public async Task RecordPlay_DuplicateIdempotencyKey_Returns409_AC4_1_3()
    {
        // AC4.1.3: duplicate → 409 IDEMPOTENCY_CONFLICT
        var userId = Guid.NewGuid();
        SetUser(userId);

        _serviceMock.Setup(s => s.RecordPlayAsync(
                "dup-key", userId, It.IsAny<RecordPlayRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await _sut.RecordPlay("dup-key",
            new RecordPlayRequest(Guid.NewGuid(), 180, 120, "web"));

        var conflict = result.Should().BeOfType<ConflictObjectResult>().Subject;
        conflict.StatusCode.Should().Be(409);

        var body = conflict.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Error!.Code.Should().Be("IDEMPOTENCY_CONFLICT");
    }

    [Fact]
    public async Task RecordPlay_MissingIdempotencyKey_Returns400()
    {
        SetUser(Guid.NewGuid());
        var result = await _sut.RecordPlay(null,
            new RecordPlayRequest(Guid.NewGuid(), 180, 120, "web"));

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.Value.Should().BeOfType<ApiResponse<object>>()
            .Which.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task RecordPlay_MissingBody_Returns400()
    {
        SetUser(Guid.NewGuid());
        var result = await _sut.RecordPlay("key-001", null);

        result.Should().BeOfType<BadRequestObjectResult>()
            .Which.Value.Should().BeOfType<ApiResponse<object>>()
            .Which.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    // ── GET /analytics/creator/heatmap/{songId} ───────────────────────

    [Fact]
    public async Task GetHeatmap_AdminRole_BypassesOwnershipCheck_AC4_2_3()
    {
        // Admin bypasses ownership check entirely
        var songId = Guid.NewGuid();
        SetUser(Guid.NewGuid(), "Admin");

        _serviceMock.Setup(s => s.GetHeatmapAsync(songId, "7d", It.IsAny<CancellationToken>()))
            .ReturnsAsync((new HeatmapResponse([new HeatmapPoint(30, 5)]), false));

        var result = await _sut.GetHeatmap(songId);

        result.Should().BeOfType<OkObjectResult>()
            .Which.StatusCode.Should().Be(200);

        _serviceMock.Verify(s => s.VerifyOwnershipAsync(
            It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetHeatmap_CreatorOwnsSOng_Returns200_AC4_2_1()
    {
        // AC4.2.1: Creator xem heatmap → data theo từng giây
        var songId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        SetUser(userId, "Creator");

        _serviceMock.Setup(s => s.VerifyOwnershipAsync(songId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _serviceMock.Setup(s => s.GetHeatmapAsync(songId, "7d", It.IsAny<CancellationToken>()))
            .ReturnsAsync((new HeatmapResponse([new HeatmapPoint(30, 5)]), false));

        var result = await _sut.GetHeatmap(songId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);

        var body = ok.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Success.Should().BeTrue();
        body.Meta.Cache.Should().Be("MISS");
    }

    [Fact]
    public async Task GetHeatmap_CreatorDoesNotOwnSong_Returns403_AC4_2_3()
    {
        // AC4.2.3: non-owner Creator → 403 FORBIDDEN
        var songId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        SetUser(userId, "Creator");

        _serviceMock.Setup(s => s.VerifyOwnershipAsync(songId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await _sut.GetHeatmap(songId);

        var forbidden = result.Should().BeOfType<ObjectResult>().Subject;
        forbidden.StatusCode.Should().Be(403);

        var body = forbidden.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Error!.Code.Should().Be("FORBIDDEN");
    }

    [Fact]
    public async Task GetHeatmap_SongNotFound_Returns404()
    {
        var songId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        SetUser(userId, "Creator");

        _serviceMock.Setup(s => s.VerifyOwnershipAsync(songId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((bool?)null);

        var result = await _sut.GetHeatmap(songId);

        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        notFound.Value.Should().BeOfType<ApiResponse<object>>()
            .Which.Error!.Code.Should().Be("SONG_NOT_FOUND");
    }

    [Fact]
    public async Task GetHeatmap_CacheHit_ReturnsCacheHitMeta_AC4_2_4()
    {
        // AC4.2.4: second call → meta.cache = "HIT"
        var songId = Guid.NewGuid();
        SetUser(Guid.NewGuid(), "Admin");

        _serviceMock.Setup(s => s.GetHeatmapAsync(songId, "7d", It.IsAny<CancellationToken>()))
            .ReturnsAsync((new HeatmapResponse([]), true));

        var result = await _sut.GetHeatmap(songId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Meta.Cache.Should().Be("HIT");
    }

    [Fact]
    public async Task GetHeatmap_InvalidTimeRange_Returns400()
    {
        SetUser(Guid.NewGuid(), "Admin");

        var result = await _sut.GetHeatmap(Guid.NewGuid(), "90d");

        result.Should().BeOfType<BadRequestObjectResult>()
            .Which.Value.Should().BeOfType<ApiResponse<object>>()
            .Which.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    // ── GET /analytics/creator/stats/{songId} ─────────────────────────

    [Fact]
    public async Task GetStats_AdminRole_Returns200_AC4_2_2()
    {
        // AC4.2.2: Dashboard có DAL và Unique Users
        var songId = Guid.NewGuid();
        SetUser(Guid.NewGuid(), "Admin");

        _serviceMock.Setup(s => s.GetStatsAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new StatsResponse(100, 20, 80, 75.5, []), false));

        var result = await _sut.GetStats(songId);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);

        var body = ok.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Success.Should().BeTrue();
    }

    [Fact]
    public async Task GetStats_CreatorOwner_Returns200()
    {
        var songId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        SetUser(userId, "Creator");

        _serviceMock.Setup(s => s.VerifyOwnershipAsync(songId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _serviceMock.Setup(s => s.GetStatsAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new StatsResponse(50, 10, 40, 68.0, []), false));

        var result = await _sut.GetStats(songId);

        result.Should().BeOfType<OkObjectResult>().Which.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task GetStats_NonOwnerCreator_Returns403_AC4_2_3()
    {
        var songId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        SetUser(userId, "Creator");

        _serviceMock.Setup(s => s.VerifyOwnershipAsync(songId, userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await _sut.GetStats(songId);

        result.Should().BeOfType<ObjectResult>().Which.StatusCode.Should().Be(403);
    }
}
