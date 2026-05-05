using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using MusicService.Application.DTOs;
using MusicService.Application.Interfaces;
using MusicService.Application.Services;
using MusicService.Domain.Models;

namespace MusicService.UnitTests;

public class SongServiceGetTests
{
    private readonly Mock<IMusicRepository> _repoMock = new();
    private readonly Mock<IStorageService> _storageMock = new();
    private readonly Mock<IEventPublisher> _publisherMock = new();
    private readonly Mock<ISongCache> _cacheMock = new();
    private readonly SongService _sut;

    public SongServiceGetTests()
    {
        _sut = new SongService(
            _repoMock.Object,
            _storageMock.Object,
            _publisherMock.Object,
            _cacheMock.Object,
            NullLogger<SongService>.Instance);
    }

    // ----------------------------------------------------------------
    // GetSongAsync — cache hit
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetSong_WhenCacheHit_ReturnsCachedData_AndSkipsDb()
    {
        // Arrange
        var songId = Guid.NewGuid();
        var cached = BuildSongDto(songId);
        _cacheMock.Setup(c => c.GetAsync(songId, It.IsAny<CancellationToken>()))
                  .ReturnsAsync(cached);

        // Act
        var (result, hit) = await _sut.GetSongAsync(songId);

        // Assert
        hit.Should().BeTrue();
        result.Should().Be(cached);
        _repoMock.Verify(r => r.GetSongByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ----------------------------------------------------------------
    // GetSongAsync — cache miss → DB hit → populate cache
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetSong_WhenCacheMiss_QueriesDb_AndPopulatesCache()
    {
        // Arrange
        var songId = Guid.NewGuid();
        var song = BuildSong(songId);

        _cacheMock.Setup(c => c.GetAsync(songId, It.IsAny<CancellationToken>()))
                  .ReturnsAsync((SongResponseDto?)null);
        _repoMock.Setup(r => r.GetSongByIdAsync(songId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(song);

        // Act
        var (result, hit) = await _sut.GetSongAsync(songId);

        // Assert
        hit.Should().BeFalse();
        result.Id.Should().Be(songId);
        result.Title.Should().Be(song.Title);

        _cacheMock.Verify(c => c.SetAsync(songId, It.IsAny<SongResponseDto>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    // ----------------------------------------------------------------
    // GetSongAsync — not found
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetSong_WhenNotFoundInCacheAndDb_ThrowsKeyNotFoundException()
    {
        // Arrange
        var songId = Guid.NewGuid();
        _cacheMock.Setup(c => c.GetAsync(songId, It.IsAny<CancellationToken>()))
                  .ReturnsAsync((SongResponseDto?)null);
        _repoMock.Setup(r => r.GetSongByIdAsync(songId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync((Song?)null);

        // Act
        var act = () => _sut.GetSongAsync(songId);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage($"*{songId}*");
    }

    // ----------------------------------------------------------------
    // GetSongStorageKeyAsync
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetStorageKey_WhenSongExists_ReturnsKeyAndBucket()
    {
        // Arrange
        var songId = Guid.NewGuid();
        var song = BuildSong(songId);
        const string bucket = "smartmusic-audio";

        _repoMock.Setup(r => r.GetSongByIdAsync(songId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(song);
        _storageMock.Setup(s => s.BucketName).Returns(bucket);

        // Act
        var result = await _sut.GetSongStorageKeyAsync(songId);

        // Assert
        result.StorageKey.Should().Be(song.S3AudioKey);
        result.Bucket.Should().Be(bucket);
    }

    [Fact]
    public async Task GetStorageKey_WhenSongNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        var songId = Guid.NewGuid();
        _repoMock.Setup(r => r.GetSongByIdAsync(songId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync((Song?)null);

        // Act
        var act = () => _sut.GetSongStorageKeyAsync(songId);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>();
    }

    // ----------------------------------------------------------------
    // GetSongsBatchAsync — returns only existing IDs
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetBatch_WithMixedExistingAndMissingIds_ReturnsOnlyExisting()
    {
        // Arrange
        var id1 = Guid.NewGuid();
        var id2 = Guid.NewGuid();
        var idMissing = Guid.NewGuid();

        var songs = new List<Song> { BuildSong(id1), BuildSong(id2) };
        _repoMock.Setup(r => r.GetSongsByIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(songs);

        // Act
        var result = await _sut.GetSongsBatchAsync(new[] { id1, id2, idMissing });

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(s => s.Id == id1);
        result.Should().Contain(s => s.Id == id2);
        result.Should().NotContain(s => s.Id == idMissing);
    }

    [Fact]
    public async Task GetBatch_WithEmptyInput_ReturnsEmptyList()
    {
        // Arrange
        _repoMock.Setup(r => r.GetSongsByIdsAsync(
                It.IsAny<IEnumerable<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Song>());

        // Act
        var result = await _sut.GetSongsBatchAsync(Array.Empty<Guid>());

        // Assert
        result.Should().BeEmpty();
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private static Song BuildSong(Guid id) => new()
    {
        Id = id,
        Title = $"Song {id}",
        S3AudioKey = $"songs/{id}/audio.mp3",
        ArtistId = Guid.NewGuid(),
        Artist = new Artist
        {
            Id = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            StageName = "Test Artist"
        },
        SongGenres = new List<SongGenre>()
    };

    private static SongResponseDto BuildSongDto(Guid id) => new(
        id,
        $"Song {id}",
        new ArtistSummaryDto(Guid.NewGuid(), "Test Artist"),
        null,
        180,
        null,
        false,
        DateTimeOffset.UtcNow
    );
}
