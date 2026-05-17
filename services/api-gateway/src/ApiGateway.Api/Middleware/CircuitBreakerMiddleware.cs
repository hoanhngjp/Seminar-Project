using ApiGateway.Api.Common;

namespace ApiGateway.Api.Middleware;

public class CircuitBreakerMiddleware(RequestDelegate next)
{
    private const int DownstreamTimeoutMs = 2000;

    public async Task InvokeAsync(HttpContext context)
    {
        // SignalR hub connections are long-lived (WebSocket, SSE, Long Polling) —
        // bypass the 2-second circuit breaker so all transports stay connected.
        if (context.WebSockets.IsWebSocketRequest ||
            context.Request.Path.StartsWithSegments("/hubs", StringComparison.OrdinalIgnoreCase))
        {
            await next(context);
            return;
        }

        var originalAborted = context.RequestAborted;

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(originalAborted);
        cts.CancelAfter(DownstreamTimeoutMs);

        try
        {
            await next(context).WaitAsync(cts.Token);
        }
        catch (OperationCanceledException) when (originalAborted.IsCancellationRequested)
        {
            // Client disconnected — nothing to write back
        }
        catch (OperationCanceledException) when (cts.IsCancellationRequested)
        {
            // Our timeout fired — downstream too slow
            if (!context.Response.HasStarted)
                await ApiErrorWriter.WriteAsync(context, 503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable. Please try again.");
        }
    }
}
