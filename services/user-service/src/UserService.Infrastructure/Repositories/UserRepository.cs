using Microsoft.EntityFrameworkCore;
using UserService.Application.Interfaces;
using UserService.Domain.Models;
using UserService.Infrastructure.Data;

namespace UserService.Infrastructure.Repositories;

public class UserRepository(UserDbContext db) : IUserRepository
{
    public async Task<User?> GetByIdAsync(Guid id, CancellationToken ct)
        => await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct).ConfigureAwait(false);

    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct)
        => await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == email.ToLowerInvariant(), ct).ConfigureAwait(false);

    public async Task<User?> GetByUsernameOrEmailAsync(string usernameOrEmail, CancellationToken ct)
    {
        var lower = usernameOrEmail.ToLowerInvariant();
        return await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Email == lower || u.Username == lower, ct)
            .ConfigureAwait(false);
    }

    public async Task<bool> ExistsByEmailAsync(string email, CancellationToken ct)
        => await db.Users.AsNoTracking()
            .AnyAsync(u => u.Email == email.ToLowerInvariant(), ct).ConfigureAwait(false);

    public async Task<User> CreateAsync(User user, CancellationToken ct)
    {
        user.Email = user.Email.ToLowerInvariant();
        user.Username = user.Username.ToLowerInvariant();
        await db.Users.AddAsync(user, ct).ConfigureAwait(false);
        await db.SaveChangesAsync(ct).ConfigureAwait(false);
        return user;
    }

    public async Task UpdateLastLoginAsync(Guid userId, CancellationToken ct)
    {
        await db.Users.Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.LastLoginAt, DateTime.UtcNow)
                .SetProperty(u => u.UpdatedAt, DateTime.UtcNow), ct)
            .ConfigureAwait(false);
    }

    public async Task<(IReadOnlyList<Guid> FollowerIds, string? NextCursor)> GetFollowerIdsAsync(
        Guid artistId, int limit, string? cursor, CancellationToken ct)
    {
        IQueryable<Domain.Models.Follow> query = db.Follows
            .AsNoTracking()
            .Where(f => f.FolloweeId == artistId)
            .OrderBy(f => f.Id);

        if (cursor is not null && Guid.TryParse(cursor, out var cursorId))
            query = query.Where(f => f.Id.CompareTo(cursorId) > 0);

        // Fetch (Id, FollowerId) so we can use Follow.Id as next cursor
        var rows = await query
            .Select(f => new { f.Id, f.FollowerId })
            .Take(limit + 1)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        string? nextCursor = null;
        if (rows.Count > limit)
        {
            rows.RemoveAt(rows.Count - 1);
            nextCursor = rows[^1].Id.ToString();
        }

        return (rows.Select(r => r.FollowerId).ToList(), nextCursor);
    }
}
