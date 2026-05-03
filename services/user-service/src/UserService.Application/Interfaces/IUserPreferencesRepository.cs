using UserService.Domain.Models;

namespace UserService.Application.Interfaces;

public interface IUserPreferencesRepository
{
    Task<UserPreferences?> GetByUserIdAsync(Guid userId, CancellationToken ct);
    Task UpsertAsync(UserPreferences preferences, CancellationToken ct);
}
