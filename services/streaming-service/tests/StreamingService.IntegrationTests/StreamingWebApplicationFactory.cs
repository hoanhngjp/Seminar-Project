using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using StreamingService.Application.Interfaces;

namespace StreamingService.IntegrationTests;

/// <summary>
/// Replaces real S3 and Music Service with mocks.
/// No external infrastructure required.
/// </summary>
public class StreamingWebApplicationFactory : WebApplicationFactory<Program>
{
    public Mock<IStoragePresigner> PresignerMock { get; } = new();
    public Mock<IMusicServiceClient> MusicClientMock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remove real infrastructure registrations and replace with mocks
            var presignerDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IStoragePresigner));
            if (presignerDescriptor != null) services.Remove(presignerDescriptor);

            var musicClientDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IMusicServiceClient));
            if (musicClientDescriptor != null) services.Remove(musicClientDescriptor);

            // Also remove the typed HttpClient factory entry for MusicServiceClient
            var httpClientDescriptors = services
                .Where(d => d.ServiceType.FullName?.Contains("MusicServiceClient") == true)
                .ToList();
            foreach (var d in httpClientDescriptors) services.Remove(d);

            services.AddScoped<IStoragePresigner>(_ => PresignerMock.Object);
            services.AddScoped<IMusicServiceClient>(_ => MusicClientMock.Object);
        });

        builder.UseEnvironment("Test");
    }
}
