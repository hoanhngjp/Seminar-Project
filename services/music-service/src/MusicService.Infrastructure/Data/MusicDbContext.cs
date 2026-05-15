using Microsoft.EntityFrameworkCore;
using MusicService.Domain.Models;

namespace MusicService.Infrastructure.Data;

public class MusicDbContext : DbContext
{
    public MusicDbContext(DbContextOptions<MusicDbContext> options) : base(options)
    {
    }

    public DbSet<Artist> Artists { get; set; } = null!;
    public DbSet<Genre> Genres { get; set; } = null!;
    public DbSet<Album> Albums { get; set; } = null!;
    public DbSet<Song> Songs { get; set; } = null!;
    public DbSet<SongGenre> SongGenres { get; set; } = null!;
    public DbSet<SongArtist> SongArtists { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Artist Configuration
        modelBuilder.Entity<Artist>(entity =>
        {
            entity.ToTable("artists");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserId).IsRequired();
            entity.Property(e => e.StageName).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Country).HasMaxLength(2);
            entity.HasIndex(e => e.UserId).IsUnique();
            entity.HasIndex(e => e.Country);
            entity.HasIndex(e => e.TotalPlays);
        });

        // Genre Configuration
        modelBuilder.Entity<Genre>(entity =>
        {
            entity.ToTable("genres");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(100);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.HasIndex(e => e.Slug).IsUnique();
        });

        // Album Configuration
        modelBuilder.Entity<Album>(entity =>
        {
            entity.ToTable("albums");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(255);
            entity.Property(e => e.AlbumType).IsRequired().HasMaxLength(20);
            
            entity.HasOne(e => e.Artist)
                .WithMany(a => a.Albums)
                .HasForeignKey(e => e.ArtistId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(e => e.ArtistId);
            entity.HasIndex(e => e.ReleaseDate);
            entity.HasIndex(e => e.AlbumType);
        });

        // Song Configuration
        modelBuilder.Entity<Song>(entity =>
        {
            entity.ToTable("songs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).IsRequired().HasMaxLength(255);
            entity.Property(e => e.S3AudioKey).IsRequired();
            entity.Property(e => e.Language).HasMaxLength(10);
            entity.Property(e => e.Mood).HasMaxLength(50);
            
            entity.HasOne(e => e.Artist)
                .WithMany(a => a.Songs)
                .HasForeignKey(e => e.ArtistId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Album)
                .WithMany(a => a.Songs)
                .HasForeignKey(e => e.AlbumId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasIndex(e => e.ArtistId);
            entity.HasIndex(e => e.AlbumId);
            entity.HasIndex(e => e.S3AudioKey).IsUnique();
            entity.HasIndex(e => e.PlayCount);
            entity.HasIndex(e => e.IsExplicit);
        });

        // SongArtist Configuration
        modelBuilder.Entity<SongArtist>(entity =>
        {
            entity.ToTable("song_artists");
            entity.HasKey(e => new { e.SongId, e.DisplayOrder });

            entity.Property(e => e.Role).IsRequired().HasMaxLength(20).HasDefaultValue("primary");
            entity.Property(e => e.DisplayName).HasMaxLength(150);

            entity.HasOne(e => e.Song)
                .WithMany(s => s.SongArtists)
                .HasForeignKey(e => e.SongId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Artist)
                .WithMany(a => a.SongArtists)
                .HasForeignKey(e => e.ArtistId)
                .OnDelete(DeleteBehavior.SetNull)
                .IsRequired(false);

            entity.HasIndex(e => e.SongId);
            entity.HasIndex(e => e.ArtistId);
        });

        // SongGenre Configuration
        modelBuilder.Entity<SongGenre>(entity =>
        {
            entity.ToTable("song_genres");
            entity.HasKey(e => new { e.SongId, e.GenreId });

            entity.HasOne(e => e.Song)
                .WithMany(s => s.SongGenres)
                .HasForeignKey(e => e.SongId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Genre)
                .WithMany(g => g.SongGenres)
                .HasForeignKey(e => e.GenreId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
