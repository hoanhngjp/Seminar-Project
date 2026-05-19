# TEST_PLAN.md — Smart Music Streaming Platform

## 1. Testing Strategy Overview

**Philosophy: "Test what matters, not everything"**

For a 3-4 person academic team with one semester, comprehensive 100% coverage is neither realistic nor valuable. Instead, focus testing effort on:

- **Unit tests**: Pure business logic with no I/O — Rule Engine scoring, JWT parsing, idempotency logic, byte-range parsing
- **Integration tests**: Service boundaries — HTTP endpoints, DB writes, Kafka round-trip
- **Load tests**: Latency budgets from API_DESIGN_V2
- **Chaos tests**: Fallback behaviors documented in Backlog V7 Failure Handling

### Coverage Targets

| Layer | Target | Scope |
|---|---|---|
| Unit tests | 70% line coverage | Business logic classes only |
| Integration tests | All Happy Path ACs + critical error paths | Per Epic |
| Load tests | All endpoints with latency budget | Run before each sprint demo |
| Chaos tests | 4 scenarios | Run once before final demo |

---

## 2. Testing Tools & Setup

### C# Services

```xml
<!-- Add to each test project .csproj -->
<PackageReference Include="xunit" Version="2.9.*" />
<PackageReference Include="xunit.runner.visualstudio" Version="2.8.*" />
<PackageReference Include="Moq" Version="4.20.*" />
<PackageReference Include="FluentAssertions" Version="6.12.*" />
<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.0.*" />
<PackageReference Include="Testcontainers" Version="3.8.*" />
<PackageReference Include="Testcontainers.PostgreSql" Version="3.8.*" />
<PackageReference Include="Testcontainers.Redis" Version="3.8.*" />
```

### Python (Recommendation Service)

```
pytest==8.2.*
httpx==0.27.*
pytest-asyncio==0.23.*
respx==0.21.*          # mock httpx calls
fakeredis[aioredis]    # in-memory Redis for tests
```

### Load Testing (k6)

```bash
# Install: https://k6.io/docs/getting-started/installation/
k6 run tests/load/streaming_url.js
k6 run tests/load/gateway_routing.js
k6 run tests/load/search.js
k6 run tests/load/recommendation.js
```

### Chaos Testing

Manual chaos via docker-compose (appropriate for academic team — no need for Chaos Monkey):

```bash
docker-compose stop redis           # simulate Redis down
docker-compose stop kafka           # simulate Kafka down
docker-compose stop auth-service    # simulate Auth Service down
docker-compose stop elasticsearch   # simulate Search down
```

---

## 3. Unit Tests

### 3.1 Recommendation Service — Rule Engine Scoring

**File**: `services/recommendation-service/tests/unit/test_rule_engine.py`

```python
import pytest
import asyncio
from services.rule_engine import RuleEngine, UserWeights, SongCandidate


@pytest.fixture
def engine():
    return RuleEngine()


class TestContextScoring:
    def test_morning_context_boosts_acoustic_songs(self, engine):
        # Arrange
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id="e5f6a7b8-c9d0-1234-efab-567890123456",
            mood_tags=["acoustic", "morning"]
        )
        weights = UserWeights(genre_weights={})

        # Act
        score = engine.compute_score(candidate, context="morning", weights=weights)

        # Assert
        assert score.context_bonus == 0.3

    def test_non_matching_context_gives_zero_bonus(self, engine):
        # Arrange
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id="b8c9d0e1-f2a3-4567-bcde-890123456789",
            mood_tags=["energetic", "party"]
        )
        weights = UserWeights(genre_weights={})

        # Act
        score = engine.compute_score(candidate, context="morning", weights=weights)

        # Assert
        assert score.context_bonus == 0.0

    def test_play_weight_increases_genre_score(self, engine):
        # Arrange
        genre_id = "d4e5f6a7-b8c9-0123-defa-234567890123"
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id=genre_id,
            mood_tags=[]
        )
        weights = UserWeights(genre_weights={genre_id: 1.5})  # boosted by play history

        # Act
        score = engine.compute_score(candidate, context="none", weights=weights)

        # Assert
        assert score.preference_bonus > 0

    def test_skip_penalty_reduces_genre_score(self, engine):
        # Arrange
        genre_id = "b8c9d0e1-f2a3-4567-bcde-890123456789"
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id=genre_id,
            mood_tags=[]
        )
        weights = UserWeights(genre_weights={genre_id: 0.2})  # penalized by skip history

        # Act
        score = engine.compute_score(candidate, context="none", weights=weights)

        # Assert
        assert score.preference_bonus < 0

    def test_final_score_is_sum_of_components(self, engine):
        # Arrange
        genre_id = "e5f6a7b8-c9d0-1234-efab-567890123456"
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id=genre_id,
            mood_tags=["acoustic"]
        )
        weights = UserWeights(genre_weights={genre_id: 1.2})

        # Act
        score = engine.compute_score(candidate, context="morning", weights=weights)

        # Assert: total must equal sum of all components
        expected = score.base_score + score.context_bonus + score.preference_bonus - score.skip_penalty
        assert abs(score.total - expected) < 0.001

    def test_timeout_constant_is_300ms(self, engine):
        # AC2.1.5: Caller uses this constant to enforce timeout budget
        assert engine.TIMEOUT_MS == 300

    def test_response_includes_explain_text(self, engine):
        # AC2.1.4: Each scored candidate must have explain_text
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id="d4e5f6a7-b8c9-0123-defa-234567890123",
            mood_tags=["acoustic"]
        )
        weights = UserWeights(genre_weights={})
        score = engine.compute_score(candidate, context="morning", weights=weights)

        assert score.explain_text is not None
        assert len(score.explain_text) > 0
```

### 3.2 Auth Service — JWT Validation

**File**: `services/auth-service/tests/AuthService.UnitTests/TokenServiceTests.cs`

```csharp
using FluentAssertions;
using Microsoft.Extensions.Options;
using Xunit;

namespace AuthService.UnitTests;

public class TokenServiceTests
{
    private readonly TokenService _sut;
    private readonly JwtSettings _settings = new()
    {
        Secret = "test-secret-key-minimum-32-characters-long",
        AccessTokenExpiry = 3600,
        RefreshTokenExpiry = 604800
    };

    public TokenServiceTests()
    {
        _sut = new TokenService(Options.Create(_settings));
    }

    [Fact]
    public void GenerateAccessToken_ShouldContainCorrectClaims()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var role = "Listener";

        // Act
        var token = _sut.GenerateAccessToken(userId, role);
        var claims = _sut.ParseClaims(token);

        // Assert
        claims.Should().ContainKey("sub").WhoseValue.Should().Be(userId.ToString());
        claims.Should().ContainKey("role").WhoseValue.Should().Be("Listener");
    }

    [Fact]
    public void ValidateToken_WithExpiredToken_ShouldReturnFalse()
    {
        // Arrange
        var expiredSettings = new JwtSettings
        {
            Secret = _settings.Secret,
            AccessTokenExpiry = -1  // already expired
        };
        var sut = new TokenService(Options.Create(expiredSettings));
        var token = sut.GenerateAccessToken(Guid.NewGuid(), "Listener");

        // Act
        var result = _sut.ValidateToken(token);

        // Assert
        result.IsValid.Should().BeFalse();
        result.ErrorCode.Should().Be("TOKEN_EXPIRED");
    }

    [Fact]
    public void ValidateToken_WithTamperedSignature_ShouldReturnFalse()
    {
        // Arrange
        var token = _sut.GenerateAccessToken(Guid.NewGuid(), "Listener");
        var tampered = token[..^5] + "XXXXX";

        // Act
        var result = _sut.ValidateToken(tampered);

        // Assert
        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void GenerateRefreshToken_ShouldBeCryptographicallyRandom()
    {
        // Act
        var token1 = _sut.GenerateRefreshToken();
        var token2 = _sut.GenerateRefreshToken();

        // Assert
        token1.Should().NotBe(token2);
        token1.Length.Should().BeGreaterThanOrEqualTo(32);
    }

    [Fact]
    public void GenerateAccessToken_ShouldExpireAfterConfiguredSeconds()
    {
        // Arrange
        var shortSettings = new JwtSettings
        {
            Secret = _settings.Secret,
            AccessTokenExpiry = 1  // 1 second
        };
        var sut = new TokenService(Options.Create(shortSettings));

        // Act
        var token = sut.GenerateAccessToken(Guid.NewGuid(), "Listener");
        var claimsBefore = sut.ParseClaims(token);

        // Assert: exp claim is set correctly
        claimsBefore.Should().ContainKey("exp");
    }
}
```

### 3.3 Idempotency Check — Redis SET Pattern

**File**: `services/analytics-service/tests/AnalyticsService.UnitTests/IdempotencyServiceTests.cs`

