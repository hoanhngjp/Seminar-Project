using ListeningPartyService.Api.Models;
using ListeningPartyService.Domain.Exceptions;

namespace ListeningPartyService.Api.Middleware;

public class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (RoomNotFoundException ex)
        {
            logger.LogWarning("Room not found: {Message}", ex.Message);
            context.Response.StatusCode = 404;
            context.Response.ContentType = "application/json";
            var body = ApiResponse<object>.Fail("ROOM_NOT_FOUND", ex.Message);
            await context.Response.WriteAsJsonAsync(body);
        }
        catch (OperationCanceledException)
        {
            // client disconnect or timeout — do not return 500
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            var body = ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.");
            await context.Response.WriteAsJsonAsync(body);
        }
    }
}
