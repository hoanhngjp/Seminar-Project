using ApiGateway.Api.Common;
using ApiGateway.Application.Interfaces;

namespace ApiGateway.Api.Middleware;

public class JwtValidationMiddleware(RequestDelegate next, IJwtValidationService jwtValidationService)
{
    private static readonly HashSet<string> SkipPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/health"
    };

    public async Task InvokeAsync(HttpContext context)
    {
        if (ShouldSkip(context.Request.Path))
        {
            await next(context);
            return;
        }

        var authHeader = context.Request.Headers.Authorization.FirstOrDefault();
        if (authHeader == null || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            await ApiErrorWriter.WriteAsync(context, 401, "UNAUTHORIZED", "Authentication required.");
            return;
        }

        var token = authHeader["Bearer ".Length..].Trim();
        var result = await jwtValidationService.ValidateAsync(token, context.RequestAborted);

        if (!result.IsValid)
        {
            var statusCode = result.Code == "TOKEN_EXPIRED" ? 401 : 401;
            await ApiErrorWriter.WriteAsync(context, statusCode, result.Code!, "Authentication failed.");
            return;
        }

        // Propagate identity to downstream services via internal headers
        // Remove Authorization header — downstream services trust the gateway, not raw JWT
        context.Request.Headers.Remove("Authorization");
        context.Request.Headers["X-User-Id"] = result.UserId;
        context.Request.Headers["X-User-Role"] = result.Role;

        await next(context);
    }

    private static bool ShouldSkip(PathString path)
    {
        foreach (var skipPath in SkipPaths)
        {
            if (path.StartsWithSegments(skipPath, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
}