```csharp
using FluentAssertions;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace AnalyticsService.UnitTests;

public class IdempotencyServiceTests
{
    private readonly Mock<IDatabase> _redisMock = new();
    private readonly IdempotencyService _sut;

    public IdempotencyServiceTests()
    {
        _sut = new IdempotencyService(_redisMock.Object);
    }

    [Fact]
    public async Task CheckAndSet_WhenKeyNotExists_ShouldReturnFalse_AndSetKey()
    {
        // Arrange: SETNX returns true (key was set = not a duplicate)
        _redisMock
            .Setup(r => r.StringSetAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                TimeSpan.FromHours(24),
                When.NotExists,
                CommandFlags.None))
            .ReturnsAsync(true);

        // Act
        var isDuplicate = await _sut.CheckAndSetAsync("evt-abc-123", TimeSpan.FromHours(24));

        // Assert
        isDuplicate.Should().BeFalse();  // not a duplicate — process this event
        _redisMock.Verify(r => r.StringSetAsync(
            It.Is<RedisKey>(k => k.ToString().Contains("evt-abc-123")),
            It.IsAny<RedisValue>(),
            TimeSpan.FromHours(24),
            When.NotExists,
            CommandFlags.None), Times.Once);
    }

    [Fact]
    public async Task CheckAndSet_WhenKeyExists_ShouldReturnTrue_IsDuplicate()
    {
        // Arrange: SETNX returns false (key already exists = duplicate)
        _redisMock
            .Setup(r => r.StringSetAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<TimeSpan?>(),
                When.NotExists,
                CommandFlags.None))
            .ReturnsAsync(false);

        // Act
        var isDuplicate = await _sut.CheckAndSetAsync("evt-abc-123", TimeSpan.FromHours(24));

        // Assert
        isDuplicate.Should().BeTrue();  // is a duplicate — skip processing
    }

    [Fact]
    public async Task CheckAndSet_ShouldUseTtlOf24Hours()
    {
        // Arrange
        _redisMock
            .Setup(r => r.StringSetAsync(
                It.IsAny<RedisKey>(),
                It.IsAny<RedisValue>(),
                It.IsAny<TimeSpan?>(),
                When.NotExists,
                CommandFlags.None))
            .ReturnsAsync(true);

        // Act
        await _sut.CheckAndSetAsync("evt-abc-123", TimeSpan.FromHours(24));

        // Assert: TTL must be exactly 24h per Redis key design
        _redisMock.Verify(r => r.StringSetAsync(
            It.IsAny<RedisKey>(),
            It.IsAny<RedisValue>(),
            TimeSpan.FromHours(24),
            When.NotExists,
            CommandFlags.None), Times.Once);
    }
}
```

### 3.4 Streaming — HTTP Range Request Byte Parsing

**File**: `services/streaming-service/tests/StreamingService.UnitTests/RangeRequestParserTests.cs`

```csharp
using FluentAssertions;
using Xunit;

namespace StreamingService.UnitTests;

public class RangeRequestParserTests
{
    [Theory]
    [InlineData("bytes=0-65535", 0, 65535)]
    [InlineData("bytes=1048576-2097151", 1048576, 2097151)]
    [InlineData("bytes=0-", 0, null)]       // open-ended range
    [InlineData("bytes=65536-131071", 65536, 131071)]
    public void ParseRangeHeader_ShouldReturnCorrectByteRange(
        string header, long expectedStart, long? expectedEnd)
    {
        // Act
        var result = RangeRequestParser.Parse(header);

        // Assert
        result.Should().NotBeNull();
        result!.Start.Should().Be(expectedStart);
        result.End.Should().Be(expectedEnd);
    }

    [Theory]
    [InlineData("")]
    [InlineData("invalid")]
    [InlineData("bytes=abc-def")]
    [InlineData("units=0-65535")]   // wrong unit prefix
    public void ParseRangeHeader_WithInvalidInput_ShouldReturnNull(string header)
    {
        // Act
        var result = RangeRequestParser.Parse(header);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void ParseRangeHeader_WhenStartExceedsEnd_ShouldReturnNull()
    {
        // Act
        var result = RangeRequestParser.Parse("bytes=1000-500");

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public void ParseRangeHeader_WhenStartEqualsEnd_ShouldReturnSingleByteRange()
    {
        // Act
        var result = RangeRequestParser.Parse("bytes=512-512");

        // Assert
        result.Should().NotBeNull();
        result!.Start.Should().Be(512);
        result.End.Should().Be(512);
    }
}
```

### 3.5 Listening Party — Reconnect Exponential Backoff

**File**: `services/listening-party-service/tests/ListeningParty.UnitTests/ReconnectStrategyTests.cs`

```csharp
using FluentAssertions;
using Xunit;

namespace ListeningParty.UnitTests;

public class ReconnectStrategyTests
{
    private readonly ExponentialBackoffStrategy _sut = new(
        initialDelayMs: 1000,
        maxDelayMs: 30_000,
        multiplier: 2.0
    );

    [Theory]
    [InlineData(1, 1000)]    // 1st retry: 1s
    [InlineData(2, 2000)]    // 2nd retry: 2s
    [InlineData(3, 4000)]    // 3rd retry: 4s
    [InlineData(4, 8000)]    // 4th retry: 8s
    [InlineData(5, 16000)]   // 5th retry: 16s
    public void GetDelay_ShouldDoubleEachRetry(int attemptNumber, int expectedMs)
    {
        // Act
        var delay = _sut.GetDelay(attemptNumber);

        // Assert
        delay.TotalMilliseconds.Should().Be(expectedMs);
    }

    [Fact]
    public void GetDelay_ShouldNeverExceed30Seconds_AC7_3_2()
    {
        // Act: attempt well beyond cap
        var delay = _sut.GetDelay(20);

        // Assert
        delay.TotalMilliseconds.Should().Be(30_000);
    }

    [Fact]
    public void GetDelay_AtAttempt6_ShouldCapAt30Seconds()
    {
        // 2^5 * 1000 = 32000 > 30000 → should cap
        var delay = _sut.GetDelay(6);

        delay.TotalMilliseconds.Should().Be(30_000);
    }
}
```

---

## 4. Integration Tests

Use `WebApplicationFactory` + `Testcontainers` for real PostgreSQL/Redis in CI. Each test class that requires infrastructure implements `IClassFixture<TFactory>`.

### 4.1 Auth Flow — Login → Refresh → Logout

**File**: `services/auth-service/tests/AuthService.IntegrationTests/AuthIntegrationTests.cs`

```csharp
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace AuthService.IntegrationTests;

public class AuthIntegrationTests : IClassFixture<AuthWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AuthIntegrationTests(AuthWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Login_WithValidCredentials_ShouldReturnTokens_AC1_1_1()
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            username = "testlistener@example.com",
            password = "TestPassword123!"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<LoginResponse>>();
        body!.Success.Should().BeTrue();
        body.Data!.AccessToken.Should().NotBeNullOrEmpty();
        response.Headers.Should().ContainKey("Set-Cookie");  // HTTP-only refresh token
    }

    [Fact]
    public async Task Login_WithWrongPassword_ShouldReturn400_AC1_1_2()
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            username = "testlistener@example.com",
            password = "WrongPassword"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("AUTH_INVALID_CREDENTIALS");
    }

    [Fact]
    public async Task Login_After5FailedAttempts_ShouldReturn423_AC1_1_3()
    {
        // Arrange: exhaust failed attempts
        for (int i = 0; i < 5; i++)
        {
            await _client.PostAsJsonAsync("/api/v1/auth/login", new
            {
                username = "lockme@example.com",
                password = "WrongPassword"
            });
        }

        // Act: 6th attempt
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            username = "lockme@example.com",
            password = "WrongPassword"
        });

        // Assert
        response.StatusCode.Should().Be((HttpStatusCode)423);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("ACCOUNT_LOCKED");
    }

    [Fact]
    public async Task RefreshToken_WhenReused_ShouldRevoke_AllSessions_AC1_1_4()
    {
        // Arrange: get initial tokens
        var loginResp = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            username = "testlistener@example.com",
            password = "TestPassword123!"
        });
        var originalCookie = loginResp.Headers.GetValues("Set-Cookie").First();

        // First refresh — valid
        var req1 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        req1.Headers.Add("Cookie", originalCookie);
        var resp1 = await _client.SendAsync(req1);
        resp1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Act: reuse original refresh token (token rotation violation)
        var req2 = new HttpRequestMessage(HttpMethod.Post, "/api/v1/auth/refresh");
        req2.Headers.Add("Cookie", originalCookie);
        var resp2 = await _client.SendAsync(req2);

        // Assert: all sessions revoked, TOKEN_REUSED error
        resp2.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await resp2.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("TOKEN_REUSED");
    }
}
```

### 4.2 Onboarding — Preferences & Kafka Event

**File**: `services/user-service/tests/UserService.IntegrationTests/OnboardingTests.cs`

