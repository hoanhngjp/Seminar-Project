using Amazon.S3;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StreamingService.Application.Interfaces;
using StreamingService.Application.Services;
using StreamingService.Infrastructure.Http;
using StreamingService.Infrastructure.Storage;

namespace StreamingService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // S3 / MinIO
        services.AddSingleton<IAmazonS3>(_ =>
        {
            var serviceUrl = configuration["S3:ServiceURL"];
            var s3Config = new AmazonS3Config
            {
                ForcePathStyle = true
            };
            if (!string.IsNullOrWhiteSpace(serviceUrl))
                s3Config.ServiceURL = serviceUrl;

            var accessKey = configuration["S3:AccessKey"]
                ?? throw new InvalidOperationException("S3:AccessKey is required.");
            var secretKey = configuration["S3:SecretKey"]
                ?? throw new InvalidOperationException("S3:SecretKey is required.");

            return new AmazonS3Client(
                new Amazon.Runtime.BasicAWSCredentials(accessKey, secretKey),
                s3Config);
        });

        services.AddScoped<IStoragePresigner, S3StoragePresigner>();

        // Music Service HTTP client
        var musicServiceUrl = configuration["MusicService:BaseUrl"]
            ?? "http://localhost:5003";

        services.AddHttpClient<IMusicServiceClient, MusicServiceClient>(client =>
        {
            client.BaseAddress = new Uri(musicServiceUrl);
        });

        services.AddScoped<IStreamingService, StreamingService.Application.Services.StreamingService>();

        return services;
    }
}
