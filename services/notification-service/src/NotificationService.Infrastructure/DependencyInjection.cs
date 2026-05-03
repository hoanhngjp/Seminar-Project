using Microsoft.Extensions.DependencyInjection;

namespace NotificationService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Infrastructure registrations added in later weeks (MongoDB, Kafka)
        return services;
    }
}