```csharp
public class OnboardingTests : IClassFixture<UserWebApplicationFactory>
{
    private readonly HttpClient _client;

    public OnboardingTests(UserWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task NewUser_WithoutPreferences_MustSelectAtLeast3Genres_AC1_2_1()
    {
        // Arrange: authenticated new user (no preferences saved)
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.NewUserToken);

        // Act: try to skip onboarding with only 2 genres
        var response = await _client.PostAsJsonAsync("/api/v1/users/onboarding", new
        {
            genre_ids = new[] { TestData.GenreIndiePop, TestData.GenreAcoustic }  // only 2
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task SavePreferences_ShouldPublishKafkaEvent_AC1_2_2()
    {
        // Arrange
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.NewUserToken);
        var correlationId = Guid.NewGuid().ToString();
        _client.DefaultRequestHeaders.Add("Idempotency-Key", correlationId);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/users/onboarding", new
        {
            genre_ids = new[] { TestData.GenreIndiePop, TestData.GenreAcoustic, TestData.GenreLoFi }
        });

        // Assert: 200 OK + Kafka event published
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var kafkaConsumed = await WaitForKafkaMessage(
            topic: "User_Preferences_Updated",
            correlationId: correlationId,
            timeout: TimeSpan.FromSeconds(10));
        kafkaConsumed.Should().BeTrue("Kafka User_Preferences_Updated must be published");
    }

    [Fact]
    public async Task SavePreferences_WhenAlreadyExists_ShouldReturn200_AC1_2_3()
    {
        // Arrange: user who already completed onboarding
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/users/onboarding", new
        {
            genre_ids = new[] { TestData.GenreIndiePop, TestData.GenreAcoustic, TestData.GenreLoFi }
        });

        // Assert: idempotent — returns 200, no error
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

### 4.3 Music Upload

**File**: `services/music-service/tests/MusicService.IntegrationTests/MusicUploadTests.cs`

```csharp
public class MusicUploadTests : IClassFixture<MusicWebApplicationFactory>
{
    private readonly HttpClient _client;

    public MusicUploadTests(MusicWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.CreatorToken);
    }

    [Fact]
    public async Task Upload_ValidFile_ShouldSaveToS3AndDB_AC1_3_1()
    {
        // Arrange: 5MB MP3 file (within 50MB limit)
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(GenerateFakeAudio(sizeBytes: 5 * 1024 * 1024)), "file", "test.mp3");
        content.Add(new StringContent("Chúng Ta Của Hiện Tại"), "title");
        content.Add(new StringContent("287"), "duration_sec");
        content.Add(new StringContent(TestData.GenreIndiePop.ToString()), "genre_id");

        _client.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());

        // Act
        var response = await _client.PostAsync("/api/v1/music/upload", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<UploadResponse>>();
        body!.Data!.SongId.Should().NotBeEmpty();
        body.Data.S3Key.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Upload_Success_ShouldPublishNewReleaseEvent_AC1_3_2()
    {
        // Arrange
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(GenerateFakeAudio(sizeBytes: 1 * 1024 * 1024)), "file", "test.mp3");
        content.Add(new StringContent("Test Song"), "title");
        content.Add(new StringContent("180"), "duration_sec");
        content.Add(new StringContent(TestData.GenreIndiePop.ToString()), "genre_id");

        var idempotencyKey = Guid.NewGuid().ToString();
        _client.DefaultRequestHeaders.Add("Idempotency-Key", idempotencyKey);

        // Act
        var response = await _client.PostAsync("/api/v1/music/upload", content);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        // Assert: Kafka New_Release published
        var kafkaConsumed = await WaitForKafkaMessage(
            topic: "New_Release",
            correlationId: idempotencyKey,
            timeout: TimeSpan.FromSeconds(10));
        kafkaConsumed.Should().BeTrue("New_Release Kafka event must be published after upload");
    }

    [Fact]
    public async Task Upload_OversizeFile_ShouldReturn400_AC1_3_3()
    {
        // Arrange: 51MB file — exceeds 50MB limit
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(GenerateFakeAudio(sizeBytes: 51 * 1024 * 1024)), "file", "large.mp3");
        content.Add(new StringContent("Test Song"), "title");
        content.Add(new StringContent("180"), "duration_sec");
        content.Add(new StringContent(TestData.GenreIndiePop.ToString()), "genre_id");

        // Act
        var response = await _client.PostAsync("/api/v1/music/upload", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Upload_InvalidFormat_ShouldReturn400_AC1_3_3()
    {
        // Arrange: DOCX file uploaded as audio
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(new byte[] { 0x50, 0x4B, 0x03, 0x04 }), "file", "fake.mp3");
        content.Add(new StringContent("Test Song"), "title");
        content.Add(new StringContent("180"), "duration_sec");
        content.Add(new StringContent(TestData.GenreIndiePop.ToString()), "genre_id");

        // Act
        var response = await _client.PostAsync("/api/v1/music/upload", content);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    private static byte[] GenerateFakeAudio(int sizeBytes) => new byte[sizeBytes];
}
```

### 4.4 Streaming — Pre-signed URL & Range Requests

**File**: `services/streaming-service/tests/StreamingService.IntegrationTests/StreamingTests.cs`

```csharp
public class StreamingTests : IClassFixture<StreamingWebApplicationFactory>
{
    private readonly HttpClient _client;

    public StreamingTests(StreamingWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);
    }

    [Fact]
    public async Task GetStreamingUrl_ShouldReturn900SecondExpiry_AC3_1_3()
    {
        // Act
        var response = await _client.GetAsync($"/api/v1/streaming/{TestData.SongId1}/url");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<StreamingUrlResponse>>();
        body!.Data!.ExpiresIn.Should().Be(900);    // 15 minutes = 900 seconds
        body.Data.StreamUrl.Should().StartWith("https://");
    }

    [Fact]
    public async Task GetStreamingUrl_WithRangeHeader_ShouldReturn206_AC3_1_2()
    {
        // Arrange: seek to ~01:45 (bytes 1048576–2097151 of a 128kbps MP3)
        var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"/api/v1/streaming/{TestData.SongId1}/chunk");
        request.Headers.Add("Authorization", $"Bearer {TestData.ListenerToken}");
        request.Headers.Range = new RangeHeaderValue(1048576, 2097151);

        // Act
        var response = await _client.SendAsync(request);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.PartialContent);
        response.Content.Headers.ContentRange.Should().NotBeNull();
        response.Content.Headers.ContentRange!.From.Should().Be(1048576);
        response.Content.Headers.ContentRange.To.Should().Be(2097151);
    }

    [Fact]
    public async Task GetStreamingUrl_WithoutAuth_ShouldReturn401()
    {
        // Arrange: no auth header
        var client = new HttpClient { BaseAddress = _client.BaseAddress };

        // Act
        var response = await client.GetAsync($"/api/v1/streaming/{TestData.SongId1}/url");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
```

### 4.5 Analytics — Kafka Publish & Idempotency

**File**: `services/analytics-service/tests/AnalyticsService.IntegrationTests/AnalyticsIntegrationTests.cs`

```csharp
public class AnalyticsIntegrationTests : IClassFixture<AnalyticsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AnalyticsIntegrationTests(AnalyticsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);
    }

    [Fact]
    public async Task AnalyticsEndpoint_ShouldReturn202Immediately_AC4_1_4()
    {
        // Act
        _client.DefaultRequestHeaders.Add("Idempotency-Key", Guid.NewGuid().ToString());
        var response = await _client.PostAsJsonAsync("/api/v1/analytics/events/play", new
        {
            event_id = Guid.NewGuid().ToString(),
            song_id = TestData.SongId1,
            duration_sec = 214,
            duration_percent = 92.5
        });

        // Assert: async processing — must return immediately
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);
    }

    [Fact]
    public async Task AnalyticsEvent_ShouldBePublishedToKafka_AC4_1_1()
    {
        // Arrange
        var eventId = Guid.NewGuid().ToString();
        _client.DefaultRequestHeaders.Add("Idempotency-Key", eventId);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/analytics/events/play", new
        {
            event_id = eventId,
            song_id = TestData.SongId1,
            duration_sec = 214,
            duration_percent = 92.5
        });
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);

        // Assert: wait for Kafka consumer to process
        var consumed = await WaitForKafkaMessage(
            topic: "Song_Played",
            eventId: eventId,
            timeout: TimeSpan.FromSeconds(10));
        consumed.Should().BeTrue("Song_Played event must be published to Kafka");
    }

    [Fact]
    public async Task SkipEvent_ShouldPublishSongSkipped_AC4_1_2()
    {
        // Arrange
        var eventId = Guid.NewGuid().ToString();
        _client.DefaultRequestHeaders.Add("Idempotency-Key", eventId);

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/analytics/events/skip", new
        {
            event_id = eventId,
            song_id = TestData.SongId1,
            skipped_at_sec = 45,
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
        response.StatusCode.Should().Be(HttpStatusCode.Accepted);

        // Assert
        var consumed = await WaitForKafkaMessage(
            topic: "Song_Skipped",
            eventId: eventId,
            timeout: TimeSpan.FromSeconds(10));
        consumed.Should().BeTrue("Song_Skipped event must be published to Kafka");
    }

    [Fact]
    public async Task AnalyticsEvent_DuplicateEventId_ShouldBeSkipped_AC4_1_3()
    {
        // Arrange
        var eventId = Guid.NewGuid().ToString();
        var payload = new
        {
            event_id = eventId,
            song_id = TestData.SongId1,
            duration_sec = 214,
            duration_percent = 92.5
        };

        // First call
        _client.DefaultRequestHeaders.Add("Idempotency-Key", eventId);
        await _client.PostAsJsonAsync("/api/v1/analytics/events/play", payload);

        // Act: second call with same idempotency key
        var response2 = await _client.PostAsJsonAsync("/api/v1/analytics/events/play", payload);

        // Assert: 409 conflict
        response2.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await response2.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("IDEMPOTENCY_CONFLICT");
    }

    [Fact]
    public async Task GetHeatmap_AsListener_ShouldReturn403_AC4_2_3()
    {
        // Arrange: Listener role (not Creator)
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);

        // Act
        var response = await _client.GetAsync(
            $"/api/v1/analytics/creator/heatmap/{TestData.SongId1}?range=7d");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("FORBIDDEN");
    }

    [Fact]
    public async Task GetHeatmap_AsCreator_ShouldReturnSkipRatePerSecond_AC4_2_1()
    {
        // Arrange: Creator role
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.CreatorToken);

        // Act
        var response = await _client.GetAsync(
            $"/api/v1/analytics/creator/heatmap/{TestData.SongId1}?range=7d");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<HeatmapResponse>>();
        body!.Data!.DataPoints.Should().NotBeEmpty();
        body.Data.DataPoints.Should().OnlyContain(dp => dp.Second >= 0);
    }
}
```

### 4.6 Search — Fuzzy & Pagination

**File**: `services/search-service/tests/SearchService.IntegrationTests/SearchTests.cs`

```csharp
public class SearchTests : IClassFixture<SearchWebApplicationFactory>
{
    private readonly HttpClient _client;

