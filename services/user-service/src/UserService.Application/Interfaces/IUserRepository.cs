using UserService.Domain.Models;

namespace UserService.Application.Interfaces;

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<User?> GetByEmailAsync(string email, CancellationToken ct);
    Task<User?> GetByUsernameOrEmailAsync(string usernameOrEmail, CancellationToken ct);
    Task UpdateLastLoginAsync(Guid userId, CancellationToken ct);
}
