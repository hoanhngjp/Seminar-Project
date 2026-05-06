using Confluent.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using NotificationService.Application.Interfaces;
using NotificationService.Application.Services;
using NotificationService.Infrastructure.Http;
using NotificationService.Infrastructure.Kafka;
using NotificationService.Infrastructure.Redis;
using NotificationService.Infrastructure.Repositories;
using StackExchange.Redis;

namespace NotificationService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration config)
    {
        // MongoDB
        var mongoConnectionString = config["MongoDB:ConnectionString"]
            ?? throw new InvalidOperationException("MongoDB:ConnectionString is required.");
        var mongoDatabase = config["MongoDB:Database"] ?? "notification_db";

        services.AddSingleton<IMongoClient>(_ => new MongoClient(mongoConnectionString));
        services.AddSingleton<IMongoDatabase>(sp =>
            sp.GetRequiredService<IMongoClient>().GetDatabase(mongoDatabase));
        services.AddScoped<INotificationRepository, MongoNotificationRepository>();

        // Redis
        var redisConnectionString = config["Redis:ConnectionString"]
            ?? throw new InvalidOperationException("Redis:ConnectionString is required.");
        services.AddSingleton<IConnectionMultiplexer>(
            _ => ConnectionMultiplexer.Connect(redisConnectionString));
        services.AddScoped<IIdempotencyRepository, RedisIdempotencyRepository>();

        // Kafka producer
        services.AddSingleton<IEventPublisher, KafkaEventPublisher>();

        // Kafka consumer
        services.AddSingleton<IConsumer<string, string>>(_ =>
        {
            var consumerConfig = new ConsumerConfig
            {
                BootstrapServers = config["Kafka:BootstrapServers"],
                GroupId = config["Kafka:ConsumerGroupId"] ?? "notification-service",
                AutoOffsetReset = AutoOffsetReset.Earliest,
                EnableAutoCommit = false
            };
            return new ConsumerBuilder<string, string>(consumerConfig).Build();
        });

        services.AddHostedService<KafkaConsumerBackgroundService>();

        // Scoped services
        services.AddScoped<NewReleaseHandler>();
        services.AddScoped<INotificationService, NotificationService.Application.Services.NotificationService>();

        // HTTP client for User Service
        var userServiceUrl = config["Services:UserService"]
            ?? throw new InvalidOperationException("Services:UserService is required.");
        services.AddHttpClient<IUserServiceClient, UserServiceClient>(client =>
        {
            client.BaseAddress = new Uri(userServiceUrl);
            client.Timeout = TimeSpan.FromMilliseconds(500);
        });

        return services;
    }
}
