using ApiGateway.Api.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace ApiGateway.UnitTests.Middleware;

public class CircuitBreakerMiddlewareTests
{
    private static DefaultHttpContext CreateContext()
    {
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        return context;
    }

    [Fact]
    public async Task InvokeAsync_FastDownstream_CallsNext()
    {
        // Happy path: downstream responds quickly → next is called, 200 returned
        var nextCalled = false;
        RequestDelegate next = _ => { nextCalled = true; return Task.CompletedTask; };
        var middleware = new CircuitBreakerMiddleware(next);
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task InvokeAsync_SlowDownstream_Returns503()
    {
        // AC0.1.2: downstream hangs > 2000ms → 503 SERVICE_UNAVAILABLE
        RequestDelegate next = async _ => await Task.Delay(TimeSpan.FromSeconds(10));
        var middleware = new CircuitBreakerMiddleware(next);
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(503);
    }

    [Fact]
    public async Task InvokeAsync_SlowDownstream_WritesServiceUnavailableBody()
    {
        // Response body must contain SERVICE_UNAVAILABLE error code
        RequestDelegate next = async _ => await Task.Delay(TimeSpan.FromSeconds(10));
        var middleware = new CircuitBreakerMiddleware(next);
        var context = CreateContext();

        await middleware.InvokeAsync(context);

        context.Response.Body.Position = 0;
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        body.Should().Contain("SERVICE_UNAVAILABLE");
    }

    [Fact]
    public async Task InvokeAsync_ClientDisconnects_DoesNotReturn503()
    {
        // Client-side cancellation must NOT be treated as circuit breaker trigger
        using var clientCts = new CancellationTokenSource();
        var context = CreateContext();
        context.RequestAborted = clientCts.Token;

        RequestDelegate next = async ctx =>
        {
            clientCts.Cancel(); // simulate client disconnect
            await Task.Delay(5000, ctx.RequestAborted);
        };

        var middleware = new CircuitBreakerMiddleware(next);

        // Should not throw and should not write 503 (client cancelled)
        await middleware.Invoking(m => m.InvokeAsync(context))
            .Should().NotThrowAsync();

        context.Response.StatusCode.Should().NotBe(503);
    }
}
