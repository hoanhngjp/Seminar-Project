using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MusicService.Domain.Models;
using MusicService.Infrastructure.Data;

namespace MusicService.IntegrationTests;

/// <summary>
/// Integration tests for GET /api/v1/music/songs/{songId}.
/// Auth: GatewayAuth (X-User-Id + X-User-Role headers).
/// DB: native postgres music_db (tables must already exist from migration).
/// Each test seeds and cleans up its own data.
/// </summary>
public class SongsControllerIntegrationTests : IClassFixture<MusicWebApplicationFactory>, IAsyncLifetime
{
    private readonly MusicWebApplicationFactory _factory;
    private readonly HttpClient _authedClient;
    private readonly HttpClient _anonClient;
    private Guid? _seededSongId;
    private Guid? _seededArtistId;

    public SongsControllerIntegrationTests(MusicWebApplicationFactory factory)
    {
        _factory = factory;
        _authedClient = factory.CreateAuthorizedClient();
        _anonClient = factory.CreateClient();
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        // Clean up seeded data to keep DB clean for next run
        if (_seededSongId.HasValue || _seededArtistId.HasValue)
        {
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<MusicDbContext>();
            if (_seededSongId.HasValue)
            {
                var song = await db.Songs.FindAsync(_seededSongId.Value);
                if (song != null) db.Songs.Remove(song);
            }
            if (_seededArtistId.HasValue)
            {
                var artist = await db.Artists.FindAsync(_seededArtistId.Value);
                if (artist != null) db.Artists.Remove(artist);
            }
            await db.SaveChangesAsync();
        }
    }

    // ----------------------------------------------------------------
    // GET /api/v1/music/songs/{songId} — happy path
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetSong_WithValidId_Returns200WithSongData_AndCacheMiss()
    {
        // AC: GET song metadata, cache miss (NoOpCache always returns null)
        var songId = await SeedSongAsync("Integration Song");

        var response = await _authedClient.GetAsync($"/api/v1/music/songs/{songId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeTrue();
        body.GetProperty("data").GetProperty("id").GetString().Should().Be(songId.ToString());
        body.GetProperty("data").GetProperty("title").GetString().Should().Be("Integration Song");
        body.GetProperty("error").ValueKind.Should().Be(JsonValueKind.Null);
        body.GetProperty("meta").GetProperty("apiVersion").GetString().Should().Be("v1");
        body.GetProperty("meta").GetProperty("cache").GetString().Should().Be("MISS");
    }

    // ----------------------------------------------------------------
    // GET /api/v1/music/songs/{songId} — not found
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetSong_WithNonExistentId_Returns404_SONG_NOT_FOUND()
    {
        // AC: 404 SONG_NOT_FOUND for unknown songId
        var response = await _authedClient.GetAsync($"/api/v1/music/songs/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeFalse();
        body.GetProperty("error").GetProperty("code").GetString().Should().Be("SONG_NOT_FOUND");
        body.GetProperty("data").ValueKind.Should().Be(JsonValueKind.Null);
        body.GetProperty("meta").GetProperty("apiVersion").GetString().Should().Be("v1");
    }

    // ----------------------------------------------------------------
    // GET /api/v1/music/songs/{songId} — unauthorized
    // ----------------------------------------------------------------

    [Fact]
    public async Task GetSong_WithoutGatewayHeaders_Returns401()
    {
        // AC: UNAUTHORIZED — missing X-User-Id header (GatewayAuth fails)
        var response = await _anonClient.GetAsync($"/api/v1/music/songs/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private async Task<Guid> SeedSongAsync(string title)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MusicDbContext>();

        _seededArtistId = Guid.NewGuid();
        db.Artists.Add(new Artist
        {
            Id = _seededArtistId.Value,
            UserId = Guid.NewGuid(),
            StageName = "Integration Test Artist"
        });

        _seededSongId = Guid.NewGuid();
        db.Songs.Add(new Song
        {
            Id = _seededSongId.Value,
            ArtistId = _seededArtistId.Value,
            Title = title,
            S3AudioKey = $"songs/{_seededSongId.Value}/audio.mp3",
            IsPublished = true,
            DurationSec = 180
        });

        await db.SaveChangesAsync();
        return _seededSongId.Value;
    }
}
