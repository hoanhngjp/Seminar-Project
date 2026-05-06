using AnalyticsService.Application.Interfaces;
using AnalyticsService.Application.Services;
using AnalyticsService.Infrastructure.Http;
using AnalyticsService.Infrastructure.InfluxDb;
using AnalyticsService.Infrastructure.Kafka;
using AnalyticsService.Infrastructure.Kafka.Handlers;
using AnalyticsService.Infrastructure.Redis;
using InfluxDB.Client;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace AnalyticsService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // ── InfluxDB ─────────────────────────────────────────────────
        var influxUrl = configuration["InfluxDB:Url"]
            ?? throw new InvalidOperationException("InfluxDB:Url is required.");
        var influxToken = configuration["InfluxDB:Token"]
            ?? throw new InvalidOperationException("InfluxDB:Token is required.");

        services.AddSingleton(_ => new InfluxDBClient(influxUrl, influxToken));
        services.AddScoped<IAnalyticsRepository, InfluxAnalyticsRepository>();

        // ── Redis ─────────────────────────────────────────────────────
        var redisConn = configuration["Redis:ConnectionString"]
            ?? throw new InvalidOperationException("Redis:ConnectionString is required.");

        services.AddSingleton<IConnectionMultiplexer>(_ =>
            ConnectionMultiplexer.Connect(redisConn));
        services.AddScoped<IDatabase>(sp =>
            sp.GetRequiredService<IConnectionMultiplexer>().GetDatabase());

        services.AddScoped<IIdempotencyRepository, RedisIdempotencyRepository>();
        services.AddScoped<IAnalyticsCache, RedisAnalyticsCache>();

        // ── Kafka producer ────────────────────────────────────────────
        services.AddSingleton<IEventPublisher, KafkaEventPublisher>();

        // ── Kafka consumers ───────────────────────────────────────────
        var bootstrapServers = configuration["Kafka:BootstrapServers"] ?? "localhost:9092";

        services.AddScoped<SongPlayedHandler>();
        services.AddScoped<SongSkippedHandler>();
        services.AddScoped<NotificationSentHandler>();

        RegisterConsumer<SongPlayedHandler>(services, "Song_Played", "analytics-service", bootstrapServers);
        RegisterConsumer<SongSkippedHandler>(services, "Song_Skipped", "analytics-service", bootstrapServers);
        RegisterConsumer<NotificationSentHandler>(services, "Notification_Sent", "analytics-service", bootstrapServers);

        // ── Music Service HTTP client ─────────────────────────────────
        var musicServiceUrl = configuration["MusicService:BaseUrl"] ?? "http://localhost:5003";

        services.AddHttpClient<IMusicServiceClient, MusicServiceClient>(client =>
        {
            client.BaseAddress = new Uri(musicServiceUrl);
        });

        // ── Application service ───────────────────────────────────────
        services.AddScoped<IAnalyticsService, AnalyticsService.Application.Services.AnalyticsService>();

        return services;
    }

    private static void RegisterConsumer<THandler>(
        IServiceCollection services,
        string topic,
        string group,
        string bootstrapServers)
        where THandler : IKafkaConsumerHandler
    {
        services.AddHostedService(sp =>
            new KafkaConsumerBackgroundService(
                topic,
                group,
                bootstrapServers,
                sp.GetRequiredService<IServiceScopeFactory>(),
                sp.GetRequiredService<ILogger<KafkaConsumerBackgroundService>>(),
                typeof(THandler)));
    }
}
