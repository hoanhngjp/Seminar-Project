using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using ListeningPartyService.Application.DTOs;
using ListeningPartyService.Application.Services;
using ListeningPartyService.Domain.Exceptions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Moq;

namespace ListeningPartyService.IntegrationTests;

public class PartiesIntegrationTests : IClassFixture<PartyWebApplicationFactory>
{
    private readonly HttpClient _client;
    private readonly Mock<IPartyService> _serviceMock;

    private static readonly string ValidUserId = Guid.NewGuid().ToString();

    public PartiesIntegrationTests(PartyWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
        _serviceMock = factory.ServiceMock;
    }

    private static void AddGatewayHeaders(HttpRequestMessage request, string? userId = null, string role = "Listener")
    {
        request.Headers.Add("X-User-Id", userId ?? ValidUserId);
        request.Headers.Add("X-User-Role", role);
    }

    // ─── POST /api/v1/parties ────────────────────────────────────────────

    [Fact]
    public async Task CreateParty_WithValidBody_Returns201WithRoomData_AC7_1_1()
    {
        // AC7.1.1: create party → roomId (UUID) + joinCode (6 ký tự)
        var expectedResponse = new CreatePartyResponse(
            Guid.NewGuid().ToString(),
            "ABC123",
            ValidUserId);

        _serviceMock
            .Setup(s => s.CreatePartyAsync(ValidUserId, "song-001", It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedResponse);

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/parties")
        {
            Content = JsonContent.Create(new { songId = "song-001" })
        };
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse<CreatePartyResponse>>();
        body!.Success.Should().BeTrue();
        body.Data.Should().NotBeNull();
        body.Data!.JoinCode.Should().Be("ABC123");
        body.Error.Should().BeNull();
    }

    [Fact]
    public async Task CreateParty_WithoutGatewayHeaders_Returns401()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/parties")
        {
            Content = JsonContent.Create(new { songId = "song-001" })
        };

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CreateParty_WithEmptySongId_Returns400ValidationError()
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/parties")
        {
            Content = JsonContent.Create(new { songId = "" })
        };
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse<object>>();
        body!.Success.Should().BeFalse();
        body.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task CreateParty_ResponseHasMetaFields()
    {
        _serviceMock
            .Setup(s => s.CreatePartyAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CreatePartyResponse(Guid.NewGuid().ToString(), "XYZ789", ValidUserId));

        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/parties")
        {
            Content = JsonContent.Create(new { songId = "song-001" })
        };
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse<CreatePartyResponse>>();

        body!.Meta.Should().NotBeNull();
        body.Meta!.ApiVersion.Should().Be("v1");
        body.Meta.RequestId.Should().NotBeNullOrEmpty();
        body.Meta.Timestamp.Should().NotBeNullOrEmpty();
    }

    // ─── POST /api/v1/parties/{joinCode}/join ────────────────────────────

    [Fact]
    public async Task JoinParty_WithValidJoinCode_Returns200WithRoomState_AC7_1_2()
    {
        // AC7.1.2: join hợp lệ → room state đầy đủ
        var hostId = Guid.NewGuid().ToString();
        var roomId = Guid.NewGuid().ToString();
        var joinCode = "VALID1";

        _serviceMock
            .Setup(s => s.JoinPartyAsync(joinCode, ValidUserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new JoinPartyResponse(roomId, hostId, "song-001", 30));

        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/parties/{joinCode}/join");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse<JoinPartyResponse>>();
        body!.Success.Should().BeTrue();
        body.Data!.RoomId.Should().Be(roomId);
        body.Data.HostId.Should().Be(hostId);
        body.Data.CurrentSongId.Should().Be("song-001");
        body.Data.PlaybackPositionSec.Should().Be(30);
    }

    [Fact]
    public async Task JoinParty_WithInvalidJoinCode_Returns404RoomNotFound_AC7_1_3()
    {
        // AC7.1.3: joinCode không tồn tại → 404 ROOM_NOT_FOUND
        var badCode = "BADCOD";

        _serviceMock
            .Setup(s => s.JoinPartyAsync(badCode, It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new RoomNotFoundException(badCode));

        var request = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/parties/{badCode}/join");
        AddGatewayHeaders(request);

        var response = await _client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadFromJsonAsync<ApiTestResponse<object>>();
        body!.Success.Should().BeFalse();
        body.Error!.Code.Should().Be("ROOM_NOT_FOUND");
        body.Data.Should().BeNull();
    }

    [Fact]
    public async Task JoinParty_WithoutGatewayHeaders_Returns401()
    {
        var response = await _client.PostAsync("/api/v1/parties/ABC123/join", null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}

// ─── Test response shape helpers ────────────────────────────────────────────

internal class ApiTestResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public ApiTestMeta? Meta { get; set; }
    public ApiTestError? Error { get; set; }
}

internal class ApiTestMeta
{
    public string? ApiVersion { get; set; }
    public string? RequestId { get; set; }
    public string? Timestamp { get; set; }
}

internal class ApiTestError
{
    public string? Code { get; set; }
    public string? Message { get; set; }
}
