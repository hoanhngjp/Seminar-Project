using System;
using System.Threading;
using System.Threading.Tasks;
using MusicService.Application.DTOs;

namespace MusicService.Application.Interfaces;

public interface ISongCache
{
    Task<SongResponseDto?> GetAsync(Guid songId, CancellationToken cancellationToken = default);
    Task SetAsync(Guid songId, SongResponseDto song, CancellationToken cancellationToken = default);
    Task InvalidateAsync(Guid songId, CancellationToken cancellationToken = default);
}
