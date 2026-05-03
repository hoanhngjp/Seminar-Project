using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using UserService.Domain.Models;

namespace UserService.Infrastructure.Data;

public static class DbInitializer
{
    public static async Task SeedAsync(UserDbContext db, ILogger logger)
    {
        if (db.Database.IsRelational())
        {
            await db.Database.MigrateAsync();
        }
        else
        {
            await db.Database.EnsureCreatedAsync();
        }

        if (await db.Users.AnyAsync()) return;

        var users = new[]
        {
            new User
            {
                Id = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
                Email = "listener@example.com",
                Username = "listener",
                DisplayName = "Test Listener",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Test1234!"),
                Role = "Listener",
                IsVerified = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new User
            {
                Id = Guid.Parse("b2c3d4e5-f6a7-8901-bcde-f12345678901"),
                Email = "creator@example.com",
                Username = "creator",
                DisplayName = "Test Creator",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Test1234!"),
                Role = "Creator",
                IsVerified = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            },
            new User
            {
                Id = Guid.Parse("c3d4e5f6-a7b8-9012-cdef-234567890123"),
                Email = "admin@example.com",
                Username = "admin",
                DisplayName = "Test Admin",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Test1234!"),
                Role = "Admin",
                IsVerified = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }
        };

        db.Users.AddRange(users);
        await db.SaveChangesAsync();
        logger.LogInformation("Seed data created: {Count} users", users.Length);
    }
}
