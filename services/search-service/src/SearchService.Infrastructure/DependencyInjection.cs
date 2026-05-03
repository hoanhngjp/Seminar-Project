using Microsoft.Extensions.DependencyInjection;

namespace SearchService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Infrastructure registrations added in later weeks (Elasticsearch)
        return services;
    }
}
