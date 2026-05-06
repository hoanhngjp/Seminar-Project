using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;
using NotificationService.Application.DTOs;
using NotificationService.Application.Interfaces;
using NotificationService.Application.Services;
using NotificationService.Domain.Exceptions;
using NotificationService.Domain.Models;

namespace NotificationService.IntegrationTests;

/// <summary>
/// Integration tests: replace real MongoDB, Redis, Kafka with mocks via WebApplicationFactory.
/// Infrastructure note: no Testcontainers needed — all I/O is mocked at the interface boundary.
/// </summary>
public class NotificationsIntegrationTests : IClassFixture<NotificationWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly Mock<INotificationService> _serviceMock;

    public NotificationsIntegrationTests(NotificationWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
        _serviceMock = factory.ServiceMock;
    }

    // ─── GET /api/v1/notifications/unread ─────────────────────────────

    [Fact]
    public async Task GetUnread_WithValidToken_Returns200WithItems_AC6_1_2()
    {
        // AC6.1.2: GET /notifications/unread → cursor pagination
        var items = new List<NotificationDto>
        {
            new("507f1f77bcf86cd799439011", "NEWRELEASE", "DELIVERED",
                "Son Tung released a new song", "Body text", null, null, null, DateTime.UtcNow)
        };
        _serviceMock
            .Setup(s => s.GetUnreadAsync(It.IsAny<Guid>(), 20, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetUnreadResponse(items, "507f1f77bcf86cd799439022", true));

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/notifications/unread");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse>();
        body!.Success.Should().BeTrue();
        body.Data.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUnread_WithoutGatewayHeaders_Returns401()
    {
        var response = await _client.GetAsync("/api/v1/notifications/unread");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetUnread_WithLimitOver50_Returns400ValidationError()
    {
        // Validation: limit > 50 is rejected
        _serviceMock
            .Setup(s => s.GetUnreadAsync(It.IsAny<Guid>(), 99, null, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ValidationException("limit must be between 1 and 50."));

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/notifications/unread?limit=99");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse>();
        body!.Success.Should().BeFalse();
        body.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task GetUnread_HasMoreAndNextCursorInResponse_AC6_1_2()
    {
        // AC6.1.2: response body must contain nextCursor and hasMore
        _serviceMock
            .Setup(s => s.GetUnreadAsync(It.IsAny<Guid>(), 20, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetUnreadResponse(
                new List<NotificationDto>(), "cursor-token-abc", true));

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/notifications/unread");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var raw = await response.Content.ReadAsStringAsync();
        raw.Should().Contain("nextCursor");
        raw.Should().Contain("hasMore");
        raw.Should().Contain("cursor-token-abc");
    }

    // ─── PATCH /api/v1/notifications/{id}/read ─────────────────────────

    [Fact]
    public async Task MarkRead_FirstTime_Returns200WithReadAt_AC6_1_3()
    {
        // AC6.1.3: PATCH /{id}/read first call → 200 with notificationId and readAt
        var notifId = "507f1f77bcf86cd799439011";
        var readAt = DateTime.UtcNow;

        _serviceMock
            .Setup(s => s.MarkReadAsync(notifId, It.IsAny<Guid>(), "idem-key-001", It.IsAny<CancellationToken>()))
            .ReturnsAsync((true, new MarkReadResponse(notifId, readAt)));

        var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/notifications/{notifId}/read");
        request.Headers.Add("Idempotency-Key", "idem-key-001");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse>();
        body!.Success.Should().BeTrue();
        body.Error.Should().BeNull();
    }

    [Fact]
    public async Task MarkRead_WithSameIdempotencyKey_Returns409_AC6_1_3()
    {
        // AC6.1.3: PATCH /{id}/read with same Idempotency-Key → 409 IDEMPOTENCY_CONFLICT
        var notifId = "507f1f77bcf86cd799439011";

        _serviceMock
            .Setup(s => s.MarkReadAsync(notifId, It.IsAny<Guid>(), "dup-key", It.IsAny<CancellationToken>()))
            .ReturnsAsync((false, (MarkReadResponse?)null));

        var request = new HttpRequestMessage(HttpMethod.Patch, $"/api/v1/notifications/{notifId}/read");
        request.Headers.Add("Idempotency-Key", "dup-key");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse>();
        body!.Error!.Code.Should().Be("IDEMPOTENCY_CONFLICT");
    }

    [Fact]
    public async Task MarkRead_WithoutIdempotencyKey_Returns400()
    {
        var request = new HttpRequestMessage(HttpMethod.Patch, "/api/v1/notifications/some-id/read");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse>();
        body!.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task MarkRead_WithoutGatewayHeaders_Returns401()
    {
        var request = new HttpRequestMessage(HttpMethod.Patch, "/api/v1/notifications/some-id/read");
        request.Headers.Add("Idempotency-Key", "key-123");

        var response = await _client.SendAsync(request);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task MarkRead_WhenNotificationNotFound_Returns404()
    {
        _serviceMock
            .Setup(s => s.MarkReadAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new NotFoundException("NOTIFICATION"));

        var request = new HttpRequestMessage(HttpMethod.Patch, "/api/v1/notifications/not-found-id/read");
        request.Headers.Add("Idempotency-Key", "key-456");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse>();
        body!.Error!.Code.Should().Be("NOTIFICATION_NOT_FOUND");
    }

    [Fact]
    public async Task MarkRead_WhenForbidden_Returns403()
    {
        _serviceMock
            .Setup(s => s.MarkReadAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ForbiddenException());

        var request = new HttpRequestMessage(HttpMethod.Patch, "/api/v1/notifications/some-id/read");
        request.Headers.Add("Idempotency-Key", "key-789");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ─── PATCH /api/v1/notifications/read-all ──────────────────────────

    [Fact]
    public async Task MarkAllRead_Returns202WithQueued()
    {
        _serviceMock
            .Setup(s => s.QueueMarkAllReadAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var request = new HttpRequestMessage(HttpMethod.Patch, "/api/v1/notifications/read-all");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Accepted);
        var raw = await response.Content.ReadAsStringAsync();
        raw.Should().Contain("queued");
    }

    [Fact]
    public async Task MarkAllRead_WithoutGatewayHeaders_Returns401()
    {
        var response = await _client.SendAsync(
            new HttpRequestMessage(HttpMethod.Patch, "/api/v1/notifications/read-all"));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ─── Response shape ───────────────────────────────────────────────

    [Fact]
    public async Task GetUnread_ResponseHasCorrectShape()
    {
        // Every response must have success, data, meta, error fields
        _serviceMock
            .Setup(s => s.GetUnreadAsync(It.IsAny<Guid>(), It.IsAny<int>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new GetUnreadResponse(new List<NotificationDto>(), null, false));

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/notifications/unread");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);
        var raw = await response.Content.ReadAsStringAsync();

        raw.Should().Contain("\"success\"");
        raw.Should().Contain("\"data\"");
        raw.Should().Contain("\"meta\"");
        raw.Should().Contain("\"error\"");
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    private static void AddGatewayHeaders(HttpRequestMessage request, string? role = "Listener")
    {
        request.Headers.Add("X-User-Id", Guid.NewGuid().ToString());
        if (role is not null)
            request.Headers.Add("X-User-Role", role);
    }
}

// ─── Factory ──────────────────────────────────────────────────────────

public class NotificationWebApplicationFactory : WebApplicationFactory<Program>
{
    public Mock<INotificationService> ServiceMock { get; } = new();

    protected override void ConfigureWebHost(Microsoft.AspNetCore.Hosting.IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace all infrastructure with mocks
            services.RemoveAll<INotificationService>();
            services.AddScoped<INotificationService>(_ => ServiceMock.Object);

            // Remove background service (Kafka consumer) to avoid connection errors in tests
            services.RemoveAll<Microsoft.Extensions.Hosting.IHostedService>();

            // Remove real infrastructure registrations that require network
            services.RemoveAll<INotificationRepository>();
            services.RemoveAll<IIdempotencyRepository>();
            services.RemoveAll<IEventPublisher>();
            services.RemoveAll<IUserServiceClient>();
        });

        builder.UseEnvironment("Testing");
    }
}

// ─── Test DTO for deserialization ─────────────────────────────────────

internal class ApiTestResponse
{
    public bool Success { get; set; }
    public object? Data { get; set; }
    public ApiTestMeta? Meta { get; set; }
    public ApiTestError? Error { get; set; }
}

internal class ApiTestMeta
{
    public string? ApiVersion { get; set; }
    public string? RequestId { get; set; }
    public string? Timestamp { get; set; }
    public string? Cache { get; set; }
}

internal class ApiTestError
{
    public string? Code { get; set; }
    public string? Message { get; set; }
}
