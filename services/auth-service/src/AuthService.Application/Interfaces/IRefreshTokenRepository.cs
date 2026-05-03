using AuthService.Domain.Models;

namespace AuthService.Application.Interfaces;

public interface IRefreshTokenRepository
{
    Task<RefreshToken?> GetByJtiAsync(Guid jti, CancellationToken ct);
    Task<IEnumerable<RefreshToken>> GetActiveByUserIdAsync(Guid userId, CancellationToken ct);
    Task AddAsync(RefreshToken token, CancellationToken ct);
    Task UpdateAsync(RefreshToken token, CancellationToken ct);
    Task RevokeAllForUserAsync(Guid userId, CancellationToken ct);
}
