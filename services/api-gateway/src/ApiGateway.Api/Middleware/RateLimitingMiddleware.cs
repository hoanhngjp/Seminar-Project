using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ApiGateway.Api.Common;
using ApiGateway.Application.Interfaces;

namespace ApiGateway.Api.Middleware;

public class RateLimitingMiddleware(RequestDelegate next, IRateLimitingService rateLimitingService)
{
    private const int LoginLimitPerMinute = 10;
    private const int GeneralLimitPerMinute = 100;

    public async Task InvokeAsync(HttpContext context)
    {
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var path = context.Request.Path.Value ?? string.Empty;

        string rateLimitKey;
        int limit;

        if (path.Equals("/api/v1/auth/login", StringComparison.OrdinalIgnoreCase))
        {
            var username = await ExtractUsernameFromBodyAsync(context);
            var usernameHash = HashUsername(username ?? string.Empty);
            rateLimitKey = $"gateway:ratelimit:login:{ip}:{usernameHash}";
            limit = LoginLimitPerMinute;
        }
        else
        {
            rateLimitKey = $"gateway:ratelimit:ip:{ip}";
            limit = GeneralLimitPerMinute;
        }

        var isAllowed = await rateLimitingService.IsAllowedAsync(rateLimitKey, limit, context.RequestAborted);
        if (!isAllowed)
        {
            await ApiErrorWriter.WriteAsync(context, 429, "RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later.");
            return;
        }

        await next(context);
    }

    private static async Task<string?> ExtractUsernameFromBodyAsync(HttpContext context)
    {
        context.Request.EnableBuffering();
        try
        {
            using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true);
            var body = await reader.ReadToEndAsync();
            context.Request.Body.Position = 0;

            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("username", out var prop))
                return prop.GetString();
        }
        catch
        {
            // Ignore parse failures — fall through to empty username hash
        }
        return null;
    }

    private static string HashUsername(string username)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(username.ToLowerInvariant()));
        return Convert.ToHexString(bytes)[..16];
    }
}
