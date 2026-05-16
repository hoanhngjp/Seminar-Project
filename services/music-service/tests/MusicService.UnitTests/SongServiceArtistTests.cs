using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using MusicService.Application.Interfaces;
using MusicService.Application.Services;
using MusicService.Domain.Models;

namespace MusicService.UnitTests;

public class SongServiceArtistTests
{
    private readonly Mock<IMusicRepository> _repoMock = new();
    private readonly Mock<IStorageService> _storageMock = new();
    private readonly Mock<IEventPublisher> _publisherMock = new();
    private readonly Mock<ISongCache> _cacheMock = new();
    private readonly SongService _sut;

    public SongServiceArtistTests()
    {
        _sut = new SongService(
            _repoMock.Object,
            _storageMock.Object,
            _publisherMock.Object,
            _cacheMock.Object,
            NullLogger<SongService>.Instance);
    }

    // ── GetArtistAsync ───────────────────────────────────────────────

    [Fact]
    public async Task GetArtist_WhenFound_ReturnsArtistWithSongs()
    {
        var artistId = Guid.NewGuid();
        var artist = BuildArtist(artistId);
        var songs = new List<Song> { BuildSong(Guid.NewGuid(), artistId) };

        _repoMock.Setup(r => r.GetArtistByIdAsync(artistId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(artist);
        _repoMock.Setup(r => r.GetSongsByArtistIdAsync(artistId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(songs);

        var result = await _sut.GetArtistAsync(artistId);

        result.Id.Should().Be(artistId);
        result.StageName.Should().Be(artist.StageName);
        result.Songs.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetArtist_WhenNotFound_ThrowsKeyNotFoundException()
    {
        var artistId = Guid.NewGuid();
        _repoMock.Setup(r => r.GetArtistByIdAsync(artistId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync((Artist?)null);

        await _sut.Invoking(s => s.GetArtistAsync(artistId))
                  .Should().ThrowAsync<KeyNotFoundException>();
    }

    [Fact]
    public async Task GetArtist_WhenArtistHasNoSongs_ReturnsSongsEmpty()
    {
        var artistId = Guid.NewGuid();
        _repoMock.Setup(r => r.GetArtistByIdAsync(artistId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(BuildArtist(artistId));
        _repoMock.Setup(r => r.GetSongsByArtistIdAsync(artistId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new List<Song>());

        var result = await _sut.GetArtistAsync(artistId);

        result.Songs.Should().BeEmpty();
    }

    // ── GetMySongsAsync ───────────────────────────────────────────────

    [Fact]
    public async Task GetMySongs_WhenCreatorHasSongs_ReturnsAllSongs()
    {
        var userId = Guid.NewGuid();
        var artistId = Guid.NewGuid();
        var songs = new List<Song>
        {
            BuildSong(Guid.NewGuid(), artistId, userId),
            BuildSong(Guid.NewGuid(), artistId, userId),
        };

        _repoMock.Setup(r => r.GetSongsByCreatorUserIdAsync(userId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(songs);

        var result = await _sut.GetMySongsAsync(userId);

        result.Should().HaveCount(2);
        result[0].Title.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetMySongs_WhenCreatorHasNoSongs_ReturnsEmpty()
    {
        var userId = Guid.NewGuid();
        _repoMock.Setup(r => r.GetSongsByCreatorUserIdAsync(userId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(new List<Song>());

        var result = await _sut.GetMySongsAsync(userId);

        result.Should().BeEmpty();
    }

    // ── Helpers ─────────────────────────────────────────────────────

    private static Artist BuildArtist(Guid id) => new()
    {
        Id = id,
        UserId = Guid.NewGuid(),
        StageName = "Test Artist",
        TotalFollowers = 1000,
        TotalPlays = 50000
    };

    private static Song BuildSong(Guid id, Guid artistId, Guid? artistUserId = null) => new()
    {
        Id = id,
        Title = $"Song {id}",
        S3AudioKey = $"songs/{id}/audio.mp3",
        ArtistId = artistId,
        Artist = new Artist
        {
            Id = artistId,
            UserId = artistUserId ?? Guid.NewGuid(),
            StageName = "Test Artist"
        },
        SongGenres = new List<SongGenre>(),
        SongArtists = new List<SongArtist>()
    };
}
