using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MusicService.Domain.Models;
using MusicService.Infrastructure.Data;

namespace MusicService.IntegrationTests;

/// <summary>
/// Integration tests for internal endpoints — no auth required.
/// GET /internal/songs/{songId}/storage-key
/// GET /internal/songs/batch?ids=...
/// </summary>
public class InternalSongsControllerIntegrationTests : IClassFixture<MusicWebApplicationFactory>, IAsyncLifetime
{
    private readonly MusicWebApplicationFactory _factory;
    private readonly System.Net.Http.HttpClient _client;
    private readonly List<Guid> _seededArtistIds = new();
    private readonly List<Guid> _seededSongIds = new();

    public InternalSongsControllerIntegrationTests(MusicWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MusicDbContext>();
        foreach (var id in _seededSongIds)
        {
            var song = await db.Songs.FindAsync(id);
            if (song != null) db.Songs.Remove(song);
        }
        foreach (var id in _seededArtistIds)
        {
            var artist = await db.Artists.FindAsync(id);
            if (artist != null) db.Artists.Remove(artist);
        }
        if (_seededSongIds.Count > 0 || _seededArtistIds.Count > 0)
            await db.SaveChangesAsync();
    }

    // ----------------------------------------------------------------
    // GET /internal/songs/{songId}/storage-key — happy path
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetStorageKey_WhenSongExists_Returns200WithKeyAndBucket()
    {
        var songId = await SeedSongAsync("storage-key-song");

        var response = await _client.GetAsync($"/internal/songs/{songId}/storage-key");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("storageKey").GetString().Should().Contain(songId.ToString());
        body.GetProperty("bucket").GetString().Should().Be("test-bucket");
    }

    // ----------------------------------------------------------------
    // GET /internal/songs/{songId}/storage-key — not found
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetStorageKey_WhenSongMissing_Returns404()
    {
        var response = await _client.GetAsync($"/internal/songs/{Guid.NewGuid()}/storage-key");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("error").GetString().Should().Be("SONG_NOT_FOUND");
    }

    // ----------------------------------------------------------------
    // GET /internal/songs/batch — returns existing songs only
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetBatch_WithExistingAndMissingIds_ReturnsOnlyExisting()
    {
        var id1 = await SeedSongAsync("batch-song-1");
        var id2 = await SeedSongAsync("batch-song-2");
        var missingId = Guid.NewGuid();

        var response = await _client.GetAsync($"/internal/songs/batch?ids={id1},{id2},{missingId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("songs").GetArrayLength().Should().Be(2);
    }

    // ----------------------------------------------------------------
    // GET /internal/songs/batch — empty ids
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetBatch_WithEmptyIds_Returns200WithEmptyList()
    {
        var response = await _client.GetAsync("/internal/songs/batch?ids=");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("songs").GetArrayLength().Should().Be(0);
    }

    // ----------------------------------------------------------------
    // GET /internal/songs/batch — no ids param (optional, returns empty)
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetBatch_WithNoIdsParam_Returns200WithEmptyList()
    {
        // ids param is missing entirely — should return 200 with empty list
        var response = await _client.GetAsync("/internal/songs/batch");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private async Task<Guid> SeedSongAsync(string title)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MusicDbContext>();

        var artistId = Guid.NewGuid();
        _seededArtistIds.Add(artistId);
        db.Artists.Add(new Artist
        {
            Id = artistId,
            UserId = Guid.NewGuid(),
            StageName = "Internal Test Artist"
        });

        var songId = Guid.NewGuid();
        _seededSongIds.Add(songId);
        db.Songs.Add(new Song
        {
            Id = songId,
            ArtistId = artistId,
            Title = title,
            S3AudioKey = $"songs/{songId}/audio.mp3",
            IsPublished = true
        });

        await db.SaveChangesAsync();
        return songId;
    }
}
