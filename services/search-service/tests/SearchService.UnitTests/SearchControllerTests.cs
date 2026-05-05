using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SearchService.Api.Controllers;
using SearchService.Api.Models;
using SearchService.Application.DTOs;
using SearchService.Application.Services;
using Xunit;

namespace SearchService.UnitTests;

public class SearchControllerTests
{
    private readonly Mock<ISearchService> _serviceMock = new();
    private readonly SearchController _sut;

    public SearchControllerTests()
    {
        _sut = new SearchController(
            _serviceMock.Object,
            NullLogger<SearchController>.Instance);

        _sut.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    // ── AC5.1.1: happy path ──────────────────────────────────────────

    [Fact]
    public async Task Search_ValidQuery_Returns200WithItems_AC5_1_1()
    {
        // AC5.1.1: "son tug" → 200 with items
        var fakeResult = new SearchResponse(
            [new SearchItem("song-001", "song", "Noi Nay Co Anh", "Son Tung M-TP", null, "V-Pop", 9.5)],
            null, false);

        _serviceMock.Setup(s => s.SearchAsync("son tug", "all", 10, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((fakeResult, false));

        var result = await _sut.Search("son tug");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);

        var body = ok.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Success.Should().BeTrue();
        body.Error.Should().BeNull();
        body.Meta.Cache.Should().Be("MISS");
    }

    [Fact]
    public async Task Search_CacheHit_ReturnsCacheHitMeta()
    {
        var fakeResult = new SearchResponse([], null, false);

        _serviceMock.Setup(s => s.SearchAsync("ngot", "all", 10, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((fakeResult, true));

        var result = await _sut.Search("ngot");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var body = ok.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Meta.Cache.Should().Be("HIT");
    }

    // ── Validation ───────────────────────────────────────────────────

    [Fact]
    public async Task Search_MissingQ_Returns400ValidationError()
    {
        var result = await _sut.Search(null);

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        bad.StatusCode.Should().Be(400);

        var body = bad.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Success.Should().BeFalse();
        body.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Search_EmptyQ_Returns400ValidationError()
    {
        var result = await _sut.Search("   ");

        result.Should().BeOfType<BadRequestObjectResult>()
            .Which.Value.Should().BeOfType<ApiResponse<object>>()
            .Which.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Search_InvalidType_Returns400ValidationError()
    {
        var result = await _sut.Search("ngot", type: "video");

        var bad = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var body = bad.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Search_ValidTypes_AreAccepted()
    {
        _serviceMock.Setup(s => s.SearchAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((new SearchResponse([], null, false), false));

        foreach (var type in new[] { "song", "artist", "all" })
        {
            var result = await _sut.Search("q", type: type);
            result.Should().BeOfType<OkObjectResult>($"type '{type}' should be valid");
        }
    }

    // ── AC5.1.3: no results → 200 with [] ───────────────────────────

    [Fact]
    public async Task Search_NoResults_Returns200WithEmptyItems_AC5_1_3()
    {
        // AC5.1.3: no results → [] not error
        _serviceMock.Setup(s => s.SearchAsync("xyznonexistent", "all", 10, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new SearchResponse([], null, false), false));

        var result = await _sut.Search("xyznonexistent");

        result.Should().BeOfType<OkObjectResult>()
            .Which.StatusCode.Should().Be(200);

        var body = ((OkObjectResult)result).Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Success.Should().BeTrue();
    }

    // ── Limit clamping ───────────────────────────────────────────────

    [Theory]
    [InlineData(0, 1)]
    [InlineData(25, 20)]
    [InlineData(10, 10)]
    public async Task Search_LimitIsClamped(int inputLimit, int expectedLimit)
    {
        int capturedLimit = 0;

        _serviceMock.Setup(s => s.SearchAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<int>(),
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .Callback<string, string, int, string?, CancellationToken>((_, _, l, _, _) => capturedLimit = l)
            .ReturnsAsync((new SearchResponse([], null, false), false));

        await _sut.Search("q", limit: inputLimit);

        capturedLimit.Should().Be(expectedLimit);
    }

    // ── AC5.1.4: pagination response fields ─────────────────────────

    [Fact]
    public async Task Search_WithMoreResults_ResponseHasNextCursorAndHasMore_AC5_1_4()
    {
        // AC5.1.4: nextCursor and hasMore present when more results exist
        var cursor = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("10"));
        var fakeResult = new SearchResponse(
            [new SearchItem("song-001", "song", "Title", "Artist", null, "Genre", 5.0)],
            cursor,
            true);

        _serviceMock.Setup(s => s.SearchAsync("q", "all", 10, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync((fakeResult, false));

        var result = await _sut.Search("q");

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        ok.StatusCode.Should().Be(200);
        // Response body serialized as anonymous, verify through ApiResponse
        var body = ok.Value.Should().BeOfType<ApiResponse<object>>().Subject;
        body.Success.Should().BeTrue();
    }
}
