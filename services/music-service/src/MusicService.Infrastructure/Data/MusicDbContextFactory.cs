using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MusicService.Infrastructure.Data;

// Used only by EF Core tools (dotnet ef migrations add / update)
public class MusicDbContextFactory : IDesignTimeDbContextFactory<MusicDbContext>
{
    public MusicDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<MusicDbContext>();
        optionsBuilder.UseNpgsql(
            "Host=localhost;Port=5434;Database=music_db;Username=smartmusic;Password=changeme_local");
        return new MusicDbContext(optionsBuilder.Options);
    }
}
