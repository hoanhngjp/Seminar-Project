using AuthService.Application.Interfaces;
using AuthService.Domain.Models;
using AuthService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Infrastructure.Repositories;

public class TokenBlacklistRepository(AuthDbContext db) : ITokenBlacklistRepository
{
    public async Task AddAsync(TokenBlacklist blacklist, CancellationToken ct)
    {
        db.TokenBlacklist.Add(blacklist);
        await db.SaveChangesAsync(ct);
    }

    public async Task<bool> IsBlacklistedAsync(Guid jti, CancellationToken ct)
    {
        return await db.TokenBlacklist.AsNoTracking().AnyAsync(b => b.Jti == jti, ct);
    }
}
