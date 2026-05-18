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
        => await _context.Artists.FirstOrDefaultAsync(a => a.UserId == userId, cancellationToken);

    public async Task<List<Genre>> GetGenresByIdsAsync(IEnumerable<Guid> genreIds, CancellationToken cancellationToken = default)
        => await _context.Genres.Where(g => genreIds.Contains(g.Id)).ToListAsync(cancellationToken);

    public async Task AddSongAsync(Song song, CancellationToken cancellationToken = default)
        => await _context.Songs.AddAsync(song, cancellationToken);

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default)
        => await _context.SaveChangesAsync(cancellationToken);

    public async Task<Song?> GetSongByIdAsync(Guid songId, CancellationToken cancellationToken = default)
        => await _context.Songs
            .Include(s => s.Artist)
            .Include(s => s.Album)
            .Include(s => s.SongGenres).ThenInclude(sg => sg.Genre)
            .Include(s => s.SongArtists).ThenInclude(sa => sa.Artist)
            .FirstOrDefaultAsync(s => s.Id == songId, cancellationToken);

    public async Task<List<Song>> GetSongsByIdsAsync(IEnumerable<Guid> songIds, CancellationToken cancellationToken = default)
        => await _context.Songs
            .Include(s => s.Artist)
            .Include(s => s.SongGenres)
            .Where(s => songIds.Contains(s.Id))
            .ToListAsync(cancellationToken);

    public async Task<Artist?> GetArtistByIdAsync(Guid artistId, CancellationToken cancellationToken = default)
        => await _context.Artists.FirstOrDefaultAsync(a => a.Id == artistId, cancellationToken);

    public async Task<List<Song>> GetSongsByArtistIdAsync(Guid artistId, CancellationToken cancellationToken = default)
        => await _context.Songs
            .Include(s => s.Artist)
            .Include(s => s.Album)
            .Include(s => s.SongGenres).ThenInclude(sg => sg.Genre)
            .Include(s => s.SongArtists).ThenInclude(sa => sa.Artist)
            .Where(s => s.ArtistId == artistId)
            .OrderByDescending(s => s.PlayCount)
            .ToListAsync(cancellationToken);

    public async Task<List<Song>> GetSongsByCreatorUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _context.Songs
            .Include(s => s.Artist)
            .Include(s => s.SongGenres).ThenInclude(sg => sg.Genre)
            .Where(s => s.Artist != null && s.Artist.UserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task<List<Genre>> GetAllGenresAsync(CancellationToken cancellationToken = default)
        => await _context.Genres.OrderBy(g => g.Name).ToListAsync(cancellationToken);
}
