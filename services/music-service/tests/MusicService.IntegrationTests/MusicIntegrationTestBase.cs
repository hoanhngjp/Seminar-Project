using System;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MusicService.Application.DTOs;
using MusicService.Application.Interfaces;
using MusicService.Infrastructure.Data;
using StackExchange.Redis;

namespace MusicService.IntegrationTests;

/// <summary>
/// Shared factory for all integration tests.
/// Uses native postgres: Host=localhost;Port=5432;Database=music_db;Username=postgres;Password=4L27hN04@
/// Each test that writes data must clean up via the CleanupAsync helper.
/// </summary>
public class MusicWebApplicationFactory : WebApplicationFactory<Program>
{
    // Connection string for native postgres (per DEVLOG 2026-05-03)
    public const string TestConnStr =
        "Host=localhost;Port=5432;Database=music_db;Username=postgres;Password=4L27hN04@;Pooling=false";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace EF Core to point to native postgres
            services.RemoveAll<DbContextOptions<MusicDbContext>>();
            services.RemoveAll<MusicDbContext>();
            services.AddDbContext<MusicDbContext>(opts => opts.UseNpgsql(TestConnStr));

            // Replace infra services that need external systems
            services.RemoveAll<ISongCache>();
            services.AddSingleton<ISongCache, NoOpSongCache>();

            services.RemoveAll<IStorageService>();
            services.AddSingleton<IStorageService, NoOpStorageService>();

            services.RemoveAll<IEventPublisher>();
            services.AddSingleton<IEventPublisher, NoOpEventPublisher>();

            services.RemoveAll<IConnectionMultiplexer>();
        });

        builder.UseEnvironment("Testing");
    }

    /// <summary>Create an HttpClient with Gateway auth headers pre-configured.</summary>
    public HttpClient CreateAuthorizedClient(string role = "Listener")
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add("X-User-Id", Guid.NewGuid().ToString());
        client.DefaultRequestHeaders.Add("X-User-Role", role);
        return client;
    }
}

public class NoOpSongCache : ISongCache
{
    public Task<SongResponseDto?> GetAsync(Guid songId, CancellationToken ct = default)
        => Task.FromResult<SongResponseDto?>(null);

    public Task SetAsync(Guid songId, SongResponseDto song, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task InvalidateAsync(Guid songId, CancellationToken ct = default)
        => Task.CompletedTask;
}

public class NoOpStorageService : IStorageService
{
    public string BucketName => "test-bucket";

    public Task<string> UploadFileAsync(string key, Stream content, string contentType, CancellationToken ct = default)
        => Task.FromResult(key);

    public Task<bool> DeleteFileAsync(string key, CancellationToken ct = default)
        => Task.FromResult(true);
}

public class NoOpEventPublisher : IEventPublisher
{
    public Task PublishNewReleaseAsync(MusicService.Domain.Events.NewReleaseEvent ev, CancellationToken ct = default)
        => Task.CompletedTask;
}
