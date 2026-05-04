using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StackExchange.Redis;
using UserService.Application.Interfaces;
using UserService.Application.Services;
using UserService.Infrastructure.Data;
using UserService.Infrastructure.Kafka;
using UserService.Infrastructure.Redis;
using UserService.Infrastructure.Repositories;

namespace UserService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration config)
    {
        // Docker sets ConnectionStrings__PostgreSQL; local dev may use USER_DB_CONNECTION_STRING or Postgres key
        var connStr = Environment.GetEnvironmentVariable("USER_DB_CONNECTION_STRING")
            ?? config["ConnectionStrings:PostgreSQL"]
            ?? config.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("PostgreSQL connection string is required.");

        services.AddDbContext<UserDbContext>(o => o.UseNpgsql(connStr));

        var redisConn = Environment.GetEnvironmentVariable("REDIS_CONNECTION_STRING")
            ?? config["Redis:ConnectionString"]
            ?? throw new InvalidOperationException("REDIS_CONNECTION_STRING is required.");

        services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConn));
        services.AddSingleton<IRedisCache, RedisCache>();

        services.AddSingleton<IKafkaProducer, KafkaProducer>();

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IUserPreferencesRepository, UserPreferencesRepository>();
        services.AddScoped<IUserService, UserProfileService>();

        return services;
    }
}
