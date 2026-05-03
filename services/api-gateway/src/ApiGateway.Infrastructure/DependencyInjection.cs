using Microsoft.Extensions.DependencyInjection;

namespace ApiGateway.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Infrastructure registrations added in later weeks (Redis, Rate Limiting)
        return services;
    }
}