    public SearchTests(SearchWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);
    }

    [Fact]
    public async Task FuzzySearch_WithTypo_ShouldReturnCorrectArtist_AC5_1_1()
    {
        // Act: "son tug" should match "Sơn Tùng M-TP" via Elasticsearch fuzzy
        var response = await _client.GetAsync(
            "/api/v1/search?q=son%20tug&type=all&limit=10");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<SearchResponse>>();
        body!.Data!.Artists.Should().ContainSingle(a =>
            a.StageName.Contains("Sơn Tùng", StringComparison.OrdinalIgnoreCase));
        body.Data.Artists.First().RelevanceScore.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Search_NoResults_ShouldReturnEmptyArray_AC5_1_3()
    {
        // Act: gibberish query
        var response = await _client.GetAsync(
            "/api/v1/search?q=xyzxyzxyz_nonexistent_7q9w&type=all&limit=10");

        // Assert: empty array, not error
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<SearchResponse>>();
        body!.Success.Should().BeTrue();
        body.Data!.Songs.Should().BeEmpty();
        body.Data.Artists.Should().BeEmpty();
    }

    [Fact]
    public async Task Search_ShouldSupportCursorPagination_AC5_1_4()
    {
        // Act: first page
        var response1 = await _client.GetAsync(
            "/api/v1/search?q=nhac&type=all&limit=5");
        var body1 = await response1.Content.ReadFromJsonAsync<ApiResponse<SearchResponse>>();
        var cursor = body1!.Meta!.NextCursor;
        cursor.Should().NotBeNullOrEmpty();

        // Act: next page using cursor
        var response2 = await _client.GetAsync(
            $"/api/v1/search?q=nhac&type=all&limit=5&cursor={cursor}");
        var body2 = await response2.Content.ReadFromJsonAsync<ApiResponse<SearchResponse>>();

        // Assert: different pages, not duplicates
        response2.StatusCode.Should().Be(HttpStatusCode.OK);
        var page1Ids = body1.Data!.Songs.Select(s => s.SongId).ToHashSet();
        var page2Ids = body2!.Data!.Songs.Select(s => s.SongId).ToHashSet();
        page1Ids.Intersect(page2Ids).Should().BeEmpty("pages must not overlap");
    }
}
```

### 4.7 Notification — Fan-out & Mark as Read

**File**: `services/notification-service/tests/NotificationService.IntegrationTests/NotificationTests.cs`

```csharp
public class NotificationTests : IClassFixture<NotificationWebApplicationFactory>
{
    private readonly HttpClient _client;

    public NotificationTests(NotificationWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task NewRelease_ShouldFanoutToFollowers_AC6_1_1()
    {
        // Arrange: publish New_Release event to Kafka directly
        var artistId = TestData.CreatorUserId;
        var songId = Guid.NewGuid();
        await PublishKafkaEvent("New_Release", new
        {
            song_id = songId,
            artist_id = artistId,
            title = "Test New Song"
        });

        // Assert: followers receive notification (poll with timeout)
        await Task.Delay(2000);  // allow consumer to process

        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);  // listener follows creator
        var response = await _client.GetAsync("/api/v1/notifications?limit=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<NotificationListResponse>>();
        body!.Data!.Notifications.Should().ContainSingle(n =>
            n.Type == "NEW_RELEASE" && n.RelatedId == songId.ToString());
    }

    [Fact]
    public async Task GetNotifications_ShouldReturnUnreadWithPagination_AC6_1_2()
    {
        // Arrange
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);

        // Act
        var response = await _client.GetAsync("/api/v1/notifications?limit=5");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<NotificationListResponse>>();
        body!.Data!.Notifications.Should().OnlyContain(n => !n.IsRead);
        body.Meta!.NextCursor.Should().NotBeNull();
    }

    [Fact]
    public async Task MarkAsRead_ShouldBeIdempotent_AC6_1_3()
    {
        // Arrange: get a notification ID
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);
        var notificationId = TestData.UnreadNotificationId;

        // Act: mark as read twice
        var resp1 = await _client.PatchAsync(
            $"/api/v1/notifications/{notificationId}/read", null);
        var resp2 = await _client.PatchAsync(
            $"/api/v1/notifications/{notificationId}/read", null);

