using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using MusicService.Application.DTOs;
using MusicService.Application.Interfaces;
using MusicService.Domain.Events;
using MusicService.Domain.Models;

namespace MusicService.Application.Services;

public class SongService : ISongService
{
    private readonly IMusicRepository _repository;
    private readonly IStorageService _storageService;
    private readonly IEventPublisher _eventPublisher;
    private readonly ISongCache _cache;
    private readonly ILogger<SongService> _logger;

    public SongService(
        IMusicRepository repository,
        IStorageService storageService,
        IEventPublisher eventPublisher,
        ISongCache cache,
        ILogger<SongService> logger)
    {
        _repository = repository;
        _storageService = storageService;
        _eventPublisher = eventPublisher;
        _cache = cache;
        _logger = logger;
    }

    public async Task<Song> UploadSongAsync(Guid userId, UploadSongDto dto, CancellationToken cancellationToken = default)
    {
        ValidateFile(dto.AudioStream, dto.Length, dto.ContentType);

        var artist = await _repository.GetArtistByUserIdAsync(userId, cancellationToken)
            ?? throw new InvalidOperationException("Creator profile not found.");

        var genreGuidIds = dto.GenreIds.Select(Guid.Parse).ToList();
        var genres = await _repository.GetGenresByIdsAsync(genreGuidIds, cancellationToken);
        if (genres.Count != genreGuidIds.Count)
            throw new InvalidOperationException("One or more genres are invalid.");

        var songId = Guid.NewGuid();
        var storageKey = $"songs/{songId}/audio{Path.GetExtension(dto.FileName)}";

        var song = new Song
        {
            Id = songId,
            ArtistId = artist.Id,
            Title = dto.Title,
            Language = dto.Language,
            IsExplicit = dto.IsExplicit,
            S3AudioKey = storageKey,
            IsPublished = false,
            DurationSec = 0
        };

        foreach (var genre in genres)
            song.SongGenres.Add(new SongGenre { SongId = song.Id, GenreId = genre.Id });

        // S3 upload with 3-attempt exponential backoff (1s, 2s, 4s)
        for (int attempt = 0; attempt < 3; attempt++)
        {
            try
            {
                _logger.LogInformation("Uploading song {SongId} to S3 (attempt {Attempt})", songId, attempt + 1);
                if (dto.AudioStream.CanSeek) dto.AudioStream.Position = 0;
                await _storageService.UploadFileAsync(storageKey, dto.AudioStream, dto.ContentType, cancellationToken);
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "S3 upload attempt {Attempt} failed for song {SongId}", attempt + 1, songId);
                if (attempt == 2)
                    throw new InvalidOperationException("Failed to upload file to storage service after max retries.", ex);
                await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)), cancellationToken);
            }
        }

        // Commit metadata to DB only after S3 succeeds
        try
        {
            await _repository.AddSongAsync(song, cancellationToken);
            await _repository.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "DB commit failed for song {SongId}. Rolling back S3 upload.", songId);
            await _storageService.DeleteFileAsync(storageKey, CancellationToken.None);
            throw new InvalidOperationException("Failed to save song metadata to database.", ex);
        }

        // Publish Kafka event — non-fatal if it fails
        try
        {
            await _eventPublisher.PublishNewReleaseAsync(new NewReleaseEvent
            {
                CorrelationId = Guid.NewGuid().ToString(),
                ArtistId = artist.UserId.ToString(),
                ArtistName = artist.StageName,
                SongId = song.Id.ToString(),
                SongTitle = song.Title,
                GenreIds = dto.GenreIds,
                S3StorageKey = storageKey,
                Explicit = song.IsExplicit,
                ThumbnailUrl = artist.ProfileImageUrl ?? string.Empty,
                DurationSec = song.DurationSec
            }, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish NewReleaseEvent for song {SongId}. Entity saved.", songId);
        }

        return song;
    }

    public async Task<(SongResponseDto Song, bool CacheHit)> GetSongAsync(Guid songId, CancellationToken cancellationToken = default)
    {
        var cached = await _cache.GetAsync(songId, cancellationToken);
        if (cached != null)
            return (cached, true);

        var song = await _repository.GetSongByIdAsync(songId, cancellationToken)
            ?? throw new KeyNotFoundException($"Song {songId} not found.");

        var dto = MapToResponseDto(song);
        await _cache.SetAsync(songId, dto, cancellationToken);
        return (dto, false);
    }

    public async Task<SongStorageKeyDto> GetSongStorageKeyAsync(Guid songId, CancellationToken cancellationToken = default)
    {
        var song = await _repository.GetSongByIdAsync(songId, cancellationToken)
            ?? throw new KeyNotFoundException($"Song {songId} not found.");

        return new SongStorageKeyDto(song.S3AudioKey, _storageService.BucketName);
    }

    public async Task<List<BatchSongDto>> GetSongsBatchAsync(IEnumerable<Guid> songIds, CancellationToken cancellationToken = default)
    {
        var songs = await _repository.GetSongsByIdsAsync(songIds, cancellationToken);
        return songs.Select(s => new BatchSongDto(
            s.Id,
            s.Title,
            s.Artist?.StageName ?? string.Empty,
            s.SongGenres.FirstOrDefault()?.GenreId,
            new List<string>()
        )).ToList();
    }

    public async Task<ArtistResponseDto> GetArtistAsync(Guid artistId, CancellationToken cancellationToken = default)
    {
        var artist = await _repository.GetArtistByIdAsync(artistId, cancellationToken)
            ?? throw new KeyNotFoundException($"Artist {artistId} not found.");

        var songs = await _repository.GetSongsByArtistIdAsync(artistId, cancellationToken);

        return new ArtistResponseDto(
            artist.Id,
            artist.StageName,
            artist.Bio,
            artist.Country,
            artist.ProfileImageUrl,
            artist.BannerImageUrl,
            artist.Verified,
            artist.TotalFollowers,
            artist.TotalPlays,
            songs.Select(MapToResponseDto).ToList()
        );
    }

    public async Task<List<MySongDto>> GetMySongsAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var songs = await _repository.GetSongsByCreatorUserIdAsync(userId, cancellationToken);
        return songs.Select(s => new MySongDto(
            s.Id,
            s.Title,
            s.CoverImageUrl,
            s.SongGenres.FirstOrDefault()?.Genre?.Name,
            s.CreatedAt,
            s.PlayCount
        )).ToList();
    }

    private static SongResponseDto MapToResponseDto(Song song) => new(
        song.Id,
        song.Title,
        new ArtistSummaryDto(song.Artist.Id, song.Artist.StageName),
        song.Album != null ? new AlbumSummaryDto(song.Album.Id, song.Album.Title) : null,
        song.DurationSec,
        song.CoverImageUrl,
        song.IsExplicit,
        song.CreatedAt,
        song.SongGenres.FirstOrDefault()?.Genre?.Name,
        song.Mood,
        song.Language,
        song.Album?.ReleaseDate,
        song.PlayCount,
        song.SongArtists
            .Where(sa => sa.Role == "featured")
            .OrderBy(sa => sa.DisplayOrder)
            .Select(sa => new FeaturedArtistDto(sa.ArtistId, sa.Artist?.StageName ?? sa.DisplayName ?? string.Empty))
            .ToList()
    );

    private static void ValidateFile(Stream stream, long length, string contentType)
    {
        if (length > 50 * 1024 * 1024)
            throw new ArgumentException("File size exceeds the 50MB limit.");

        if (!stream.CanRead)
            throw new ArgumentException("Unreadable stream.");

        var buffer = new byte[4];
        var bytesRead = stream.Read(buffer, 0, 4);
        stream.Position = 0;

        if (bytesRead < 4)
            throw new ArgumentException("File is too small or empty.");

        var hex = BitConverter.ToString(buffer).Replace("-", "").ToUpper();

        // MP3: FF FB/F3/F2 or ID3 tag; WAV: RIFF; OGG: OggS
        bool isValid = hex.StartsWith("FFF") || hex.StartsWith("494433")
            || hex.StartsWith("52494646")
            || hex.StartsWith("4F676753");

        if (!isValid)
            throw new ArgumentException("Invalid file type. Only MP3, WAV, and OGG are allowed.");
    }
}
