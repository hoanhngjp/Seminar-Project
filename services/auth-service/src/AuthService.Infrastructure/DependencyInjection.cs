using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using AuthService.Infrastructure.Data;
using AuthService.Application.Interfaces;
using AuthService.Infrastructure.Repositories;
using AuthService.Infrastructure.Security;
using AuthService.Infrastructure.Redis;
using AuthService.Infrastructure.Grpc;
using AuthService.Infrastructure.Google;
using StackExchange.Redis;
using SmartMusic.User.Grpc;

namespace AuthService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var pgConn = configuration.GetConnectionString("AuthDb")
            ?? throw new InvalidOperationException("ConnectionStrings:AuthDb is required.");
        services.AddDbContext<AuthDbContext>(options => options.UseNpgsql(pgConn));

        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<ITokenBlacklistRepository, TokenBlacklistRepository>();
        services.AddScoped<ITokenGenerator, JwtTokenGenerator>();

        // Redis — docker sets Redis__ConnectionString
        var redisConfig = configuration["Redis:ConnectionString"]
            ?? configuration.GetConnectionString("Redis")
            ?? "localhost:6379";
        services.AddSingleton<IConnectionMultiplexer>(_ => {
            var opts = ConfigurationOptions.Parse(redisConfig);
            opts.AbortOnConnectFail = false;
            return ConnectionMultiplexer.Connect(opts);
        });
        services.AddSingleton<ICacheService, RedisCacheService>();

        // gRPC client to User Service over plain HTTP/2 (h2c) — docker sets Grpc__UserService
        var userServiceUrl = configuration["Grpc:UserService"] ?? "http://localhost:5002";
        services.AddGrpcClient<UserService.UserServiceClient>(o =>
        {
            o.Address = new Uri(userServiceUrl);
        }).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            // Required for gRPC over plain HTTP without TLS
            EnableMultipleHttp2Connections = true
        });
        services.AddScoped<IUserGrpcClient, UserGrpcClient>();
        services.AddSingleton<IGoogleTokenVerifier, GoogleTokenVerifier>();

        return services;
    }
}