        // Assert: both succeed (idempotent)
        resp1.StatusCode.Should().Be(HttpStatusCode.OK);
        resp2.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

### 4.8 API Gateway — Auth & Circuit Breaker

**File**: `services/api-gateway/tests/ApiGateway.IntegrationTests/GatewayTests.cs`

```csharp
public class GatewayTests : IClassFixture<GatewayWebApplicationFactory>
{
    private readonly HttpClient _client;

    public GatewayTests(GatewayWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Request_WithoutToken_Returns401_AC0_1_1()
    {
        // Act: no Authorization header
        var response = await _client.GetAsync("/api/v1/music/songs");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task CircuitBreaker_Opens_After_Timeout_AC0_1_2()
    {
        // Arrange: configure downstream to respond in 2500ms (simulated via test factory)
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);

        // Act
        var response = await _client.GetAsync("/api/v1/test/slow-downstream");

        // Assert: circuit breaker fires after >2000ms
        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task RateLimit_Exceeding100PerMinute_Returns429_AC0_1_3()
    {
        // Arrange: same IP (test client)
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);

        // Act: send 101 requests rapidly
        HttpResponseMessage? lastResponse = null;
        for (int i = 0; i <= 100; i++)
        {
            lastResponse = await _client.GetAsync("/api/v1/music/songs");
        }

        // Assert: eventually rate limited
        lastResponse!.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        var body = await lastResponse.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("RATE_LIMIT_EXCEEDED");
    }
}
```

### 4.9 Listening Party — Room Lifecycle & Host Authority

**File**: `services/listening-party-service/tests/ListeningParty.IntegrationTests/PartyTests.cs`

```csharp
public class PartyTests : IClassFixture<PartyWebApplicationFactory>
{
    private readonly HttpClient _client;

    public PartyTests(PartyWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestData.ListenerToken);
    }

    [Fact]
    public async Task CreateParty_ShouldReturnRoomIdAndJoinCode_AC7_1_1()
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/party/create", new
        {
            song_id = TestData.SongId1
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<CreatePartyResponse>>();
        body!.Data!.RoomId.Should().NotBeEmpty();
        body.Data.JoinCode.Should().HaveLength(6);
        body.Data.JoinCode.Should().MatchRegex("^[A-Z0-9]{6}$");
    }

    [Fact]
    public async Task JoinParty_WithValidCode_ShouldReturnRoomState_AC7_1_2()
    {
        // Arrange: create a room first
        var createResp = await _client.PostAsJsonAsync("/api/v1/party/create", new
        {
            song_id = TestData.SongId1
        });
        var room = (await createResp.Content.ReadFromJsonAsync<ApiResponse<CreatePartyResponse>>())!.Data!;

        // Act: join with member token
        var memberClient = GetClientWithToken(TestData.MemberToken);
        var joinResp = await memberClient.PostAsJsonAsync("/api/v1/party/join", new
        {
            join_code = room.JoinCode
        });

        // Assert
        joinResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await joinResp.Content.ReadFromJsonAsync<ApiResponse<JoinPartyResponse>>();
        body!.Data!.RoomId.Should().Be(room.RoomId);
        body.Data.HostId.Should().NotBeEmpty();
        body.Data.CurrentSongId.Should().NotBeEmpty();
        body.Data.PositionSec.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task JoinParty_WithInvalidCode_ShouldReturn404_AC7_1_3()
    {
        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/party/join", new
        {
            join_code = "XXXXXX"
        });

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("ROOM_NOT_FOUND");
    }

    [Fact]
    public async Task MemberAction_ShouldBeRejected_AC7_2_2()
    {
        // Arrange: create room as host, join as member, connect WebSocket
        var room = await CreateRoom();
        var memberWs = await ConnectMemberWebSocket(room.JoinCode);

        // Act: member sends PLAYER_ACTION (play command)
        await memberWs.SendAsync(new
        {
            type = "PLAYER_ACTION",
            action = "PLAY",
            room_id = room.RoomId
        });

        // Assert: member receives rejection
        var message = await memberWs.ReceiveAsync(timeout: TimeSpan.FromSeconds(5));
        message.Type.Should().Be("ERROR");
        message.Code.Should().Be("UNAUTHORIZED_ACTION");
    }

    [Fact]
    public async Task Reconnect_ShouldResyncToCurrentPosition_AC7_3_1()
    {
        // Arrange: create room, advance position, disconnect member
        var room = await CreateRoom();
        var memberWs = await ConnectMemberWebSocket(room.JoinCode);
        await memberWs.DisconnectAsync();

        // Act: reconnect
        var reconnectResp = await _client.GetAsync($"/api/v1/party/{room.RoomId}/state");

        // Assert: gets current song + position from Redis
        reconnectResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await reconnectResp.Content.ReadFromJsonAsync<ApiResponse<RoomStateResponse>>();
        body!.Data!.CurrentSongId.Should().NotBeEmpty();
        body.Data.PositionSec.Should().BeGreaterThanOrEqualTo(0);
    }
}
```

### 4.10 Recommendation — Feedback & Fallback

**File**: `services/recommendation-service/tests/integration/test_recommendation_fallback.py`

```python
import pytest
import asyncio
from unittest.mock import patch
import fakeredis.aioredis


@pytest.mark.asyncio
async def test_fallback_to_trending_when_timeout(async_client, fake_redis):
    """AC2.1.5: When Rule Engine times out > 300ms, return Top 50 Trending"""
    # Arrange: pre-populate trending sorted set
    await fake_redis.zadd("rec:trending:global", {
        "song-uuid-b2c3d4e5": 9500,
        "song-uuid-c3d4e5f6": 8200,
    })

    with patch(
        "services.rule_engine.RuleEngine.compute_recommendations",
        side_effect=asyncio.TimeoutError()
    ):
        response = await async_client.get(
            "/api/v1/recommendations?context=morning&limit=10",
            headers={"Authorization": f"Bearer {LISTENER_TOKEN}"}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["data"]) >= 1  # trending fallback songs present
    assert data["meta"]["cache"] == "HIT"


@pytest.mark.asyncio
async def test_new_user_gets_onboarding_genres_fallback(async_client, fake_redis):
    """Failure Handling: Redis weights empty → fall back to onboarding genres"""
    # Arrange: Redis has no weights, but onboarding genres exist
    await fake_redis.set(
        "rec:onboarding:new-user-uuid",
        '["d4e5f6a7-b8c9-0123-defa-234567890123", "e5f6a7b8-c9d0-1234-efab-567890123456"]'
    )

    response = await async_client.get(
        "/api/v1/recommendations?context=morning&limit=10",
        headers={"Authorization": f"Bearer {NEW_USER_TOKEN}"}
    )

    assert response.status_code == 200
    assert len(response.json()["data"]) >= 1  # never returns empty list


@pytest.mark.asyncio
async def test_song_played_event_increases_genre_weight(async_client, fake_redis):
    """AC2.2.1: Song_Played Kafka event consumed → genre play weight increases"""
    genre_id = "d4e5f6a7-b8c9-0123-defa-234567890123"
    user_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

    # Arrange: set initial weight
    await fake_redis.hset(f"rec:weights:{user_id}", genre_id, "1.0")

    # Act: simulate Kafka consumer processing Song_Played
    await consume_kafka_event("Song_Played", {
        "event_id": "test-event-001",
        "user_id": user_id,
        "song_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "genre_id": genre_id,
        "duration_percent": 95.0
    })

    # Assert: weight increased
    new_weight = float(await fake_redis.hget(f"rec:weights:{user_id}", genre_id))
    assert new_weight > 1.0


@pytest.mark.asyncio
async def test_duplicate_event_is_skipped_AC2_2_3(async_client, fake_redis):
    """AC2.2.3: Duplicate eventId in Redis SET → idempotency skip"""
    event_id = "duplicate-event-abc123"

    # Arrange: mark event as already processed
    await fake_redis.set(f"dedup:Song_Played:{event_id}", "1", ex=86400)

    # Act: try to process same event again
    processed = await consume_kafka_event("Song_Played", {
        "event_id": event_id,
        "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "song_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "genre_id": "d4e5f6a7-b8c9-0123-defa-234567890123",
        "duration_percent": 95.0
    })

    # Assert: skipped — not processed again
    assert processed is False
```

---

## 5. Load Tests (k6)

### 5.1 Streaming URL — Target p95 < 300ms

**File**: `tests/load/streaming_url.js`

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const streamingLatency = new Trend('streaming_latency');

export const options = {
    stages: [
        { duration: '30s', target: 20 },   // ramp up to 20 users
        { duration: '1m', target: 50 },    // hold at 50 concurrent users
        { duration: '30s', target: 0 },    // ramp down
    ],
    thresholds: {
        'streaming_latency': ['p(95)<300'],   // AC3.1.1 / AC3.1.3: p95 < 300ms
        'http_req_failed': ['rate<0.01'],     // < 1% error rate
    },
};

export default function () {
    const songId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    const res = http.get(`http://localhost:5000/api/v1/streaming/${songId}/url`, {
        headers: { Authorization: `Bearer ${__ENV.TEST_TOKEN}` },
    });

    streamingLatency.add(res.timings.duration);

    check(res, {
        'status 200': (r) => r.status === 200,
        'has streamUrl': (r) => JSON.parse(r.body).data?.streamUrl !== undefined,
        'expiresIn is 900': (r) => JSON.parse(r.body).data?.expiresIn === 900,
    });

    sleep(1);
}
```

### 5.2 API Gateway Routing — Target p95 < 50ms

**File**: `tests/load/gateway_routing.js`

```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        'http_req_duration': ['p(95)<50'],   // AC0.1.1: Gateway routing < 50ms
        'http_req_failed': ['rate<0.005'],
    },
};

export default function () {
    // Lightweight health endpoint — tests routing overhead only, not business logic
    const res = http.get('http://localhost:5000/health');
    check(res, { 'status 200': (r) => r.status === 200 });
}
```

### 5.3 Search — Target p95 < 200ms

**File**: `tests/load/search.js`

```javascript
import http from 'k6/http';
import { check } from 'k6';

// Representative Vietnamese music search queries
const queries = ['son tung', 'erik', 'den vau', 'amee', 'binz', 'mono', 'vu cat tuong'];

export const options = {
    vus: 30,
    duration: '2m',
    thresholds: {
        'http_req_duration': ['p(95)<200'],   // AC5.1.2
        'http_req_failed': ['rate<0.01'],
    },
};

export default function () {
    const q = queries[Math.floor(Math.random() * queries.length)];
    const res = http.get(
        `http://localhost:5000/api/v1/search?q=${encodeURIComponent(q)}&type=all&limit=10`,
        { headers: { Authorization: `Bearer ${__ENV.TEST_TOKEN}` } }
    );

    check(res, {
        'status 200': (r) => r.status === 200,
        'has data array': (r) => Array.isArray(JSON.parse(r.body).data?.songs),
        'empty result is array not error': (r) => {
            const body = JSON.parse(r.body);
            return body.success === true;
        },
    });
}
```

### 5.4 Recommendation — Target p95 < 300ms

**File**: `tests/load/recommendation.js`

```javascript
import http from 'k6/http';
import { check } from 'k6';

const contexts = ['morning', 'afternoon', 'evening', 'night'];

export const options = {
    vus: 20,
    duration: '2m',
    thresholds: {
        'http_req_duration': ['p(95)<300'],   // AC2.1.5
        'http_req_failed': ['rate<0.01'],
    },
};

export default function () {
    const ctx = contexts[Math.floor(Math.random() * contexts.length)];
    const res = http.get(
        `http://localhost:5000/api/v1/recommendations?context=${ctx}&limit=10`,
        { headers: { Authorization: `Bearer ${__ENV.TEST_TOKEN}` } }
    );

    check(res, {
        'status 200': (r) => r.status === 200,
        'has at least 1 song': (r) => JSON.parse(r.body).data?.length >= 1,
        'has explain_text': (r) => JSON.parse(r.body).data?.[0]?.explain_text !== undefined,
    });
}
```

### 5.5 Analytics Heatmap — Target p95 < 500ms

**File**: `tests/load/analytics_heatmap.js`

```javascript
import http from 'k6/http';
import { check } from 'k6';

const ranges = ['7d', '30d'];

export const options = {
    vus: 10,
    duration: '1m',
    thresholds: {
        'http_req_duration': ['p(95)<500'],   // AC4.2.4: < 500ms with Redis cache
        'http_req_failed': ['rate<0.01'],
    },
};

export default function () {
    const range = ranges[Math.floor(Math.random() * ranges.length)];
    const songId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

    const res = http.get(
        `http://localhost:5000/api/v1/analytics/creator/heatmap/${songId}?range=${range}`,
        { headers: { Authorization: `Bearer ${__ENV.CREATOR_TOKEN}` } }
    );

    check(res, {
        'status 200': (r) => r.status === 200,
        'has data_points': (r) => JSON.parse(r.body).data?.data_points !== undefined,
        'cache hit expected': (r) => JSON.parse(r.body).meta?.cache === 'HIT',
    });
}
```

### 5.6 Listening Party — WebSocket Sync Latency (LP-01)

**File**: `tests/load/listening_party_ws.js` *(not yet created — see Implementation Status Section 10)*

**Scenario LP-01**: 50 concurrent party members connected to the same room. Host sends a `PLAYER_ACTION` event every 2 seconds. All members must receive the corresponding `SYNC_STATE` broadcast within 500ms (AC7.2.1).

```javascript
import ws from 'k6/ws';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const syncLatency = new Trend('sync_latency_ms');

