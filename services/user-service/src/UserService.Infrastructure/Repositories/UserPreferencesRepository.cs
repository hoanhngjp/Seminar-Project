using Microsoft.EntityFrameworkCore;
using UserService.Application.Interfaces;
using UserService.Domain.Models;
using UserService.Infrastructure.Data;

namespace UserService.Infrastructure.Repositories;

public class UserPreferencesRepository(UserDbContext db) : IUserPreferencesRepository
{
    public async Task<UserPreferences?> GetByUserIdAsync(Guid userId, CancellationToken ct)
        => await db.UserPreferences.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId, ct).ConfigureAwait(false);

    public async Task UpsertAsync(UserPreferences preferences, CancellationToken ct)
    {
        var existing = await db.UserPreferences
            .FirstOrDefaultAsync(p => p.UserId == preferences.UserId, ct).ConfigureAwait(false);

        if (existing is null)
        {
            db.UserPreferences.Add(preferences);
        }
        else
        {
            existing.PreferredGenres = preferences.PreferredGenres;
            existing.PreferredArtists = preferences.PreferredArtists;
            existing.AudioQuality = preferences.AudioQuality;
            existing.UpdatedAt = DateTime.UtcNow;
            db.UserPreferences.Update(existing);
        }

        await db.SaveChangesAsync(ct).ConfigureAwait(false);
    }
}
