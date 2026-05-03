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

    public async Task UpdateLastLoginAsync(Guid userId, CancellationToken ct)
    {
        await db.Users.Where(u => u.Id == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(u => u.LastLoginAt, DateTime.UtcNow)
                .SetProperty(u => u.UpdatedAt, DateTime.UtcNow), ct)
            .ConfigureAwait(false);
    }
}
