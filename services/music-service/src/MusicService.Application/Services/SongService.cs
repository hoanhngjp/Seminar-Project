using System;
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
    private readonly ILogger<SongService> _logger;

    public SongService(
        IMusicRepository repository, 
        IStorageService storageService, 
        IEventPublisher eventPublisher,
        ILogger<SongService> logger)
    {
        _repository = repository;
        _storageService = storageService;
        _eventPublisher = eventPublisher;
        _logger = logger;
    }

    public async Task<Song> UploadSongAsync(Guid userId, UploadSongDto dto, CancellationToken cancellationToken = default)
    {
        // 1. Validation
        ValidateFile(dto.AudioStream, dto.Length, dto.ContentType);

        // 2. Verify Artist
        var artist = await _repository.GetArtistByUserIdAsync(userId, cancellationToken);
        if (artist == null)
        {
            throw new InvalidOperationException("Creator profile not found.");
        }

        // 3. Verify Genres
        var genreGuidIds = dto.GenreIds.Select(Guid.Parse).ToList();
        var genres = await _repository.GetGenresByIdsAsync(genreGuidIds, cancellationToken);
        if (genres.Count != genreGuidIds.Count)
        {
            throw new InvalidOperationException("One or more genres are invalid.");
        }

        // 4. Setup Song entity
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
            IsPublished = false, // Processing state
            DurationSec = 0 // Metadata extraction would happen asynchronously or from client
        };

        foreach (var genre in genres)
        {
            song.SongGenres.Add(new SongGenre { SongId = song.Id, GenreId = genre.Id });
        }

        // 5. Upload to S3 with Exponential Backoff Retry (Atomicity Phase 1)
        var s3Success = false;
        var maxRetries = 3;
        
        for (int i = 0; i < maxRetries; i++)
        {
            try
            {
                _logger.LogInformation("Uploading song {SongId} to S3 (Attempt {Attempt})", songId, i + 1);
                
                // Reset stream position if retrying
                if (dto.AudioStream.CanSeek) dto.AudioStream.Position = 0;
                
                await _storageService.UploadFileAsync(storageKey, dto.AudioStream, dto.ContentType, cancellationToken);
                s3Success = true;
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "S3 upload failed for song {SongId} on attempt {Attempt}", songId, i + 1);
                if (i == maxRetries - 1)
                {
                    throw new InvalidOperationException("Failed to upload file to storage service after max retries.", ex);
                }
                
                // Exponential backoff: 2s, 4s
                await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, i + 1)), cancellationToken);
            }
        }

        if (!s3Success) throw new InvalidOperationException("Failed to upload file to storage service.");

        // 6. Commit to DB (Atomicity Phase 2)
        try
        {
            await _repository.AddSongAsync(song, cancellationToken);
            await _repository.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Compensation: Delete from S3 if DB commit fails
            _logger.LogError(ex, "DB commit failed for song {SongId}. Rolling back S3 upload.", songId);
            await _storageService.DeleteFileAsync(storageKey, CancellationToken.None); // Don't use original token in compensation
            throw new InvalidOperationException("Failed to save song metadata to database.", ex);
        }

        // 7. Publish Event (Atomicity Phase 3)
        var releaseEvent = new NewReleaseEvent
        {
            CorrelationId = Guid.NewGuid().ToString(), // Ideally from request context
            ArtistId = artist.UserId.ToString(), // Or artist.Id depending on other services. We use UserId for auth/identity.
            ArtistName = artist.StageName,
            SongId = song.Id.ToString(),
            SongTitle = song.Title,
            GenreIds = dto.GenreIds,
            S3StorageKey = storageKey,
            Explicit = song.IsExplicit,
            ThumbnailUrl = artist.ProfileImageUrl ?? string.Empty,
            DurationSec = song.DurationSec
        };

        try
        {
            await _eventPublisher.PublishNewReleaseAsync(releaseEvent, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to publish NewReleaseEvent for song {SongId}. Event is lost but entity is saved.", songId);
        }

        return song;
    }

    private void ValidateFile(Stream stream, long length, string contentType)
    {
        // Max 50MB
        if (length > 50 * 1024 * 1024)
            throw new ArgumentException("File size exceeds the 50MB limit.");

        if (!stream.CanRead) throw new ArgumentException("Unreadable stream.");

        var buffer = new byte[4];
        var bytesRead = stream.Read(buffer, 0, 4);
        stream.Position = 0; // Reset for actual upload

        if (bytesRead < 4) throw new ArgumentException("File is too small or empty.");

        var hex = BitConverter.ToString(buffer).Replace("-", "").ToUpper();

        // Magic bytes checks:
        // MP3: FF FB, FF F3, FF F2, 49 44 33 (ID3)
        // WAV: 52 49 46 46 (RIFF)
        // OGG: 4F 67 67 53 (OggS)
        
        bool isValid = false;
        if (hex.StartsWith("FFF") || hex.StartsWith("494433")) isValid = true; // MP3
        else if (hex.StartsWith("52494646")) isValid = true; // WAV
        else if (hex.StartsWith("4F676753")) isValid = true; // OGG

        if (!isValid)
            throw new ArgumentException("Invalid file type. Only MP3, WAV, and OGG are allowed based on magic bytes.");
    }
}
