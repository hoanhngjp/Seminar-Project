using CloudinaryDotNet;
using Google.Cloud.Storage.V1;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MusicService.Application.Interfaces;
using MusicService.Infrastructure.Data;
using MusicService.Infrastructure.Repositories;
using MusicService.Infrastructure.Services;
using StackExchange.Redis;

namespace MusicService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<MusicDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

        // GCS Configuration (uses GOOGLE_APPLICATION_CREDENTIALS env var automatically)
        var bucketName = configuration["GCP:BucketName"]
            ?? throw new InvalidOperationException("GCP:BucketName is required.");

        // Lazy GCS client — only instantiated on first actual upload/download call.
        // BucketName-only operations (e.g. internal storage-key endpoint) don't need real credentials.
        services.AddSingleton<Lazy<StorageClient>>(_ => new Lazy<StorageClient>(() => StorageClient.Create()));
        services.AddSingleton<IStorageService>(sp =>
            new GcsStorageService(sp.GetRequiredService<Lazy<StorageClient>>(), bucketName));

        // Cloudinary Configuration (for cover image upload)
        var cloudinaryCloudName = configuration["Cloudinary:CloudName"]
            ?? throw new InvalidOperationException("Cloudinary:CloudName is required.");
        var cloudinaryApiKey = configuration["Cloudinary:ApiKey"]
            ?? throw new InvalidOperationException("Cloudinary:ApiKey is required.");
        var cloudinaryApiSecret = configuration["Cloudinary:ApiSecret"]
            ?? throw new InvalidOperationException("Cloudinary:ApiSecret is required.");

        var cloudinaryAccount = new Account(cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret);
        services.AddSingleton(new Cloudinary(cloudinaryAccount) { Api = { Secure = true } });
        services.AddSingleton<IImageStorageService, CloudinaryImageService>();

        services.AddSingleton<IEventPublisher, KafkaEventPublisher>();
        services.AddScoped<IMusicRepository, MusicRepository>();
        services.AddSingleton<ISongCache, RedisSongCache>();

        // Redis Configuration
        services.AddSingleton<IConnectionMultiplexer>(sp =>
        {
            var redisConnectionString = configuration["Redis:ConnectionString"] ?? "localhost:6379";
            var opts = ConfigurationOptions.Parse(redisConnectionString);
            opts.AbortOnConnectFail = false;
            return ConnectionMultiplexer.Connect(opts);
        });

        return services;
    }
}
