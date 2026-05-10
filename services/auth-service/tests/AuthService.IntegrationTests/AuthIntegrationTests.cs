using System.Net;
using System.Net.Http.Json;
using AuthService.Application.DTOs;
using FluentAssertions;
using Moq;
using Xunit;

namespace AuthService.IntegrationTests;

public class AuthIntegrationTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public AuthIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsOkAndSetCookie()
    {
        // Arrange
        var request = new LoginRequest { Username = "validuser", Password = "password" };
        var userId = Guid.NewGuid().ToString();

        _factory.UserGrpcClientMock.Setup(u => u.VerifyCredentialsAsync("validuser", "password", It.IsAny<CancellationToken>()))
            .ReturnsAsync((userId, "Listener"));

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>();
        body.Should().NotBeNull();
        body!.Success.Should().BeTrue();
        body.Data.Should().NotBeNull();
        body.Data!.AccessToken.Should().NotBeEmpty();

        var setCookies = response.Headers.TryGetValues("Set-Cookie", out var cookies) ? cookies.ToList() : new List<string>();
        setCookies.Should().NotBeEmpty("No Set-Cookie headers found");
        var setCookie = setCookies.First();
        setCookie.Should().Contain("refreshToken=");
        setCookie.Should().Contain("httponly");
        setCookie.Should().Contain("secure");
    }

    [Fact]
    public async Task Login_WithInvalidCredentials_ReturnsUnauthorized()
    {
        // Arrange
        var request = new LoginRequest { Username = "invaliduser", Password = "password" };

        _factory.UserGrpcClientMock.Setup(u => u.VerifyCredentialsAsync("invaliduser", "password", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Domain.Exceptions.UnauthorizedException("AUTH_INVALID_CREDENTIALS", "Invalid credentials."));

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Success.Should().BeFalse();
        body.Error!.Code.Should().Be("AUTH_INVALID_CREDENTIALS");
    }

    [Fact]
    public async Task Register_WithValidData_Returns201AndUserId()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "newuser@example.com",
            Password = "Password1",
            DisplayName = "New User",
            Role = "Listener"
        };
        var expectedResponse = new RegisterResponse
        {
            UserId = Guid.NewGuid().ToString(),
            Email = request.Email,
            DisplayName = request.DisplayName,
            Role = "Listener"
        };

        _factory.UserGrpcClientMock
            .Setup(u => u.CreateUserAsync(It.IsAny<RegisterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResponse);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<RegisterResponse>>();
        body!.Success.Should().BeTrue();
        body.Data!.Email.Should().Be(request.Email);
        body.Data.Role.Should().Be("Listener");
        body.Error.Should().BeNull();
    }

    [Fact]
    public async Task Register_WithMissingEmail_Returns400ValidationError()
    {
        // Arrange
        var request = new RegisterRequest { Email = "", Password = "Password1", DisplayName = "Name" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Success.Should().BeFalse();
        body.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Register_WithWeakPassword_Returns400ValidationError()
    {
        // Arrange — password < 8 chars
        var request = new RegisterRequest { Email = "e@e.com", Password = "short", DisplayName = "Name" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Register_WithDuplicateEmail_Returns400ValidationError()
    {
        // Arrange — gRPC client maps AlreadyExists → ValidationException
        var request = new RegisterRequest
        {
            Email = "taken@example.com",
            Password = "Password1",
            DisplayName = "Someone"
        };

        _factory.UserGrpcClientMock
            .Setup(u => u.CreateUserAsync(It.IsAny<RegisterRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Domain.Exceptions.ValidationException("Email is already registered."));

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Register_WithCreatorRole_Returns201WithCreatorRole()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "creator@example.com",
            Password = "Demo1234!",
            DisplayName = "Demo Creator",
            Role = "Creator"
        };
        var expectedResponse = new RegisterResponse
        {
            UserId = Guid.NewGuid().ToString(),
            Email = request.Email,
            DisplayName = request.DisplayName,
            Role = "Creator"
        };

        _factory.UserGrpcClientMock
            .Setup(u => u.CreateUserAsync(It.IsAny<RegisterRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResponse);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/register", request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<RegisterResponse>>();
        body!.Data!.Role.Should().Be("Creator");
    }
}
