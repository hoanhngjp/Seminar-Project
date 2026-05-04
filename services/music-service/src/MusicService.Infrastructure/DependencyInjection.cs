using Amazon.S3;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MusicService.Application.Interfaces;
using MusicService.Infrastructure.Data;
using MusicService.Infrastructure.Repositories;
using MusicService.Infrastructure.Services;

namespace MusicService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<MusicDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));
            
        // S3 / MinIO Configuration
        services.AddSingleton<IAmazonS3>(sp =>
        {
            var s3Config = new AmazonS3Config
            {
                ServiceURL = configuration["S3:ServiceURL"],
                ForcePathStyle = true // Required for MinIO
            };
            var credentials = new Amazon.Runtime.BasicAWSCredentials(
                configuration["S3:AccessKey"], 
                configuration["S3:SecretKey"]);
            return new AmazonS3Client(credentials, s3Config);
        });

        services.AddScoped<IStorageService, S3StorageService>();
        services.AddSingleton<IEventPublisher, KafkaEventPublisher>();
        services.AddScoped<IMusicRepository, MusicRepository>();

        // Redis Configuration
        services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(sp =>
        {
            var redisConnectionString = configuration.GetConnectionString("Redis") ?? "localhost:6379";
            return StackExchange.Redis.ConnectionMultiplexer.Connect(redisConnectionString);
        });

        return services;
    }
}
