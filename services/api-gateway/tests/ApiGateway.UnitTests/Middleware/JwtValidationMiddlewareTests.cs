using ApiGateway.Api.Middleware;
using ApiGateway.Application.Interfaces;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;
using Xunit;

namespace ApiGateway.UnitTests.Middleware;

public class JwtValidationMiddlewareTests
{
    private readonly Mock<IJwtValidationService> _jwtServiceMock = new();

    private JwtValidationMiddleware CreateMiddleware(RequestDelegate next)
        => new(next, _jwtServiceMock.Object);

    private static DefaultHttpContext CreateContext(string path, string? authHeader = null)
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Response.Body = new MemoryStream();
        if (authHeader != null)
            context.Request.Headers.Authorization = authHeader;
        return context;
    }

    [Theory]
    [InlineData("/api/v1/auth/login")]
    [InlineData("/api/v1/auth/refresh")]
    [InlineData("/health")]
    public async Task InvokeAsync_SkippedPath_CallsNext_WithoutValidation(string path)
    {
        // Skip list paths must not be validated
        var nextCalled = false;
        RequestDelegate next = _ => { nextCalled = true; return Task.CompletedTask; };
        var middleware = CreateMiddleware(next);
        var context = CreateContext(path);

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        _jwtServiceMock.Verify(s => s.ValidateAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task InvokeAsync_MissingAuthHeader_Returns401()
    {
        // AC0.1.1: no Authorization header → 401 UNAUTHORIZED
        var middleware = CreateMiddleware(_ => Task.CompletedTask);
        var context = CreateContext("/api/v1/users/me");

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(401);
        _jwtServiceMock.Verify(s => s.ValidateAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task InvokeAsync_NonBearerHeader_Returns401()
    {
        // Basic auth or other schemes are not accepted
        var middleware = CreateMiddleware(_ => Task.CompletedTask);
        var context = CreateContext("/api/v1/users/me", "Basic dXNlcjpwYXNz");

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task InvokeAsync_InvalidToken_Returns401()
    {
        // AC0.1.1: invalid JWT → 401
        _jwtServiceMock
            .Setup(s => s.ValidateAsync("bad-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new JwtValidationResult(false, "UNAUTHORIZED", null, null, null));

        var middleware = CreateMiddleware(_ => Task.CompletedTask);
        var context = CreateContext("/api/v1/users/me", "Bearer bad-token");

        await middleware.InvokeAsync(context);

        context.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task InvokeAsync_ValidToken_CallsNext()
    {
        // Happy path: valid token → next is called
        var nextCalled = false;
        RequestDelegate next = _ => { nextCalled = true; return Task.CompletedTask; };

        _jwtServiceMock
            .Setup(s => s.ValidateAsync("valid-token", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new JwtValidationResult(true, null, "user-id", "Listener", "jti-123"));

        var middleware = CreateMiddleware(next);
        var context = CreateContext("/api/v1/users/me", "Bearer valid-token");

        await middleware.InvokeAsync(context);

        nextCalled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task InvokeAsync_ValidToken_PropagatesUserIdAndRoleHeaders()
    {
        // Downstream services receive X-User-Id and X-User-Role
        _jwtServiceMock
            .Setup(s => s.ValidateAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new JwtValidationResult(true, null, "abc-123", "Creator", "jti-xyz"));

        string? capturedUserId = null;
        string? capturedRole = null;
        RequestDelegate next = ctx =>
        {
            capturedUserId = ctx.Request.Headers["X-User-Id"];
            capturedRole = ctx.Request.Headers["X-User-Role"];
            return Task.CompletedTask;
        };

        var middleware = CreateMiddleware(next);
        var context = CreateContext("/api/v1/music/songs", "Bearer some-token");

        await middleware.InvokeAsync(context);

        capturedUserId.Should().Be("abc-123");
        capturedRole.Should().Be("Creator");
    }
}
