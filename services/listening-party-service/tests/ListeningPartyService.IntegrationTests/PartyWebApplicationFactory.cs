using ListeningPartyService.Application.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;
using StackExchange.Redis;

namespace ListeningPartyService.IntegrationTests;

/// <summary>
/// Integration test factory: replaces Redis and IPartyService with mocks.
/// No Testcontainers needed — all I/O mocked at interface boundary.
/// </summary>
public class PartyWebApplicationFactory : WebApplicationFactory<Program>
{
    public Mock<IPartyService> ServiceMock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            // Remove real Redis and infrastructure
            services.RemoveAll<IConnectionMultiplexer>();
            services.RemoveAll<IDatabase>();
            services.RemoveAll<IPartyService>();

            // Stub Redis (not used when IPartyService is mocked)
            var redisMock = new Mock<IDatabase>();
            services.AddSingleton(redisMock.Object);

            // Replace with mock service
            services.AddScoped<IPartyService>(_ => ServiceMock.Object);
        });
    }
}
