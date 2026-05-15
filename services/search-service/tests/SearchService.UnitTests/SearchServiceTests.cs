using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using SearchService.Application.DTOs;
using SearchService.Application.Interfaces;
using Xunit;

namespace SearchService.UnitTests;

public class SearchServiceTests
{
    private readonly Mock<ISearchRepository> _repoMock = new();
    private readonly Mock<ISearchCache> _cacheMock = new();
    private readonly SearchService.Application.Services.SearchService _sut;

    public SearchServiceTests()
    {
        _sut = new SearchService.Application.Services.SearchService(
            _repoMock.Object,
            _cacheMock.Object,
            NullLogger<SearchService.Application.Services.SearchService>.Instance);
    }

    // ── Cache miss path ──────────────────────────────────────────────

    [Fact]
    public async Task SearchAsync_CacheMiss_CallsRepositoryAndCaches()
    {
        // AC5.1.1: query reaches Elasticsearch when no cache hit
        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((null as SearchResponse, false));

        var fakeResult = new SearchResponse(
            [new SearchItem("song-001", "song", "Noi Nay Co Anh", "Son Tung M-TP", null, null, 9.5)],
            null, false);

        _repoMock.Setup(r => r.SearchAsync("son tug", "all", 10, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fakeResult);

        _cacheMock.Setup(c => c.SetAsync(It.IsAny<string>(), fakeResult, It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var (result, cacheHit) = await _sut.SearchAsync("son tug", "all", 10, null, CancellationToken.None);

        cacheHit.Should().BeFalse();
        result.Items.Should().HaveCount(1);
        result.Items[0].Name.Should().Be("Noi Nay Co Anh");
        _repoMock.Verify(r => r.SearchAsync("son tug", "all", 10, 0, It.IsAny<CancellationToken>()), Times.Once);
        _cacheMock.Verify(c => c.SetAsync(It.IsAny<string>(), fakeResult, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SearchAsync_CacheHit_DoesNotCallRepository()
    {
        // AC5.1.2: cache hit avoids Elasticsearch call
        var cached = new SearchResponse(
            [new SearchItem("song-002", "song", "Lac Troi", "Son Tung M-TP", null, null, 8.0)],
            null, false);

        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((cached, true));

        var (result, cacheHit) = await _sut.SearchAsync("son tug", "all", 10, null, CancellationToken.None);

        cacheHit.Should().BeTrue();
        result.Items.Should().HaveCount(1);
        _repoMock.Verify(r => r.SearchAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ── AC5.1.3: no results → empty list, not error ──────────────────

    [Fact]
    public async Task SearchAsync_NoResults_ReturnsEmptyList_AC5_1_3()
    {
        // AC5.1.3: "xyznonexistent" → [] not error
        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((null as SearchResponse, false));

        _repoMock.Setup(r => r.SearchAsync("xyznonexistent", "all", 10, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SearchResponse([], null, false));

        _cacheMock.Setup(c => c.SetAsync(It.IsAny<string>(), It.IsAny<SearchResponse>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var (result, _) = await _sut.SearchAsync("xyznonexistent", "all", 10, null, CancellationToken.None);

        result.Items.Should().BeEmpty();
        result.HasMore.Should().BeFalse();
        result.NextCursor.Should().BeNull();
    }

    // ── Elasticsearch timeout → fallback [] ──────────────────────────

    [Fact]
    public async Task SearchAsync_ElasticsearchTimeout_ReturnsFallbackEmpty()
    {
        // AC5.1.3: timeout → [] not 503
        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((null as SearchResponse, false));

        _repoMock.Setup(r => r.SearchAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OperationCanceledException());

        var (result, cacheHit) = await _sut.SearchAsync("q", "all", 10, null, CancellationToken.None);

        result.Items.Should().BeEmpty();
        result.HasMore.Should().BeFalse();
        cacheHit.Should().BeFalse();
    }

    [Fact]
    public async Task SearchAsync_ElasticsearchException_ReturnsFallbackEmpty()
    {
        // Any ES exception → [] not crash
        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((null as SearchResponse, false));

        _repoMock.Setup(r => r.SearchAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("ES unreachable"));

        var (result, _) = await _sut.SearchAsync("q", "all", 10, null, CancellationToken.None);

        result.Items.Should().BeEmpty();
    }

    // ── AC5.1.4: Cursor pagination ───────────────────────────────────

    [Fact]
    public async Task SearchAsync_WithCursor_PassesCorrectOffset_AC5_1_4()
    {
        // AC5.1.4: cursor decodes to offset, next call gets next page
        // cursor = base64("10") → offset 10
        var cursor = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("10"));

        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((null as SearchResponse, false));

        _repoMock.Setup(r => r.SearchAsync("ngot", "all", 5, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SearchResponse([], null, false));

        _cacheMock.Setup(c => c.SetAsync(It.IsAny<string>(), It.IsAny<SearchResponse>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await _sut.SearchAsync("ngot", "all", 5, cursor, CancellationToken.None);

        _repoMock.Verify(r => r.SearchAsync("ngot", "all", 5, 10, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SearchAsync_InvalidCursor_TreatsAsOffset0()
    {
        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((null as SearchResponse, false));

        _repoMock.Setup(r => r.SearchAsync("q", "all", 10, 0, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SearchResponse([], null, false));

        _cacheMock.Setup(c => c.SetAsync(It.IsAny<string>(), It.IsAny<SearchResponse>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await _sut.SearchAsync("q", "all", 10, "not-valid-base64!!!", CancellationToken.None);

        _repoMock.Verify(r => r.SearchAsync("q", "all", 10, 0, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ── Cache key uniqueness ─────────────────────────────────────────

    [Fact]
    public async Task SearchAsync_DifferentQueries_UseDifferentCacheKeys()
    {
        var capturedKeys = new List<string>();

        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Callback<string, CancellationToken>((k, _) => capturedKeys.Add(k))
            .ReturnsAsync((null as SearchResponse, false));

        _repoMock.Setup(r => r.SearchAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SearchResponse([], null, false));

        _cacheMock.Setup(c => c.SetAsync(It.IsAny<string>(), It.IsAny<SearchResponse>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await _sut.SearchAsync("ngot", "all", 10, null, CancellationToken.None);
        await _sut.SearchAsync("vu", "all", 10, null, CancellationToken.None);

        capturedKeys.Should().HaveCount(2);
        capturedKeys[0].Should().NotBe(capturedKeys[1]);
    }

    // ── Redis failure is non-fatal ───────────────────────────────────

    [Fact]
    public async Task SearchAsync_RedisGetFails_StillCallsRepository()
    {
        _cacheMock.Setup(c => c.GetAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Redis down"));

        _repoMock.Setup(r => r.SearchAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new SearchResponse([], null, false));

        _cacheMock.Setup(c => c.SetAsync(It.IsAny<string>(), It.IsAny<SearchResponse>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Should not throw — Redis failure is non-fatal
        var act = async () => await _sut.SearchAsync("q", "all", 10, null, CancellationToken.None);

        await act.Should().NotThrowAsync();
    }
}
