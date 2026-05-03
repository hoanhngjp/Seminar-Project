using AuthService.Domain.Models;

namespace AuthService.Application.Interfaces;

public interface ITokenBlacklistRepository
{
    Task AddAsync(TokenBlacklist blacklist, CancellationToken ct);
    Task<bool> IsBlacklistedAsync(Guid jti, CancellationToken ct);
}