export const options = {
    scenarios: {
        party_members: {
            executor: 'constant-vus',
            vus: 50,
            duration: '2m',
        },
    },
    thresholds: {
        'sync_latency_ms': ['p(95)<500'],   // AC7.2.1: SYNC_STATE broadcast < 500ms
        'http_req_failed': ['rate<0.01'],
    },
};

export default function () {
    const roomId = __ENV.TEST_ROOM_ID;
    const token  = __ENV.TEST_TOKEN;
    const url    = `ws://localhost:5010/ws/v1/parties/${roomId}?access_token=${token}`;

    ws.connect(url, {}, function (socket) {
        socket.on('open', () => {
            socket.setInterval(() => {
                const sent = Date.now();
                socket.send(JSON.stringify({ type: 'PING' }));

                socket.on('message', (msg) => {
                    const data = JSON.parse(msg);
                    if (data.type === 'SYNC_STATE') {
                        syncLatency.add(Date.now() - sent);
                        check(data, {
                            'has currentSongId': (d) => d.current_song_id !== undefined,
                            'has positionSec':   (d) => d.position_sec >= 0,
                        });
                    }
                });
            }, 2000);
        });

        socket.setTimeout(() => { socket.close(); }, 30000);
    });
}
```

**Run command** (after creating the file):
```bash
export TEST_TOKEN=...
export TEST_ROOM_ID=...   # pre-created room with host playing
k6 run -e TEST_TOKEN=$TEST_TOKEN -e TEST_ROOM_ID=$TEST_ROOM_ID tests/load/listening_party_ws.js
```

**Pass criteria**: p95 sync latency < 500ms with 50 concurrent members.

---

## 6. Chaos Tests

Manual chaos scenarios using docker-compose. **Run before final demo only** — not in regular CI.

### Chaos Scenarios Overview

| # | Scenario | Simulation | Expected Behavior | Pass Criteria |
|---|---|---|---|---|
| C-01 | Kafka down | `docker-compose stop kafka` | Analytics events written to local disk queue, no 500 errors | Service returns 202; log shows "Kafka unavailable, queuing locally" |
| C-02 | Redis miss completely | `docker-compose stop redis` | Recommendation returns Top 50 Trending from memory/static; not empty | Response >= 1 song; no 500 error |
| C-03 | CDN primary fail | Modify streaming config to invalid CDN URL | Streaming URL falls back to secondary CDN endpoint | Stream URL returns 200, audio plays |
| C-04 | Auth Service down | `docker-compose stop auth-service` | API Gateway verifies JWT using cached public key in Redis | Protected endpoints still work for < 60s; then 503 |

### C-01: Kafka Down Procedure

```bash
# 1. Stop Kafka
docker-compose stop kafka

# 2. Send analytics event — should return 202, not 500
curl -X POST http://localhost:5000/api/v1/analytics/events/play \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"event_id":"test-chaos-001","song_id":"b2c3d4e5-f6a7-8901-bcde-f12345678901","duration_sec":214,"duration_percent":92.5}'

# 3. Verify: 202 response and disk queue log entry
docker-compose logs analytics-service | grep "Kafka unavailable\|disk queue"

# 4. Restore Kafka
docker-compose start kafka

# 5. Verify: disk queue drains automatically
sleep 10
docker-compose logs analytics-service | grep "queue drained\|flushed"
```

**Pass**: HTTP 202 received while Kafka is down; events appear in InfluxDB after Kafka restores.

### C-02: Redis Down Procedure

```bash
# 1. Stop Redis
docker-compose stop redis

# 2. Request recommendations — should NOT return empty list or 500
curl -X GET "http://localhost:5000/api/v1/recommendations?context=morning&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# 3. Verify: response has >= 1 song from static trending list
echo "Expected: success=true, data length >= 1"

# 4. Restore Redis
docker-compose start redis
```

**Pass**: Response `success=true`, `data` array has >= 1 song from hardcoded Top 50 Trending fallback.

### C-03: CDN Fail Procedure

```bash
# 1. Set invalid primary CDN URL in environment
export CDN_PRIMARY_URL="https://invalid-cdn-that-does-not-exist.example.com"
docker-compose up -d streaming-service

# 2. Request streaming URL
curl -X GET "http://localhost:5000/api/v1/streaming/b2c3d4e5-f6a7-8901-bcde-f12345678901/url" \
  -H "Authorization: Bearer $TOKEN"

# 3. Verify: URL returned points to secondary CDN
# Expected: streamUrl contains secondary CDN hostname

# 4. Restore
unset CDN_PRIMARY_URL
docker-compose up -d streaming-service
```

**Pass**: `streamUrl` in response points to secondary CDN; HTTP status 200.

### C-04: Auth Service Down Procedure

```bash
# 1. Stop Auth Service
docker-compose stop auth-service

# 2. Immediately request a protected endpoint with valid JWT
# (Gateway should verify using cached public key in Redis for < 60s)
curl -X GET "http://localhost:5000/api/v1/music/songs" \
  -H "Authorization: Bearer $VALID_JWT_TOKEN"

# 3. Verify: 200 OK (cached key verification works)
echo "Expected: 200 OK within first 60 seconds"

# 4. Wait 70 seconds (cache expires)
sleep 70

# 5. Try again — now should 503
curl -X GET "http://localhost:5000/api/v1/music/songs" \
  -H "Authorization: Bearer $VALID_JWT_TOKEN"
echo "Expected: 503 Service Unavailable after cache expiry"

# 6. Restore Auth Service
docker-compose start auth-service
```

**Pass**: Requests succeed for up to 60s after Auth Service goes down; degrade to 503 after cache expiry.

---

## 7. Test Data Strategy

### 7.1 Seed Data

**File**: `tests/seeds/01_genres.sql`

```sql
INSERT INTO genres (genre_id, name, slug) VALUES
  ('d4e5f6a7-b8c9-0123-defa-234567890123', 'Indie Pop',  'indie-pop'),
  ('e5f6a7b8-c9d0-1234-efab-567890123456', 'Acoustic',   'acoustic'),
  ('f6a7b8c9-d0e1-2345-fabc-678901234567', 'Lo-fi',      'lo-fi'),
  ('a7b8c9d0-e1f2-3456-abcd-789012345678', 'V-Pop',      'v-pop'),
  ('b8c9d0e1-f2a3-4567-bcde-890123456789', 'K-Pop',      'k-pop');
```

**File**: `tests/seeds/02_artists.sql`

```sql
INSERT INTO artists (artist_id, stage_name, bio, country_code, total_followers) VALUES
  ('11223344-5566-7788-99aa-bbccddeeff00',
   'Sơn Tùng M-TP', 'Nghệ sĩ V-Pop hàng đầu Việt Nam.', 'VN', 2500000),
  ('22334455-6677-8899-aabb-ccddeeff0011',
   'AMEE', 'Ca sĩ, rapper người Việt Nam.', 'VN', 800000);
```

**File**: `tests/seeds/03_songs.sql`

```sql
INSERT INTO songs (song_id, artist_id, title, duration_sec, s3_audio_key, is_published, explicit) VALUES
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901',
   '11223344-5566-7788-99aa-bbccddeeff00',
   'Chúng Ta Của Hiện Tại', 287, 'audio/2026/04/b2c3d4e5.mp3', true, false),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012',
   '22334455-6677-8899-aabb-ccddeeff0011',
   'Anh Nhà Ở Đâu Thế', 198, 'audio/2026/04/c3d4e5f6.mp3', true, false);
```

**File**: `tests/seeds/04_test_users.sql`

```sql
-- Listener (password: TestPassword123!)
INSERT INTO users (user_id, email, display_name, role, password_hash, is_active) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890',
   'testlistener@example.com', 'Test Listener', 'Listener', '$2a$12$PLACEHOLDER_HASH', true),
  -- Creator (password: TestPassword123!)
  ('b2c3d4e5-f6a7-8901-bcde-f12345678902',
   'testcreator@example.com', 'Test Creator', 'Creator', '$2a$12$PLACEHOLDER_HASH', true),
  -- Account used for lockout test
  ('c3d4e5f6-a7b8-9012-cdef-ef1234567891',
   'lockme@example.com', 'Lock Test', 'Listener', '$2a$12$PLACEHOLDER_HASH', true),
  -- New user (no preferences)
  ('d4e5f6a7-b8c9-0123-defa-ef1234567892',
   'newuser@example.com', 'New User', 'Listener', '$2a$12$PLACEHOLDER_HASH', true);

-- Listener follows the creator
INSERT INTO follows (follower_id, followed_artist_id) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '11223344-5566-7788-99aa-bbccddeeff00');
```

### 7.2 Shared Test Constants (C#)

**File**: `tests/Shared/TestData.cs`

```csharp
namespace Tests.Shared;

public static class TestData
{
    // User IDs
    public static readonly Guid ListenerUserId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    public static readonly Guid CreatorUserId  = Guid.Parse("b2c3d4e5-f6a7-8901-bcde-f12345678902");
    public static readonly Guid NewUserId      = Guid.Parse("d4e5f6a7-b8c9-0123-defa-ef1234567892");

