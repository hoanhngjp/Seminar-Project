using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using AuthService.Infrastructure.Data;
using AuthService.Application.Interfaces;
using AuthService.Infrastructure.Repositories;
using AuthService.Infrastructure.Security;
using AuthService.Infrastructure.Redis;
using AuthService.Infrastructure.Grpc;
using StackExchange.Redis;
using SmartMusic.User.Grpc;

namespace AuthService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AuthDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("AuthDb")));
            
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<ITokenBlacklistRepository, TokenBlacklistRepository>();
        services.AddScoped<ITokenGenerator, JwtTokenGenerator>();
        
        var redisConfig = configuration.GetConnectionString("Redis") ?? "localhost:6379";
        services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConfig));
        services.AddSingleton<ICacheService, RedisCacheService>();

        services.AddGrpcClient<UserService.UserServiceClient>(o =>
        {
            o.Address = new Uri(configuration["Grpc:UserService"] ?? "http://localhost:5433");
        });
        services.AddScoped<IUserGrpcClient, UserGrpcClient>();

        return services;
    }
}
