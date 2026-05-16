using ListeningPartyService.Application.Interfaces;
using ListeningPartyService.Application.Services;
using ListeningPartyService.Infrastructure.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace ListeningPartyService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var redisConnectionString = configuration["Redis:ConnectionString"]
            ?? configuration["REDIS_CONNECTION_STRING"]
            ?? throw new InvalidOperationException("Redis:ConnectionString is required.");

        // Lazy factory — connect khi first resolve, không phải khi DI setup.
        // Cho phép WebApplicationFactory replace IConnectionMultiplexer trước khi request đầu tiên.
        services.AddSingleton<IConnectionMultiplexer>(_ => {
            var opts = ConfigurationOptions.Parse(redisConnectionString);
            opts.AbortOnConnectFail = false;
            return ConnectionMultiplexer.Connect(opts);
        });
        services.AddSingleton<IDatabase>(sp => sp.GetRequiredService<IConnectionMultiplexer>().GetDatabase());

        services.AddScoped<IPartyRepository, RedisPartyRepository>();
        services.AddScoped<IPartyService, PartyService>();

        return services;
    }
}
