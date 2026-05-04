using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MusicService.Domain.Models;

namespace MusicService.Application.Interfaces;

public interface IMusicRepository
{
    Task<Artist?> GetArtistByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);
    Task<List<Genre>> GetGenresByIdsAsync(IEnumerable<Guid> genreIds, CancellationToken cancellationToken = default);
    Task AddSongAsync(Song song, CancellationToken cancellationToken = default);
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
