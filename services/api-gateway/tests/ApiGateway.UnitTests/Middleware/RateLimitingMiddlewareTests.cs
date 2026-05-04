using ApiGateway.Api.Middleware;
using ApiGateway.Application.Interfaces;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;
using System.Net;
using System.Text;
using Xunit;

namespace ApiGateway.UnitTests.Middleware;

public class RateLimitingMiddlewareTests
{
    private readonly Mock<IRateLimitingService> _rateLimitMock = new();

    private RateLimitingMiddleware CreateMiddleware(RequestDelegate next)
        => new(next, _rateLimitMock.Object);

    private static DefaultHttpContext CreateContext(string path, string? body = null, string ip = "10.0.0.1")
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = "POST";
        context.Response.Body = new MemoryStream();
        context.Connection.RemoteIpAddress = IPAddress.Parse(ip);

        if (body != null)
        {
            var bytes = Encoding.UTF8.GetBytes(body);
            context.Request.Body = new MemoryStream(bytes);
            context.Request.ContentType = "application/json";
            context.Request.ContentLength = bytes.Length;
        }

        return context;
    }

    [Fact]
    public async Task InvokeAsync_AllowedRequest_CallsNext()
    {
        // AC0.1.3: under rate limit → next is called
        _rateLimitMock
            .Setup(r => r.IsAllowedAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var nextCalled = false;
        RequestDelegate next = _ => { nextCalled = true; return Task.CompletedTask; };
        var middleware = CreateMiddleware(next);
        var context = CreateContext("/api/v1/users/me");

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
    }

    [Fact]
    public async Task InvokeAsync_ExceededLimit_Returns429()
    {
        // AC0.1.3: over rate limit → 429 RATE_LIMIT_EXCEEDED
        _rateLimitMock
            .Setup(r => r.IsAllowedAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var middleware = CreateMiddleware(_ => Task.CompletedTask);
        var context = CreateContext("/api/v1/users/me");

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(429);
    }

    [Fact]
    public async Task InvokeAsync_LoginPath_UsesLoginLimit10PerMin()
    {
        // Login endpoint uses tighter 10/min limit
        _rateLimitMock
            .Setup(r => r.IsAllowedAsync(It.IsAny<string>(), 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var middleware = CreateMiddleware(_ => Task.CompletedTask);
        var context = CreateContext("/api/v1/auth/login",
            body: """{"username":"user@example.com","password":"pass"}""");

        await middleware.InvokeAsync(context);

        _rateLimitMock.Verify(r => r.IsAllowedAsync(It.IsAny<string>(), 10, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task InvokeAsync_NonLoginPath_UsesGeneralLimit100PerMin()
    {
        // General endpoints use 100/min limit
        _rateLimitMock
            .Setup(r => r.IsAllowedAsync(It.IsAny<string>(), 100, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var middleware = CreateMiddleware(_ => Task.CompletedTask);
        var context = CreateContext("/api/v1/users/me");

        await middleware.InvokeAsync(context);

        _rateLimitMock.Verify(r => r.IsAllowedAsync(It.IsAny<string>(), 100, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task InvokeAsync_LoginPath_KeyIncludesIp()
    {
        // Rate limit key for login must include client IP
        string? capturedKey = null;
        _rateLimitMock
            .Setup(r => r.IsAllowedAsync(It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
            .Callback<string, int, CancellationToken>((key, _, _) => capturedKey = key)
            .ReturnsAsync(true);

        var middleware = CreateMiddleware(_ => Task.CompletedTask);
        var context = CreateContext("/api/v1/auth/login",
            body: """{"username":"user@example.com","password":"pass"}""",
            ip: "203.0.113.42");

        await middleware.InvokeAsync(context);

        capturedKey.Should().Contain("203.0.113.42");
    }
}
