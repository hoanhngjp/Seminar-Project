using Google.Apis.Auth.OAuth2;
using Google.Cloud.Storage.V1;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StreamingService.Application.Interfaces;
using StreamingService.Infrastructure.Http;
using StreamingService.Infrastructure.Storage;

namespace StreamingService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // GCS UrlSigner (uses GOOGLE_APPLICATION_CREDENTIALS env var automatically)
        services.AddSingleton<UrlSigner>(_ =>
        {
            var credential = GoogleCredential.GetApplicationDefault()
                .CreateScoped("https://www.googleapis.com/auth/devstorage.read_only");
            return UrlSigner.FromCredential(credential);
        });

        // Typed HttpClient for GCS range requests (IStoragePresigner → GcsStoragePresigner)
        services.AddHttpClient<IStoragePresigner, GcsStoragePresigner>();

        // Music Service HTTP client
        var musicServiceUrl = configuration["MusicService:BaseUrl"]
            ?? "http://music-service:80";

        services.AddHttpClient<IMusicServiceClient, MusicServiceClient>(client =>
        {
            client.BaseAddress = new Uri(musicServiceUrl);
        });

        services.AddScoped<IStreamingService, StreamingService.Application.Services.StreamingService>();

        return services;
    }
}
