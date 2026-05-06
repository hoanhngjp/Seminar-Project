using NotificationService.Api.Models;
using NotificationService.Domain.Exceptions;

namespace NotificationService.Api.Middleware;

public class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (DomainException ex)
        {
            logger.LogWarning(ex, "Domain exception. ErrorCode={ErrorCode}", ex.ErrorCode);
            ctx.Response.StatusCode = ex.HttpStatusCode;
            ctx.Response.ContentType = "application/json";
            var requestId = ctx.Items["CorrelationId"]?.ToString();
            await ctx.Response.WriteAsJsonAsync(
                ApiResponse<object>.Fail(ex.ErrorCode, ex.Message, requestId));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            ctx.Response.StatusCode = 500;
            ctx.Response.ContentType = "application/json";
            var requestId = ctx.Items["CorrelationId"]?.ToString();
            await ctx.Response.WriteAsJsonAsync(
                ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.", requestId));
        }
    }
}
