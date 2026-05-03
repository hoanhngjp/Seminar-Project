using Microsoft.EntityFrameworkCore;
using UserService.Domain.Models;

namespace UserService.Infrastructure.Data;

public class UserDbContext(DbContextOptions<UserDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserPreferences> UserPreferences => Set<UserPreferences>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(u => u.Id);
            e.Property(u => u.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(u => u.Email).HasColumnName("email").HasMaxLength(320).IsRequired();
            e.Property(u => u.Username).HasColumnName("username").HasMaxLength(50).IsRequired();
            e.Property(u => u.DisplayName).HasColumnName("display_name").HasMaxLength(100).IsRequired();
            e.Property(u => u.PasswordHash).HasColumnName("password_hash").IsRequired();
            e.Property(u => u.Role).HasColumnName("role").HasMaxLength(20).HasDefaultValue("Listener").IsRequired();
            e.Property(u => u.AvatarUrl).HasColumnName("avatar_url");
            e.Property(u => u.Bio).HasColumnName("bio");
            e.Property(u => u.IsVerified).HasColumnName("is_verified").HasDefaultValue(false);
            e.Property(u => u.IsActive).HasColumnName("is_active").HasDefaultValue(true);
            e.Property(u => u.LastLoginAt).HasColumnName("last_login_at");
            e.Property(u => u.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property(u => u.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.HasIndex(u => u.Email).IsUnique().HasDatabaseName("idx_users_email");
            e.HasIndex(u => u.Username).IsUnique().HasDatabaseName("idx_users_username");
            e.HasIndex(u => u.Role).HasDatabaseName("idx_users_role");
            e.HasIndex(u => u.IsActive).HasDatabaseName("idx_users_is_active");
        });

        mb.Entity<UserPreferences>(e =>
        {
            e.ToTable("user_preferences");
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(p => p.UserId).HasColumnName("user_id").IsRequired();
            e.Property(p => p.PreferredGenres).HasColumnName("preferred_genres")
                .HasColumnType("uuid[]").HasDefaultValueSql("'{}'");
            e.Property(p => p.PreferredLanguages).HasColumnName("preferred_languages")
                .HasColumnType("varchar(10)[]").HasDefaultValueSql("'{}'");
            e.Property(p => p.AudioQuality).HasColumnName("audio_quality").HasMaxLength(20)
                .HasDefaultValue("standard").IsRequired();
            e.Property(p => p.Autoplay).HasColumnName("autoplay").HasDefaultValue(true);
            e.Property(p => p.ExplicitContent).HasColumnName("explicit_content").HasDefaultValue(false);
            e.Property(p => p.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("NOW()");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("NOW()");
            e.HasIndex(p => p.UserId).IsUnique().HasDatabaseName("idx_user_preferences_user_id");
            e.HasOne(p => p.User).WithOne(u => u.Preferences)
                .HasForeignKey<UserPreferences>(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
