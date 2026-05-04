using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MusicService.Application.Interfaces;
using MusicService.Domain.Models;
using MusicService.Infrastructure.Data;

namespace MusicService.Infrastructure.Repositories;

public class MusicRepository : IMusicRepository
{
    private readonly MusicDbContext _context;

    public MusicRepository(MusicDbContext context)
    {
        _context = context;
    }

    public async Task<Artist?> GetArtistByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _context.Artists.FirstOrDefaultAsync(a => a.UserId == userId, cancellationToken);
    }

    public async Task<List<Genre>> GetGenresByIdsAsync(IEnumerable<Guid> genreIds, CancellationToken cancellationToken = default)
    {
        return await _context.Genres.Where(g => genreIds.Contains(g.Id)).ToListAsync(cancellationToken);
    }

    public async Task AddSongAsync(Song song, CancellationToken cancellationToken = default)
    {
        await _context.Songs.AddAsync(song, cancellationToken);
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        await _context.SaveChangesAsync(cancellationToken);
    }
}
