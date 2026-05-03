using UserService.Api.Common;
using UserService.Domain.Exceptions;

namespace UserService.Api.Middleware;

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
            await ctx.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(ex.ErrorCode, ex.Message, ctx));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            ctx.Response.StatusCode = 500;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(
                ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.", ctx));
        }
    }
}
