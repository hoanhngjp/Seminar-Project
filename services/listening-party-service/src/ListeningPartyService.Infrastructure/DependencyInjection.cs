using Microsoft.Extensions.DependencyInjection;

namespace ListeningPartyService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // Infrastructure registrations added in later weeks (Redis, SignalR backplane)
        return services;
    }
}
