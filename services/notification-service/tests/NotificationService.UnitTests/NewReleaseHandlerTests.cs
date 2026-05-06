using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NotificationService.Application.DTOs;
using NotificationService.Application.Services;
using NotificationService.Infrastructure.Kafka;

namespace NotificationService.UnitTests;

public class NewReleaseHandlerTests
{
    private readonly Mock<INotificationService> _serviceMock = new();
    private readonly NewReleaseHandler _sut;

    public NewReleaseHandlerTests()
    {
        _sut = new NewReleaseHandler(
            _serviceMock.Object,
            NullLogger<NewReleaseHandler>.Instance);
    }

    [Fact]
    public async Task HandleAsync_WithValidJson_CallsFanOut()
    {
        // Given a valid NewReleaseEvent JSON payload
        var artistId = Guid.NewGuid();
        var songId = Guid.NewGuid();
        var json = $$"""
        {
            "EventId": "{{Guid.NewGuid()}}",
            "Version": "v1",
            "Timestamp": "2026-05-06T10:00:00Z",
            "CorrelationId": "{{Guid.NewGuid()}}",
            "ArtistId": "{{artistId}}",
            "ArtistName": "Son Tung M-TP",
            "SongId": "{{songId}}",
            "SongTitle": "Chung Ta Cua Hien Tai",
            "AlbumId": null,
            "GenreIds": ["{{Guid.NewGuid()}}"],
            "ThumbnailUrl": "https://cdn.example.com/thumb.jpg",
            "S3StorageKey": "audio/2026/04/song.mp3",
            "DurationSec": 287,
            "Explicit": false
        }
        """;

        _serviceMock
            .Setup(s => s.FanOutNewReleaseAsync(It.IsAny<NewReleaseEventDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new FanOutResult(0));

        await _sut.HandleAsync(json, CancellationToken.None);

        _serviceMock.Verify(s =>
            s.FanOutNewReleaseAsync(
                It.Is<NewReleaseEventDto>(e => e.ArtistId == artistId.ToString()),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task HandleAsync_WithInvalidJson_ThrowsJsonException()
    {
        var act = () => _sut.HandleAsync("not-valid-json", CancellationToken.None);
        await act.Should().ThrowAsync<System.Text.Json.JsonException>();
    }

    [Fact]
    public async Task HandleAsync_WithNullPayload_SkipsWithoutException()
    {
        // "null" is valid JSON but deserializes to null — handler should skip gracefully
        await _sut.HandleAsync("null", CancellationToken.None);

        _serviceMock.Verify(s =>
            s.FanOutNewReleaseAsync(It.IsAny<NewReleaseEventDto>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