    // Song IDs
    public static readonly Guid SongId1 = Guid.Parse("b2c3d4e5-f6a7-8901-bcde-f12345678901");
    public static readonly Guid SongId2 = Guid.Parse("c3d4e5f6-a7b8-9012-cdef-123456789012");

    // Genre IDs
    public static readonly Guid GenreIndiePop = Guid.Parse("d4e5f6a7-b8c9-0123-defa-234567890123");
    public static readonly Guid GenreAcoustic  = Guid.Parse("e5f6a7b8-c9d0-1234-efab-567890123456");
    public static readonly Guid GenreLoFi      = Guid.Parse("f6a7b8c9-d0e1-2345-fabc-678901234567");

    // Credentials
    public static LoginRequest ValidListenerLogin => new()
    {
        Username = "testlistener@example.com",
        Password = "TestPassword123!"
    };

    public static LoginRequest ValidCreatorLogin => new()
    {
        Username = "testcreator@example.com",
        Password = "TestPassword123!"
    };

    // Tokens — generated at test factory startup
    public static string ListenerToken { get; set; } = string.Empty;
    public static string CreatorToken  { get; set; } = string.Empty;
    public static string NewUserToken  { get; set; } = string.Empty;
}
```

### 7.3 Mocking External Dependencies (Unit Tests)

```csharp
// Mock S3 — never call real AWS in unit tests
var s3Mock = new Mock<IAmazonS3>();
s3Mock
    .Setup(s => s.GetPreSignedURLAsync(It.IsAny<GetPreSignedUrlRequest>()))
    .ReturnsAsync("https://s3.amazonaws.com/bucket/song.mp3?signature=test&Expires=900");

// Mock Kafka producer
var kafkaMock = new Mock<IKafkaProducer>();
kafkaMock
    .Setup(k => k.PublishAsync(
        It.IsAny<string>(),
        It.IsAny<object>(),
        It.IsAny<CancellationToken>()))
    .Returns(Task.CompletedTask);

// Mock Redis
var redisMock = new Mock<IDatabase>();
redisMock
    .Setup(r => r.StringSetAsync(
        It.IsAny<RedisKey>(),
        It.IsAny<RedisValue>(),
        It.IsAny<TimeSpan?>(),
        When.NotExists,
        CommandFlags.None))
    .ReturnsAsync(true);
```

```python
# Python: mock Redis with fakeredis (no real Redis needed in unit tests)
import fakeredis.aioredis

@pytest.fixture
async def fake_redis():
    server = fakeredis.aioredis.FakeRedis()
    yield server
    await server.aclose()

# mock httpx calls with respx
import respx, httpx

@respx.mock
async def test_something():
    respx.get("http://music-service/internal/songs/abc").mock(
        return_value=httpx.Response(200, json={"song_id": "abc", "title": "Test"})
    )
    ...
```

---

## 8. CI Pipeline

### When to Run Each Test Type

| Trigger | Test Types | Max Duration | Fail Fast Condition |
|---|---|---|---|
| Every push to feature branch | Unit tests only | 2 min | Any unit test fails → block PR |
| PR opened / updated | Unit + Integration | 10 min | Any integration test fails → block merge |
| Merge to main | Unit + Integration + Build verification | 15 min | Any failure → notify team on Slack/Discord |
| Before sprint demo | Unit + Integration + Load + Chaos (manual) | ~1 hour | Load p95 exceeds budget → fix before demo |

### Sample CI Configuration

**File**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET 8
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Setup Python 3.11
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Python dependencies
        run: |
          cd services/recommendation-service
          pip install -r requirements-test.txt

      - name: Run C# unit tests
        run: |
          dotnet test --filter "Category=Unit" \
            --logger "trx" \
            --results-directory ./test-results \
            --collect "XPlat Code Coverage"

      - name: Run Python unit tests
        run: |
          cd services/recommendation-service
          pytest tests/unit/ -v --tb=short

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      kafka:
        image: confluentinc/cp-kafka:7.6.0
        env:
          KAFKA_BROKER_ID: 1
          KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
          KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092

    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET 8
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Run C# integration tests
        env:
          ConnectionStrings__Postgres: "Host=localhost;Database=test_db;Username=postgres;Password=testpassword"
          ConnectionStrings__Redis: "localhost:6379"
          Kafka__BootstrapServers: "localhost:9092"
        run: |
          dotnet test --filter "Category=Integration" \
            --logger "trx" \
            --results-directory ./test-results

      - name: Run Python integration tests
        run: |
          cd services/recommendation-service
          pytest tests/integration/ -v --tb=short

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results
          path: ./test-results
```

### Running Load Tests Locally (Before Sprint Demo)

```bash
# Export test token first
export TEST_TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testlistener@example.com","password":"TestPassword123!"}' \
  | jq -r '.data.accessToken')

export CREATOR_TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testcreator@example.com","password":"TestPassword123!"}' \
  | jq -r '.data.accessToken')

# Run all load tests
k6 run tests/load/gateway_routing.js
k6 run -e TEST_TOKEN=$TEST_TOKEN tests/load/streaming_url.js
k6 run -e TEST_TOKEN=$TEST_TOKEN tests/load/search.js
k6 run -e TEST_TOKEN=$TEST_TOKEN tests/load/recommendation.js
k6 run -e CREATOR_TOKEN=$CREATOR_TOKEN tests/load/analytics_heatmap.js
```

---

## 9. AC Coverage Matrix

Every Acceptance Criteria mapped to at least one test.

