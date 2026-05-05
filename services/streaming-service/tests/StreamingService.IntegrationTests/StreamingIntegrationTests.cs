using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Moq;
using StreamingService.Application.Interfaces;

namespace StreamingService.IntegrationTests;

public class StreamingIntegrationTests : IClassFixture<StreamingWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly StreamingWebApplicationFactory _factory;

    // Fake gateway headers — simulate API Gateway forwarding auth
    private static readonly string FakeUserId = Guid.NewGuid().ToString();
    private const string FakeRole = "Listener";

    public StreamingIntegrationTests(StreamingWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Add("X-User-Id", FakeUserId);
        _client.DefaultRequestHeaders.Add("X-User-Role", FakeRole);
    }

    // ----------------------------------------------------------------
    // GET /api/v1/streaming/{songId}/url — happy path (AC3.1.3)
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetStreamUrl_WithValidSong_Returns200AndUrlWithExpiry900_AC3_1_3()
    {
        // AC3.1.3: pre-signed URL expiry = 15 minutes (900s)
        var songId = Guid.NewGuid();

        _factory.MusicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageKeyResult("songs/abc/audio.mp3", "smartmusic-audio"));

        _factory.PresignerMock
            .Setup(p => p.GeneratePresignedUrlAsync("smartmusic-audio", "songs/abc/audio.mp3", It.IsAny<CancellationToken>()))
            .ReturnsAsync($"https://minio.local/smartmusic-audio/songs/abc/audio.mp3?X-Amz-Expires=900&X-Amz-SignedHeaders=host");

        var response = await _client.GetAsync($"/api/v1/streaming/{songId}/url");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponseBody>();
        body!.Success.Should().BeTrue();
        body.Error.Should().BeNull();
        body.Data.Should().NotBeNull();
        body.Data!.Value.GetProperty("expiresIn").GetInt32().Should().Be(900);
        body.Data.Value.GetProperty("url").GetString().Should().Contain("X-Amz-Expires=900");
    }

    [Fact]
    public async Task GetStreamUrl_WithoutAuthHeaders_Returns401()
    {
        var clientNoAuth = _factory.CreateClient();
        var songId = Guid.NewGuid();

        var response = await clientNoAuth.GetAsync($"/api/v1/streaming/{songId}/url");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetStreamUrl_WhenSongNotFound_Returns404_SONG_NOT_FOUND()
    {
        var songId = Guid.NewGuid();
        _factory.MusicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException($"Song {songId} not found."));

        var response = await _client.GetAsync($"/api/v1/streaming/{songId}/url");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadFromJsonAsync<ApiResponseBody>();
        body!.Success.Should().BeFalse();
        body.Error.Should().NotBeNull();
        body.Error!.Code.Should().Be("SONG_NOT_FOUND");
    }

    [Fact]
    public async Task GetStreamUrl_WhenMusicServiceFails_Returns503_SERVICE_UNAVAILABLE()
    {
        var songId = Guid.NewGuid();
        _factory.MusicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Music service unavailable."));

        var response = await _client.GetAsync($"/api/v1/streaming/{songId}/url");

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        var body = await response.Content.ReadFromJsonAsync<ApiResponseBody>();
        body!.Error!.Code.Should().Be("SERVICE_UNAVAILABLE");
    }

    // ----------------------------------------------------------------
    // GET /api/v1/streaming/{songId}/chunk — AC3.1.2
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetChunk_WithRangeHeader_Returns206PartialContent_AC3_1_2()
    {
        // AC3.1.2: Range header → 206 with correct byte range
        var songId = Guid.NewGuid();
        var audioBytes = new byte[4096];
        new Random(42).NextBytes(audioBytes);

        _factory.MusicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageKeyResult("songs/abc/audio.mp3", "smartmusic-audio"));

        _factory.PresignerMock
            .Setup(p => p.GetRangeAsync("smartmusic-audio", "songs/abc/audio.mp3", 0L, 1023L, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageRangeResult(
                new MemoryStream(audioBytes[..1024]),
                "bytes 0-1023/4096",
                4096,
                "audio/mpeg",
                true));

        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/streaming/{songId}/chunk");
        request.Headers.Add("Range", "bytes=0-1023");
        request.Headers.Add("X-User-Id", FakeUserId);
        request.Headers.Add("X-User-Role", FakeRole);

        var response = await _factory.CreateClient().SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.PartialContent);
        response.Content.Headers.ContentType?.MediaType.Should().Be("audio/mpeg");
        // Content-Range is a content header (RFC 7233)
        response.Content.Headers.Should().ContainKey("Content-Range");
        var content = await response.Content.ReadAsByteArrayAsync();
        content.Should().HaveCount(1024);
    }

    [Fact]
    public async Task GetChunk_WithoutRangeHeader_Returns200FullContent()
    {
        var songId = Guid.NewGuid();
        var audioBytes = new byte[2048];

        _factory.MusicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageKeyResult("songs/abc/audio.mp3", "smartmusic-audio"));

        _factory.PresignerMock
            .Setup(p => p.GetRangeAsync("smartmusic-audio", "songs/abc/audio.mp3", null, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageRangeResult(
                new MemoryStream(audioBytes),
                "bytes 0-2047/2048",
                2048,
                "audio/mpeg",
                false));

        var response = await _client.GetAsync($"/api/v1/streaming/{songId}/chunk");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var content = await response.Content.ReadAsByteArrayAsync();
        content.Should().HaveCount(2048);
    }

    [Fact]
    public async Task GetChunk_WhenSongNotFound_Returns404()
    {
        var songId = Guid.NewGuid();
        _factory.MusicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException());

        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/streaming/{songId}/chunk");
        request.Headers.Add("Range", "bytes=0-1023");
        request.Headers.Add("X-User-Id", FakeUserId);
        request.Headers.Add("X-User-Role", FakeRole);

        var response = await _factory.CreateClient().SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetChunk_WithInvalidRangeHeader_Returns416()
    {
        var songId = Guid.NewGuid();
        var request = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/streaming/{songId}/chunk");
        // TryAddWithoutValidation bypasses HttpClient Range header format validation
        request.Headers.TryAddWithoutValidation("Range", "invalid-range");
        request.Headers.TryAddWithoutValidation("X-User-Id", FakeUserId);
        request.Headers.TryAddWithoutValidation("X-User-Role", FakeRole);

        var response = await _factory.CreateClient().SendAsync(request);

        response.StatusCode.Should().Be((HttpStatusCode)416);
    }
}

// Minimal deserialization helpers — avoid pulling in ApiResponse<T> from Api project
file class ApiResponseBody
{
    public bool Success { get; set; }
    public System.Text.Json.JsonElement? Data { get; set; }
    public ApiErrorBody? Error { get; set; }
}

file class ApiErrorBody
{
    public string? Code { get; set; }
    public string? Message { get; set; }
}
