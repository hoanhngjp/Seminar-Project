using Microsoft.Extensions.DependencyInjection;

namespace StreamingService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Infrastructure registrations added in later weeks (S3, CDN, Kafka)
        return services;
    }
}
