using FluentAssertions;
using Moq;
using StreamingService.Application.DTOs;
using StreamingService.Application.Interfaces;
using StreamingService.Application.Services;

namespace StreamingService.UnitTests;

public class StreamingServiceTests
{
    private readonly Mock<IMusicServiceClient> _musicClientMock = new();
    private readonly Mock<IStoragePresigner> _presignerMock = new();
    private readonly Application.Services.StreamingService _sut;

    public StreamingServiceTests()
    {
        _sut = new Application.Services.StreamingService(_musicClientMock.Object, _presignerMock.Object);
    }

    // ----------------------------------------------------------------
    // GetStreamUrlAsync — happy path (AC3.1.3)
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetStreamUrl_WithValidSong_ReturnsUrlAndExpiresIn900()
    {
        // AC3.1.3: pre-signed URL expiry = 900s
        var songId = Guid.NewGuid();
        _musicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageKeyResult("songs/abc/audio.mp3", "smartmusic-audio"));

        _presignerMock
            .Setup(p => p.GeneratePresignedUrlAsync("smartmusic-audio", "songs/abc/audio.mp3", It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://s3.example.com/songs/abc/audio.mp3?X-Amz-Expires=900");

        var result = await _sut.GetStreamUrlAsync(songId, CancellationToken.None);

        result.Url.Should().Contain("X-Amz-Expires=900");
        result.ExpiresIn.Should().Be(900);
    }

    [Fact]
    public async Task GetStreamUrl_WhenSongNotFound_ThrowsKeyNotFoundException()
    {
        var songId = Guid.NewGuid();
        _musicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException($"Song {songId} not found."));

        var act = async () => await _sut.GetStreamUrlAsync(songId, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task GetStreamUrl_WhenMusicServiceUnavailable_ThrowsInvalidOperationException()
    {
        var songId = Guid.NewGuid();
        _musicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Music service unavailable."));

        var act = async () => await _sut.GetStreamUrlAsync(songId, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task GetStreamUrl_CallsMusicClientAndPresignerWithCorrectArgs()
    {
        var songId = Guid.NewGuid();
        _musicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageKeyResult("songs/abc/audio.mp3", "my-bucket"));

        _presignerMock
            .Setup(p => p.GeneratePresignedUrlAsync("my-bucket", "songs/abc/audio.mp3", It.IsAny<CancellationToken>()))
            .ReturnsAsync("https://url");

        await _sut.GetStreamUrlAsync(songId, CancellationToken.None);

        _musicClientMock.Verify(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()), Times.Once);
        _presignerMock.Verify(p => p.GeneratePresignedUrlAsync("my-bucket", "songs/abc/audio.mp3", It.IsAny<CancellationToken>()), Times.Once);
    }

    // ----------------------------------------------------------------
    // GetChunkAsync — happy path (AC3.1.2)
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetChunk_WithRangeHeader_Returns206ChunkResult()
    {
        // AC3.1.2: Range header → 206 with correct byte range
        var songId = Guid.NewGuid();
        var fakeStream = new MemoryStream(new byte[1024]);

        _musicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageKeyResult("songs/abc/audio.mp3", "smartmusic-audio"));

        _presignerMock
            .Setup(p => p.GetRangeAsync("smartmusic-audio", "songs/abc/audio.mp3", 0L, 1023L, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageRangeResult(fakeStream, "bytes 0-1023/4096", 4096, "audio/mpeg", true));

        var result = await _sut.GetChunkAsync(songId, 0, 1023, CancellationToken.None);

        result.IsPartial.Should().BeTrue();
        result.ContentRange.Should().Be("bytes 0-1023/4096");
        result.TotalBytes.Should().Be(4096);
        result.ContentType.Should().Be("audio/mpeg");
    }

    [Fact]
    public async Task GetChunk_WithoutRange_ReturnsFullContent()
    {
        var songId = Guid.NewGuid();
        var fakeStream = new MemoryStream(new byte[4096]);

        _musicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageKeyResult("songs/abc/audio.mp3", "smartmusic-audio"));

        _presignerMock
            .Setup(p => p.GetRangeAsync("smartmusic-audio", "songs/abc/audio.mp3", null, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StorageRangeResult(fakeStream, "bytes 0-4095/4096", 4096, "audio/mpeg", false));

        var result = await _sut.GetChunkAsync(songId, null, null, CancellationToken.None);

        result.IsPartial.Should().BeFalse();
    }

    [Fact]
    public async Task GetChunk_WhenSongNotFound_ThrowsKeyNotFoundException()
    {
        var songId = Guid.NewGuid();
        _musicClientMock
            .Setup(c => c.GetStorageKeyAsync(songId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException($"Song {songId} not found."));

        var act = async () => await _sut.GetChunkAsync(songId, 0, 1023, CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }
}
