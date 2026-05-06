using Microsoft.AspNetCore.Authentication;

namespace ListeningPartyService.Api.Extensions;

public static class GatewayAuthExtensions
{
    public static IServiceCollection AddGatewayAuth(this IServiceCollection services)
    {
        services.AddAuthentication("GatewayAuth")
            .AddScheme<AuthenticationSchemeOptions, GatewayAuthHandler>("GatewayAuth", _ => { });

        services.AddAuthorization();
        return services;
    }
}
