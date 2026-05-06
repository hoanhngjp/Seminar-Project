using ListeningPartyService.Application.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;
using StackExchange.Redis;

namespace ListeningPartyService.IntegrationTests;

/// <summary>
/// Factory for SignalR hub integration tests.
/// Replaces Redis and IPartyService with mocks; GatewayAuth works via X-User-Id header.
/// </summary>
public class PartyHubWebApplicationFactory : WebApplicationFactory<Program>
{
    public Mock<IPartyService> ServiceMock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IConnectionMultiplexer>();
            services.RemoveAll<IDatabase>();
            services.RemoveAll<IPartyService>();

            var redisMock = new Mock<IDatabase>();
            services.AddSingleton(redisMock.Object);
            services.AddScoped<IPartyService>(_ => ServiceMock.Object);
        });
    }

    /// <summary>
    /// Build a SignalR HubConnection that authenticates via X-User-Id header (GatewayAuth).
    /// Uses LongPolling transport which is reliable in TestServer.
    /// userId must be a valid GUID (GatewayAuth validates this).
    /// </summary>
    public HubConnection CreateHubConnection(string roomId, string userId, string role = "Listener")
    {
        return new HubConnectionBuilder()
            .WithUrl($"http://localhost/hubs/party?roomId={roomId}", options =>
            {
                options.HttpMessageHandlerFactory = _ => Server.CreateHandler();
                options.Transports = Microsoft.AspNetCore.Http.Connections.HttpTransportType.LongPolling;
                options.Headers.Add("X-User-Id", userId);
                options.Headers.Add("X-User-Role", role);
            })
            .Build();
    }
}
