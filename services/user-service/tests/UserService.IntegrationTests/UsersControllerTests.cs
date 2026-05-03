using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using Moq;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using UserService.Application.DTOs;
using UserService.Application.Interfaces;
using UserService.Application.Services;
using UserService.Domain.Models;
using UserService.Infrastructure.Data;

namespace UserService.IntegrationTests;

// Integration tests use in-memory DB + mock Redis/Kafka
// For real DB tests, use Testcontainers.PostgreSql (requires Docker)
public class UsersControllerTests : IClassFixture<TestWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly TestWebApplicationFactory _factory;

    public UsersControllerTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    // -------------------------------------------------------------------------
    // GET /api/v1/users/me
    // -------------------------------------------------------------------------

    [Fact]
    public async Task GetMe_WithValidToken_Returns200WithProfile_AC1_2_3()
    {
        // AC1.2.3: GET /users/me returns correct profile schema
        var userId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken(userId, "Listener"));

        var response = await _client.GetAsync("/api/v1/users/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeTrue();
        body.GetProperty("error").ValueKind.Should().Be(JsonValueKind.Null);

        var data = body.GetProperty("data");
        data.GetProperty("id").GetString().Should().Be(userId.ToString());
        data.GetProperty("role").GetString().Should().Be("Listener");

        var meta = body.GetProperty("meta");
        meta.GetProperty("apiVersion").GetString().Should().Be("v1");
        meta.GetProperty("requestId").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetMe_WithoutToken_Returns401()
    {
        // 401 UNAUTHORIZED — no token
        _client.DefaultRequestHeaders.Authorization = null;

        var response = await _client.GetAsync("/api/v1/users/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetMe_WithExpiredToken_Returns401()
    {
        // 401 TOKEN_EXPIRED
        var expiredToken = GenerateToken(Guid.NewGuid(), "Listener", expiresInSeconds: -60);
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", expiredToken);

        var response = await _client.GetAsync("/api/v1/users/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // -------------------------------------------------------------------------
    // POST /api/v1/users/me/preferences
    // -------------------------------------------------------------------------

    [Fact]
    public async Task UpdatePreferences_WithValidRequest_Returns200AndPublishesKafka_AC1_2_2()
    {
        // AC1.2.2: POST preferences → 200 + Kafka published
        var userId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken(userId, "Listener"));

        var response = await _client.PostAsJsonAsync("/api/v1/users/me/preferences", new
        {
            preferredGenres = new[] { "d4e5f6a7-b8c9-0123-defa-234567890123" },
            preferredLanguages = new[] { "vi", "en" },
            audioQuality = "high"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeTrue();
        body.GetProperty("data").GetProperty("updated").GetBoolean().Should().BeTrue();

        // Verify Kafka was called
        _factory.KafkaMock.Verify(k => k.PublishAsync(
            "User_Preferences_Updated",
            It.IsAny<UserService.Application.Events.IKafkaEvent>(),
            It.IsAny<CancellationToken>()), Times.AtLeastOnce);
    }

    [Fact]
    public async Task UpdatePreferences_WithInvalidAudioQuality_Returns400()
    {
        // 400 VALIDATION_ERROR
        var userId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", GenerateToken(userId, "Listener"));

        var response = await _client.PostAsJsonAsync("/api/v1/users/me/preferences", new
        {
            preferredGenres = Array.Empty<string>(),
            preferredLanguages = Array.Empty<string>(),
            audioQuality = "ultra"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("success").GetBoolean().Should().BeFalse();
        body.GetProperty("error").GetProperty("code").GetString().Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task UpdatePreferences_WithoutToken_Returns401()
    {
        _client.DefaultRequestHeaders.Authorization = null;

        var response = await _client.PostAsJsonAsync("/api/v1/users/me/preferences", new
        {
            preferredGenres = Array.Empty<string>(),
            preferredLanguages = Array.Empty<string>(),
            audioQuality = "standard"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // -------------------------------------------------------------------------
    // GET /internal/users/{id}/preferences
    // -------------------------------------------------------------------------

    [Fact]
    public async Task GetInternalPreferences_ReturnsPreferences_NoAuthRequired()
    {
        // Internal endpoint — no JWT required (service-to-service trust)
        _client.DefaultRequestHeaders.Authorization = null;
        var userId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

        var response = await _client.GetAsync($"/internal/users/{userId}/preferences");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static string GenerateToken(Guid userId, string role, int expiresInSeconds = 900)
    {
        const string secret = "test-secret-for-integration-tests-minimum-32-chars";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims: [new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim("role", role)],
            expires: DateTime.UtcNow.AddSeconds(expiresInSeconds),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class TestWebApplicationFactory : WebApplicationFactory<Program>
{
    public Mock<IKafkaProducer> KafkaMock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Test");
        builder.ConfigureServices(services =>
        {
            // Replace PostgreSQL with in-memory DB
            services.RemoveAll<DbContextOptions<UserDbContext>>();
            services.AddDbContext<UserDbContext>(o => o.UseInMemoryDatabase("user-test-db"));

            // Replace Redis with null cache
            services.RemoveAll<IRedisCache>();
            services.AddSingleton<IRedisCache, NullRedisCache>();

            // Replace Kafka with mock
            services.RemoveAll<IKafkaProducer>();
            services.AddSingleton(_ => KafkaMock.Object);

            // Seed test data
            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<UserDbContext>();
            db.Database.EnsureCreated();
            if (!db.Users.Any())
            {
                db.Users.Add(new User
                {
                    Id = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
                    Email = "listener@example.com",
                    Username = "listener",
                    DisplayName = "Test Listener",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("Test1234!"),
                    Role = "Listener",
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
                db.SaveChanges();
            }
        });

        builder.UseSetting("JWT_SECRET", "test-secret-for-integration-tests-minimum-32-chars");
        builder.UseSetting("Jwt:Secret", "test-secret-for-integration-tests-minimum-32-chars");
        builder.UseSetting("USER_DB_CONNECTION_STRING", "Host=localhost;Database=test");
        builder.UseSetting("REDIS_CONNECTION_STRING", "localhost:6379");
    }
}

// Null Redis cache for integration tests — no real Redis needed
public class NullRedisCache : IRedisCache
{
    public Task<T?> GetAsync<T>(string key, CancellationToken ct = default) => Task.FromResult<T?>(default);
    public Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default) => Task.CompletedTask;
    public Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan ttl) => Task.FromResult(true);
    public Task DeleteAsync(string key) => Task.CompletedTask;
}