| AC | Description | Test Type | Test Name | Status |
|---|---|---|---|---|
| AC0.1.1 | No JWT → 401 | Integration | `GatewayTests.Request_WithoutToken_Returns401` | Covered |
| AC0.1.2 | Downstream > 2000ms → 503 | Integration | `GatewayTests.CircuitBreaker_Opens_After_Timeout` | Covered |
| AC0.1.3 | 100+ req/min → 429 | Load | `gateway_routing.js` rate limit scenario | Covered |
| AC1.1.1 | Valid creds → tokens + cookie | Integration | `AuthIntegrationTests.Login_WithValidCredentials_ShouldReturnTokens` | Covered |
| AC1.1.2 | Invalid creds → 400 | Integration | `AuthIntegrationTests.Login_WithWrongPassword_ShouldReturn400` | Covered |
| AC1.1.3 | > 5 fails → 423 lock | Integration | `AuthIntegrationTests.Login_After5FailedAttempts_ShouldReturn423` | Covered |
| AC1.1.4 | Token reuse → 403 + revoke all | Integration | `AuthIntegrationTests.RefreshToken_WhenReused_ShouldRevoke_AllSessions` | Covered |
| AC1.2.1 | No prefs → force >= 3 genres | Integration | `OnboardingTests.NewUser_WithoutPreferences_MustSelectAtLeast3Genres` | Covered |
| AC1.2.2 | Onboarding → Kafka User_Preferences_Updated | Integration | `OnboardingTests.SavePreferences_ShouldPublishKafkaEvent` | Covered |
| AC1.2.3 | Existing prefs → idempotent | Integration | `OnboardingTests.SavePreferences_WhenAlreadyExists_ShouldReturn200` | Covered |
| AC1.3.1 | Upload → S3 + DB | Integration | `MusicUploadTests.Upload_ValidFile_ShouldSaveToS3AndDB` | Covered |
| AC1.3.2 | Upload success → New_Release Kafka | Integration | `MusicUploadTests.Upload_Success_ShouldPublishNewReleaseEvent` | Covered |
| AC1.3.3 | File > 50MB or wrong format → 400 | Integration | `MusicUploadTests.Upload_OversizeFile_ShouldReturn400`, `Upload_InvalidFormat_ShouldReturn400` | Covered |
| AC2.1.1 | Morning context → acoustic boost | Unit | `TestContextScoring.test_morning_context_boosts_acoustic_songs` | Covered |
| AC2.1.2 | Skip >= 3 → weight decrease | Unit | `TestContextScoring.test_skip_penalty_reduces_genre_score` | Covered |
| AC2.1.3 | > 80% listen → weight increase | Unit | `TestContextScoring.test_play_weight_increases_genre_score` | Covered |
| AC2.1.4 | >= 5 songs + explain_text | Unit + Integration | `test_response_includes_explain_text`, `RecommendationTests.GetRecommendations_ShouldReturn5SongsWithExplanation` | Covered |
| AC2.1.5 | Timeout → Trending fallback | Integration | `test_fallback_to_trending_when_timeout` | Covered |
| AC2.2.1 | Song_Played → play weight++ | Integration | `test_song_played_event_increases_genre_weight` | Covered |
| AC2.2.2 | Song_Skipped → skip weight-- | Integration | `FeedbackTests.SongSkipped_ShouldDecreaseGenreWeight` | Covered |
| AC2.2.3 | Duplicate eventId → skip | Unit + Integration | `IdempotencyServiceTests.CheckAndSet_WhenKeyExists_ShouldReturnTrue`, `test_duplicate_event_is_skipped_AC2_2_3` | Covered |
| AC3.1.1 | Play → starts < 1s | Load | `streaming_url.js` p95 < 300ms threshold | Covered |
| AC3.1.2 | Seek → HTTP 206 at offset | Integration | `StreamingTests.GetStreamingUrl_WithRangeHeader_ShouldReturn206` | Covered |
| AC3.1.3 | Pre-signed URL expiry 900s | Integration | `StreamingTests.GetStreamingUrl_ShouldReturn900SecondExpiry` | Covered |
| AC4.1.1 | Stream → Song_Played published | Integration | `AnalyticsIntegrationTests.AnalyticsEvent_ShouldBePublishedToKafka` | Covered |
| AC4.1.2 | Skip → Song_Skipped published | Integration | `AnalyticsIntegrationTests.SkipEvent_ShouldPublishSongSkipped` | Covered |
| AC4.1.3 | Duplicate → idempotency skip | Integration | `AnalyticsIntegrationTests.AnalyticsEvent_DuplicateEventId_ShouldBeSkipped` | Covered |
| AC4.1.4 | Analytics → 202 immediately | Integration | `AnalyticsIntegrationTests.AnalyticsEndpoint_ShouldReturn202Immediately` | Covered |
| AC4.2.1 | Heatmap skip-rate by second (7d/30d) | Integration | `AnalyticsTests.GetHeatmap_AsCreator_ShouldReturnSkipRatePerSecond` | Covered |
| AC4.2.2 | Daily listeners + unique users chart | Integration | `AnalyticsTests.GetStats_ShouldReturnDailyListenersChart` | Covered |
| AC4.2.3 | Non-Creator → 403 | Integration | `AnalyticsIntegrationTests.GetHeatmap_AsListener_ShouldReturn403` | Covered |
| AC4.2.4 | Heatmap < 500ms (Redis cache TTL 6h) | Load | `analytics_heatmap.js` p95 < 500ms | Covered |
| AC5.1.1 | "son tug" → Sơn Tùng M-TP | Integration | `SearchTests.FuzzySearch_WithTypo_ShouldReturnCorrectArtist` | Covered |
| AC5.1.2 | Search < 200ms | Load | `search.js` p95 < 200ms threshold | Covered |
| AC5.1.3 | No results → [] not error | Integration | `SearchTests.Search_NoResults_ShouldReturnEmptyArray` | Covered |
| AC5.1.4 | Cursor pagination | Integration | `SearchTests.Search_ShouldSupportCursorPagination` | Covered |
| AC6.1.1 | New_Release → fan-out to followers | Integration | `NotificationTests.NewRelease_ShouldFanoutToFollowers` | Covered |
| AC6.1.2 | Unread notifications + pagination | Integration | `NotificationTests.GetNotifications_ShouldReturnUnreadWithPagination` | Covered |
| AC6.1.3 | Mark as read → idempotent | Integration | `NotificationTests.MarkAsRead_ShouldBeIdempotent` | Covered |
| AC7.1.1 | Create party → roomId + 6-char joinCode | Integration | `PartyTests.CreateParty_ShouldReturnRoomIdAndJoinCode` | Covered |
| AC7.1.2 | Join valid joinCode → room state | Integration | `PartyTests.JoinParty_WithValidCode_ShouldReturnRoomState` | Covered |
| AC7.1.3 | Invalid joinCode → 404 | Integration | `PartyTests.JoinParty_WithInvalidCode_ShouldReturn404` | Covered |
| AC7.2.1 | Host action → SYNC_STATE < 500ms | Integration | `PartyTests.HostAction_ShouldBroadcastSyncStateUnder500ms` | Covered |
| AC7.2.2 | Member Play/Pause → rejected | Integration | `PartyTests.MemberAction_ShouldBeRejected` | Covered |
| AC7.2.3 | Conflicting actions → Host wins | Integration | `PartyTests.ConflictingActions_HostWins` | Covered |
| AC7.2.4 | Idle > 30s → PING; no PONG 10s → disconnect | Integration | `PartyTests.IdleConnection_ShouldSendPing` — use mock clock or `Thread.Sleep(35_000)` | Partially Covered |
| AC7.3.1 | Reconnect → currentSongId + positionSec | Integration | `PartyTests.Reconnect_ShouldResyncToCurrentPosition` | Covered |
| AC7.3.2 | Reconnect Exponential Backoff (1s, 2s, 4s, max 30s) | Unit | `ReconnectStrategyTests.GetDelay_ShouldDoubleEachRetry` | Covered |

### Summary

| Status | Count | ACs |
|---|---|---|
| Covered | 45 | All except AC7.2.4 |
| Partially Covered | 1 | AC7.2.4 — timing-sensitive WebSocket idle test |
| Not Covered | 0 | — |

**AC7.2.4 — Special Note**: WebSocket idle detection requires a 40-second wait (`Thread.Sleep(35_000)` + 5s buffer). This makes the test slow for regular CI. Recommended approach: inject a `ISystemClock` abstraction into the heartbeat handler and mock time advancement in the test, avoiding the real sleep entirely.

---

## 10. Implementation Status (as of 2026-05-19)

### C# Services

| Service | Unit Tests | Integration Tests | Status |
|---------|-----------|------------------|--------|
| API Gateway | `ApiGateway.UnitTests` — 5 files (JwtValidationService, RateLimitingService, JwtValidationMiddleware, RateLimitingMiddleware, CircuitBreakerMiddleware) | No integration test files | ⚠️ Unit only |
| Auth Service | `AuthService.UnitTests/AuthServiceTests.cs` | `AuthService.IntegrationTests/AuthIntegrationTests.cs` | ✅ |
| User Service | `UserService.UnitTests/UserProfileServiceTests.cs` | `UserService.IntegrationTests/UsersControllerTests.cs` | ✅ |
| Music Service | `MusicService.UnitTests` — 3 files (SongServiceGet, SongServiceArtist, GcsStorageService) | `MusicService.IntegrationTests` — 2 files (SongsController, InternalSongsController) | ✅ |
| Streaming Service | `StreamingService.UnitTests` — 2 files (StreamingService, GcsStoragePresigner) | `StreamingService.IntegrationTests/StreamingIntegrationTests.cs` | ✅ |
| Listening Party Service | `ListeningPartyService.UnitTests` — 2 files (PartyService, PartyServiceQueue) | `ListeningPartyService.IntegrationTests` — 3 files (PartiesIntegration, PartyHubIntegration, PartyHubUnit) | ✅ |
| Analytics Service | `AnalyticsService.UnitTests` — 3 files (AnalyticsService, AnalyticsController, KafkaHandler) | No integration test files | ⚠️ Unit only |
| Notification Service | `NotificationService.UnitTests` — 2 files (NotificationService, NewReleaseHandler) | `NotificationService.IntegrationTests/NotificationsIntegrationTests.cs` | ✅ |
| Search Service | `SearchService.UnitTests` — 2 files (SearchService, SearchController) | No integration test files | ⚠️ Unit only |

### Python Service

| Service | Unit Tests | Integration Tests | Status |
|---------|-----------|------------------|--------|
| Recommendation Service | `tests/unit/` — 3 files (test_rule_engine, test_handlers, test_recommendation_service) | `tests/integration/test_recommendations_api.py` | ✅ |

### Load Tests

| File | Endpoint | Status |
|------|----------|--------|
| `tests/load/streaming_url.js` | `GET /streaming/{id}/url` — p95 < 300ms | ✅ Exists |
| `tests/load/search.js` | `GET /search` — p95 < 200ms | ✅ Exists |
| `tests/load/recommendation.js` | `GET /recommendations` — p95 < 300ms | ✅ Exists |
| `tests/load/gateway_routing.js` | `GET /health` — p95 < 50ms | ❌ Missing |
| `tests/load/analytics_heatmap.js` | `GET /analytics/creator/heatmap/{id}` — p95 < 500ms | ❌ Missing |
| `tests/load/listening_party_ws.js` | WebSocket sync latency — p95 < 500ms | ❌ Missing |

### Gap Summary

| Gap | Priority | Notes |
|-----|----------|-------|
| Analytics Service integration tests | High | AC4.1 and AC4.2 currently covered only by unit tests; integration coverage against real InfluxDB + Kafka needed |
| Search Service integration tests | High | AC5.1.1–5.1.4 fuzzy search + Elasticsearch must be validated end-to-end |
| API Gateway integration tests | Medium | Circuit breaker and rate-limit behavior require real HTTP round-trips; unit mocks are insufficient for full confidence |
| `gateway_routing.js` load test | Medium | Needed before sprint demo for AC0.1.1 latency budget |
| `analytics_heatmap.js` load test | Medium | Needed before sprint demo for AC4.2.4 latency budget |
| `listening_party_ws.js` load test | Low | WebSocket scenario; requires k6 websocket extension |

---

## 11. Test Data Cleanup

- **Unit tests**: no cleanup needed — all dependencies are mocked (Mock\<T\>, fakeredis, respx).
- **Integration tests**: Testcontainers lifecycle — each `IClassFixture<TFactory>` spins up a fresh container and destroys it after the test class completes. No manual teardown required.
- **Python integration tests**: `fake_redis` fixture (`fakeredis.aioredis.FakeRedis`) is scoped per test; state does not leak between tests.
- **Shared test DB** (if any): truncate tables in `IAsyncLifetime.DisposeAsync` or use a transaction that is rolled back after each test.
- **Load tests**: run against a dedicated test environment (`TEST_TOKEN`, `CREATOR_TOKEN` scoped to test users); reset InfluxDB and Redis trending keys after each load run to prevent stale metrics from affecting subsequent runs.
- **Chaos tests**: restore docker-compose services after each scenario (`docker-compose start <service>`) before running the next scenario.
