using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

namespace NotificationService.Api.Extensions;

/// <summary>
/// GatewayAuth pattern: trust X-User-Id / X-User-Role headers injected by API Gateway.
/// Downstream services do NOT re-validate JWT.
/// </summary>
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
