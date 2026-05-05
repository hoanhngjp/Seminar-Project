using Elastic.Clients.Elasticsearch;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SearchService.Application.Interfaces;
using SearchService.Application.Services;
using SearchService.Infrastructure.Elasticsearch;
using SearchService.Infrastructure.Redis;
using StackExchange.Redis;

namespace SearchService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Elasticsearch v8 client
        var esUrl = configuration["Elasticsearch:Url"]
            ?? throw new InvalidOperationException("Elasticsearch:Url is required.");

        services.AddSingleton(_ =>
            new ElasticsearchClient(new Uri(esUrl)));

        services.AddScoped<ISearchRepository, ElasticsearchSearchRepository>();

        // Redis
        var redisConn = configuration["Redis:ConnectionString"]
            ?? throw new InvalidOperationException("Redis:ConnectionString is required.");

        services.AddSingleton<IConnectionMultiplexer>(_ =>
            ConnectionMultiplexer.Connect(redisConn));

        services.AddScoped<IDatabase>(sp =>
            sp.GetRequiredService<IConnectionMultiplexer>().GetDatabase());

        services.AddScoped<ISearchCache, RedisSearchCache>();

        // Application service
        services.AddScoped<ISearchService, SearchService.Application.Services.SearchService>();

        return services;
    }
}
