using Microsoft.Extensions.DependencyInjection;

namespace UserService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Infrastructure registrations added in later weeks (DB, Redis, Kafka)
        return services;
    }
}
