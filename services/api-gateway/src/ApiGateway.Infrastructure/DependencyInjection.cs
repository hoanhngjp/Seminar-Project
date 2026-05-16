using ApiGateway.Application.Interfaces;
using ApiGateway.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;

namespace ApiGateway.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Docker sets Redis__ConnectionString; local dev may use REDIS_CONNECTION_STRING
        var redisConn = configuration["Redis:ConnectionString"]
            ?? configuration["REDIS_CONNECTION_STRING"]
            ?? "localhost:6379";
        var redisOpts = ConfigurationOptions.Parse(redisConn);
        redisOpts.AbortOnConnectFail = false;
        var redis = ConnectionMultiplexer.Connect(redisOpts);
        services.AddSingleton<IConnectionMultiplexer>(redis);
        services.AddSingleton<IDatabase>(_ => redis.GetDatabase());

        services.AddSingleton<IJwtValidationService, JwtValidationService>();
        services.AddSingleton<IRateLimitingService, RateLimitingService>();

        return services;
    }
}
