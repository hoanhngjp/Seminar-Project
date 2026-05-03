using Microsoft.Extensions.DependencyInjection;

namespace MusicService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Infrastructure registrations added in later weeks (DB, S3, Kafka)
        return services;
    }
}
