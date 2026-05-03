using AuthService.Application.Interfaces;
using AuthService.Domain.Models;
using AuthService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Infrastructure.Repositories;

public class RefreshTokenRepository(AuthDbContext db) : IRefreshTokenRepository
{
    public async Task<RefreshToken?> GetByJtiAsync(Guid jti, CancellationToken ct)
    {
        return await db.RefreshTokens.FirstOrDefaultAsync(r => r.Jti == jti, ct);
    }

    public async Task<IEnumerable<RefreshToken>> GetActiveByUserIdAsync(Guid userId, CancellationToken ct)
    {
        return await db.RefreshTokens
            .Where(r => r.UserId == userId && !r.Revoked && r.ExpiresAt > DateTime.UtcNow)
            .ToListAsync(ct);
    }

    public async Task AddAsync(RefreshToken token, CancellationToken ct)
    {
        db.RefreshTokens.Add(token);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(RefreshToken token, CancellationToken ct)
    {
        db.RefreshTokens.Update(token);
        await db.SaveChangesAsync(ct);
    }

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken ct)
    {
        await db.RefreshTokens
            .Where(r => r.UserId == userId && !r.Revoked)
            .ExecuteUpdateAsync(s => s
                .SetProperty(r => r.Revoked, true)
                .SetProperty(r => r.RevokedAt, DateTime.UtcNow), ct);
    }
}
