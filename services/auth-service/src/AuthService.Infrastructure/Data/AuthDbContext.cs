using AuthService.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Infrastructure.Data;

public class AuthDbContext(DbContextOptions<AuthDbContext> options) : DbContext(options)
{
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<TokenBlacklist> TokenBlacklist => Set<TokenBlacklist>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.ToTable("refresh_tokens");
            b.HasKey(e => e.Id);
            b.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            b.Property(e => e.IpAddress)
                .HasColumnType("inet")
                .HasConversion(
                    v => v != null ? System.Net.IPAddress.Parse(v) : null,
                    v => v != null ? v.ToString() : null);
            b.HasIndex(e => e.Jti).IsUnique();
            b.HasIndex(e => e.UserId);
            b.HasIndex(e => e.ExpiresAt);
            b.HasIndex(e => new { e.UserId, e.Revoked, e.ExpiresAt });
        });

        modelBuilder.Entity<TokenBlacklist>(b =>
        {
            b.ToTable("token_blacklist");
            b.HasKey(e => e.Id);
            b.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            b.HasIndex(e => e.Jti).IsUnique();
            b.HasIndex(e => e.ExpiresAt);
            b.HasIndex(e => e.UserId);
        });
    }
}
