using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MusicService.Application.DTOs;
using MusicService.Domain.Models;

namespace MusicService.Application.Interfaces;

public interface ISongService
{
    Task<Song> UploadSongAsync(Guid userId, UploadSongDto dto, CancellationToken cancellationToken = default);

    /// <summary>Returns song metadata. Cache: song:meta:{songId} TTL 30m. Throws KeyNotFoundException when not found.</summary>
    Task<(SongResponseDto Song, bool CacheHit)> GetSongAsync(Guid songId, CancellationToken cancellationToken = default);

    /// <summary>Returns storage key for Streaming Service internal calls. Throws KeyNotFoundException when not found.</summary>
    Task<SongStorageKeyDto> GetSongStorageKeyAsync(Guid songId, CancellationToken cancellationToken = default);

    /// <summary>Batch fetch for Recommendation Service. Returns only existing songs — missing IDs are silently skipped.</summary>
    Task<List<BatchSongDto>> GetSongsBatchAsync(IEnumerable<Guid> songIds, CancellationToken cancellationToken = default);

    /// <summary>Returns artist profile + top songs. Throws KeyNotFoundException when not found.</summary>
    Task<ArtistResponseDto> GetArtistAsync(Guid artistId, CancellationToken cancellationToken = default);

    /// <summary>Returns all songs uploaded by the given creator (by userId).</summary>
    Task<List<MySongDto>> GetMySongsAsync(Guid userId, CancellationToken cancellationToken = default);
}
