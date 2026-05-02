# RULE: testing-required

**Không có test = không deliver.**
Mọi implementation code phải đi kèm test code ngay trong cùng response — không phải "sẽ thêm sau".

Source of truth: `docs/testing/TEST_PLAN.md`

---

## 1. Coverage Bắt Buộc theo Loại Code

| Loại code | Test bắt buộc | Framework |
|-----------|--------------|-----------|
| Service method / business logic | Unit test | xUnit + Moq (C#) / pytest (Python) |
| API endpoint | Integration test | WebApplicationFactory + Testcontainers |
| Kafka consumer handler | Unit test với mock event payload | Moq / fakeredis |
| Rule Engine scoring function | Unit test từng signal riêng | pytest |
| Idempotency logic | Unit test: first call → process; duplicate → skip | Moq / fakeredis |
| Fallback chain (timeout, Redis miss, Kafka down) | Integration test | WebApplicationFactory |

---

## 2. Test Cases Bắt Buộc cho Mỗi Endpoint

Với mọi endpoint được implement, Claude **phải** tạo tối thiểu các test case sau.
Đánh dấu từng ô — ô nào không áp dụng phải giải thích rõ lý do.

```
□ Happy path           — 200 / 201 / 202 + kiểm tra response body
□ Unauthorized         — 401: không có token / token expired
□ Forbidden            — 403: sai role (nếu endpoint có RBAC)
□ Validation error     — 400: input sai / thiếu field / sai type
□ Not found            — 404: resource không tồn tại (nếu có resource lookup)
□ Idempotency conflict — 409: gửi lại cùng Idempotency-Key (nếu endpoint có Idempotency-Key)
□ Rate limit           — 429: vượt rate limit (nếu endpoint có rate limit)
```

**Ví dụ mapping cho `POST /api/v1/auth/login`:**
```
✅ Happy path           — Login_WithValidCredentials_Returns200AndTokens
✅ Unauthorized         — N/A (login không cần token)
✅ Forbidden            — N/A
✅ Validation error     — Login_WithInvalidCredentials_Returns400_AUTH_INVALID_CREDENTIALS
✅ Not found            — N/A (sai password → 400, không phải 404)
✅ Idempotency conflict — N/A (login không có Idempotency-Key)
✅ Rate limit           — Login_After10Requests_Returns429_RATE_LIMIT_EXCEEDED
✅ Account locked       — Login_After5FailedAttempts_Returns423_ACCOUNT_LOCKED
```

---

## 3. Acceptance Criteria Coverage

Với mỗi User Story được implement:

- Map từng AC sang ít nhất 1 test case (xem AC Coverage Matrix trong TEST_PLAN.md Section 9)
- Comment trong test method: `// ACx.x.x: Given... When... Then...`
- Nếu có AC chưa có test → comment `// AC_MISSING: ACx.x.x — [lý do chưa cover]` và flag rõ trong response

**Ví dụ:**
```csharp
[Fact]
public async Task Login_After5FailedAttempts_ShouldReturn423_AC1_1_3()
{
    // AC1.1.3: Given user fails login 5 times
    //          When attempting 6th login
    //          Then account is locked and returns 423 ACCOUNT_LOCKED
    ...
}
```

```python
def test_morning_context_boosts_acoustic_songs(self, engine):
    # AC2.1.1: Given context=morning
    #          When song has mood_tags=["acoustic", "morning"]
    #          Then context_bonus == 0.3
    ...
```

---

## 4. Test Naming Convention

### C# (xUnit)

```
Pattern : MethodName_Scenario_ExpectedResult
Attribute: [Fact] hoặc [Theory] + [InlineData]

Ví dụ đúng:
  Login_WithValidCredentials_Returns200AndTokens
  Login_WithInvalidCredentials_Returns400
  Login_After5FailedAttempts_Returns423_AC1_1_3
  GenerateAccessToken_WithExpiredSettings_ReturnsTokenExpiredError
  CheckAndSet_WhenKeyExists_ReturnsTrue_IsDuplicate

Ví dụ sai:
  TestLogin()
  test1()
  LoginTest_Happy()
  ShouldWork()
```

### Python (pytest)

```
Pattern : test_method_name_scenario_expected_result
Decorator: @pytest.mark.asyncio nếu async

Ví dụ đúng:
  test_login_with_valid_credentials_returns_200
  test_morning_context_boosts_acoustic_songs
  test_duplicate_event_is_skipped_AC2_2_3
  test_fallback_to_trending_when_timeout

Ví dụ sai:
  test_login()
  testCase1()
  test_it_works()
```

---

## 5. Mock Rules

### Unit Tests — Phải mock tất cả I/O

| Dependency | C# mock | Python mock |
|------------|---------|-------------|
| Database | `Mock<IDbContext>` hoặc in-memory EF Core | `MagicMock` / không gọi DB |
| Redis | `Mock<IDatabase>` (StackExchange) | `fakeredis.aioredis.FakeRedis()` |
| Kafka producer/consumer | `Mock<IKafkaProducer>` | `MagicMock` |
| S3 / AWS SDK | `Mock<IAmazonS3>` | `MagicMock` / moto |
| HTTP calls ra ngoài | `Mock<HttpClient>` hoặc `MockHttpMessageHandler` | `respx` |

**Không được dùng real Redis, real PostgreSQL, real Kafka trong unit test.**

```csharp
// ĐÚNG — unit test dùng mock Redis
var redisMock = new Mock<IDatabase>();
redisMock
    .Setup(r => r.StringSetAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(),
        TimeSpan.FromHours(24), When.NotExists, CommandFlags.None))
    .ReturnsAsync(true);
var sut = new IdempotencyService(redisMock.Object);

// SAI — unit test connect thật
var redis = ConnectionMultiplexer.Connect("localhost:6379").GetDatabase(); // NEVER in unit test
```

```python
# ĐÚNG — unit test dùng fakeredis
import fakeredis.aioredis

@pytest.fixture
async def fake_redis():
    server = fakeredis.aioredis.FakeRedis()
    yield server
    await server.aclose()

# SAI — unit test connect thật
import aioredis
redis = await aioredis.create_redis("redis://localhost") # NEVER in unit test
```

### Integration Tests — Dùng real infrastructure (Testcontainers)

| Dependency | Cách dùng |
|------------|-----------|
| PostgreSQL | `Testcontainers.PostgreSql` hoặc GitHub Actions service |
| Redis | `Testcontainers.Redis` hoặc GitHub Actions service |
| Kafka | Testcontainers `confluentinc/cp-kafka` |
| S3 | LocalStack hoặc MinIO (`infra/docker-compose.yml` port 9000) |
| Elasticsearch | Testcontainers `elasticsearch` |

---

## 6. Thứ Tự Deliver Bắt Buộc

Claude **không được** deliver implementation code mà không có test đi kèm.

**Thứ tự output trong mỗi response:**

```
1. Implementation code
   └─ Controller / Service / Handler / Consumer

2. Unit tests
   └─ Bắt buộc với mọi loại code (Section 1)
   └─ Tên file: <ClassName>Tests.cs / test_<module>.py

3. Integration tests (nếu là API endpoint)
   └─ Dùng WebApplicationFactory + Testcontainers
   └─ Tên file: <ServiceName>IntegrationTests.cs / test_<endpoint>_integration.py

4. Ghi chú infrastructure
   └─ Ví dụ: "Integration tests yêu cầu PostgreSQL + Redis (Testcontainers tự spin up)"
   └─ Ví dụ: "Load test: chạy k6 trước sprint demo, không chạy trong CI thường"
```

**Ví dụ sai — deliver code không có test:**
```
User: "Implement IdempotencyService"

Claude: [code IdempotencyService.cs]
"Bạn có thể viết test sau."  ← KHÔNG CHẤP NHẬN
```

**Ví dụ đúng:**
```
User: "Implement IdempotencyService"

Claude: [code IdempotencyService.cs]
         [code IdempotencyServiceTests.cs — unit tests đầy đủ]
         "Integration tests cần Redis Testcontainer — xem Section 5."
```

---

## 7. Ví Dụ Test Structure Đầy Đủ

### C# — Unit Test Structure

```csharp
// File: services/analytics-service/tests/AnalyticsService.UnitTests/IdempotencyServiceTests.cs

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
    public async Task CheckAndSet_WhenKeyNotExists_ReturnsFalse_AndSetsKey()
    {
        // AC2.2.3: Given eventId not in Redis
        //          When CheckAndSet called
        //          Then returns false (not duplicate) and sets key
        _redisMock
            .Setup(r => r.StringSetAsync(
                It.IsAny<RedisKey>(), It.IsAny<RedisValue>(),
                TimeSpan.FromHours(24), When.NotExists, CommandFlags.None))
            .ReturnsAsync(true);

        var isDuplicate = await _sut.CheckAndSetAsync("evt-abc-123", TimeSpan.FromHours(24));

        isDuplicate.Should().BeFalse();
        _redisMock.Verify(r => r.StringSetAsync(
            It.Is<RedisKey>(k => k.ToString().Contains("evt-abc-123")),
            It.IsAny<RedisValue>(), TimeSpan.FromHours(24),
            When.NotExists, CommandFlags.None), Times.Once);
    }

    [Fact]
    public async Task CheckAndSet_WhenKeyExists_ReturnsTrue_IsDuplicate()
    {
        // AC2.2.3: Given eventId already in Redis
        //          When CheckAndSet called
        //          Then returns true (is duplicate) — skip processing
        _redisMock
            .Setup(r => r.StringSetAsync(
                It.IsAny<RedisKey>(), It.IsAny<RedisValue>(),
                It.IsAny<TimeSpan?>(), When.NotExists, CommandFlags.None))
            .ReturnsAsync(false);

        var isDuplicate = await _sut.CheckAndSetAsync("evt-abc-123", TimeSpan.FromHours(24));

        isDuplicate.Should().BeTrue();
    }

    [Fact]
    public async Task CheckAndSet_ShouldUseTtlOf24Hours()
    {
        // Redis key design: idempotency TTL = 24h (see .github/REDIS_KEY_DESIGN.md)
        _redisMock
            .Setup(r => r.StringSetAsync(
                It.IsAny<RedisKey>(), It.IsAny<RedisValue>(),
                It.IsAny<TimeSpan?>(), When.NotExists, CommandFlags.None))
            .ReturnsAsync(true);

        await _sut.CheckAndSetAsync("evt-abc-123", TimeSpan.FromHours(24));

        _redisMock.Verify(r => r.StringSetAsync(
            It.IsAny<RedisKey>(), It.IsAny<RedisValue>(),
            TimeSpan.FromHours(24), When.NotExists, CommandFlags.None), Times.Once);
    }
}
```

### C# — Integration Test Structure

```csharp
// File: services/auth-service/tests/AuthService.IntegrationTests/AuthIntegrationTests.cs

namespace AuthService.IntegrationTests;

public class AuthIntegrationTests : IClassFixture<AuthWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AuthIntegrationTests(AuthWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Login_WithValidCredentials_Returns200AndTokens_AC1_1_1()
    {
        // AC1.1.1: Happy path — returns accessToken + HTTP-only refresh cookie
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            username = "testlistener@example.com",
            password = "TestPassword123!"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<LoginResponse>>();
        body!.Success.Should().BeTrue();
        body.Data!.AccessToken.Should().NotBeNullOrEmpty();
        body.Error.Should().BeNull();
        response.Headers.Should().ContainKey("Set-Cookie"); // HTTP-only refresh token
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns400_AC1_1_2()
    {
        // AC1.1.2: Invalid credentials → AUTH_INVALID_CREDENTIALS, no user info leaked
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            username = "testlistener@example.com",
            password = "WrongPassword"
        });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Success.Should().BeFalse();
        body.Error!.Code.Should().Be("AUTH_INVALID_CREDENTIALS");
        body.Data.Should().BeNull();
    }

    [Fact]
    public async Task Login_WithoutBody_Returns400_ValidationError()
    {
        // Validation: missing required fields
        var response = await _client.PostAsJsonAsync("/api/v1/auth/login", new { });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("VALIDATION_ERROR");
    }

    [Fact]
    public async Task Login_After5FailedAttempts_Returns423_AC1_1_3()
    {
        // AC1.1.3: Brute-force lock after 5 fails
        for (int i = 0; i < 5; i++)
            await _client.PostAsJsonAsync("/api/v1/auth/login",
                new { username = "lockme@example.com", password = "Wrong" });

        var response = await _client.PostAsJsonAsync("/api/v1/auth/login",
            new { username = "lockme@example.com", password = "Wrong" });

        response.StatusCode.Should().Be((HttpStatusCode)423);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        body!.Error!.Code.Should().Be("ACCOUNT_LOCKED");
    }
}
```

### Python — Unit Test Structure (Rule Engine)

```python
# File: services/recommendation-service/tests/unit/test_rule_engine.py

import pytest
from services.rule_engine import RuleEngine, UserWeights, SongCandidate


@pytest.fixture
def engine():
    return RuleEngine()


class TestRuleEngineScoring:

    def test_morning_context_boosts_acoustic_songs(self, engine):
        # AC2.1.1: Given context=morning, mood_tags=["acoustic"]
        #          When compute_score called
        #          Then context_bonus == 0.3
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id="e5f6a7b8-c9d0-1234-efab-567890123456",
            mood_tags=["acoustic", "morning"]
        )
        score = engine.compute_score(candidate, context="morning", weights=UserWeights())

        assert score.context_bonus == 0.3

    def test_non_matching_context_gives_zero_bonus(self, engine):
        # Given context=morning, mood_tags=["energetic"] → no match
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id="b8c9d0e1-f2a3-4567-bcde-890123456789",
            mood_tags=["energetic", "party"]
        )
        score = engine.compute_score(candidate, context="morning", weights=UserWeights())

        assert score.context_bonus == 0.0

    def test_play_weight_increases_genre_score(self, engine):
        # AC2.1.3: High genre weight (from plays) → positive preference_bonus
        genre_id = "d4e5f6a7-b8c9-0123-defa-234567890123"
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id=genre_id,
            mood_tags=[]
        )
        score = engine.compute_score(
            candidate, context="none",
            weights=UserWeights(genre_weights={genre_id: 1.5})
        )

        assert score.preference_bonus > 0

    def test_skip_penalty_reduces_genre_score(self, engine):
        # AC2.1.2: Low genre weight (from skips) → negative preference_bonus
        genre_id = "b8c9d0e1-f2a3-4567-bcde-890123456789"
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id=genre_id,
            mood_tags=[]
        )
        score = engine.compute_score(
            candidate, context="none",
            weights=UserWeights(genre_weights={genre_id: 0.2})
        )

        assert score.preference_bonus < 0

    def test_final_score_equals_sum_of_components(self, engine):
        # Invariant: total = base + context_bonus + preference_bonus - skip_penalty
        genre_id = "e5f6a7b8-c9d0-1234-efab-567890123456"
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id=genre_id,
            mood_tags=["acoustic"]
        )
        score = engine.compute_score(
            candidate, context="morning",
            weights=UserWeights(genre_weights={genre_id: 1.2})
        )

        expected = score.base_score + score.context_bonus + score.preference_bonus - score.skip_penalty
        assert abs(score.total - expected) < 0.001

    def test_timeout_constant_is_300ms(self, engine):
        # AC2.1.5: Caller enforces 300ms timeout via this constant
        assert engine.TIMEOUT_MS == 300

    def test_explain_text_is_present(self, engine):
        # AC2.1.4: Every scored candidate must have non-empty explain_text
        candidate = SongCandidate(
            song_id="b2c3d4e5-f6a7-8901-bcde-f12345678901",
            genre_id="d4e5f6a7-b8c9-0123-defa-234567890123",
            mood_tags=["acoustic"]
        )
        score = engine.compute_score(candidate, context="morning", weights=UserWeights())

        assert score.explain_text is not None
        assert len(score.explain_text) > 0


class TestIdempotency:

    @pytest.mark.asyncio
    async def test_duplicate_event_is_skipped(self, fake_redis):
        # AC2.2.3: Given eventId already in Redis SET
        #          When same event received again
        #          Then returns False (skip) — not processed
        event_id = "duplicate-event-abc123"
        await fake_redis.set(f"dedup:Song_Played:{event_id}", "1", ex=86400)

        processed = await consume_kafka_event("Song_Played", {
            "event_id": event_id,
            "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "song_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
            "genre_id": "d4e5f6a7-b8c9-0123-defa-234567890123",
            "duration_percent": 95.0
        })

        assert processed is False

    @pytest.mark.asyncio
    async def test_first_event_is_processed(self, fake_redis):
        # AC2.2.3: Given eventId NOT in Redis
        #          When event received
        #          Then returns True (processed)
        processed = await consume_kafka_event("Song_Played", {
            "event_id": "brand-new-event-xyz",
            "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "song_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
            "genre_id": "d4e5f6a7-b8c9-0123-defa-234567890123",
            "duration_percent": 95.0
        })

        assert processed is True
```

### Python — Integration Test Structure (Fallback)

```python
# File: services/recommendation-service/tests/integration/test_recommendation_fallback.py

import pytest
from unittest.mock import patch
import fakeredis.aioredis


@pytest.mark.asyncio
async def test_fallback_to_trending_when_rule_engine_times_out(async_client, fake_redis):
    # AC2.1.5: Given Rule Engine timeout > 300ms
    #          When GET /recommendations called
    #          Then returns Top 50 Trending from Redis (not empty, not error)
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
    assert len(data["data"]) >= 1
    assert data["meta"]["cache"] == "HIT"
```

---

## 8. Ngoại Lệ Được Phép

Các loại code sau **không bắt buộc** có test — nhưng Claude **phải** comment lý do rõ ràng:

| Loại | Comment bắt buộc |
|------|-----------------|
| `Program.cs` / `Startup.cs` | `// No test needed: bootstrap/DI registration — no business logic` |
| `appsettings.json` / `appsettings.Development.json` | `// No test needed: configuration file` |
| DTO / Request / Response classes thuần (no logic) | `// No test needed: plain data class — no business logic` |
| EF Core migration files | `// No test needed: generated migration — tested via integration test seeding` |
| `.proto` files | `// No test needed: protobuf schema definition` |

**Nếu Claude bỏ test với lý do ngoài danh sách trên → phải hỏi xác nhận trước.**

---

## 9. Test Tools Reference

### C# Packages (thêm vào `.csproj` của test project)

```xml
<PackageReference Include="xunit" Version="2.9.*" />
<PackageReference Include="xunit.runner.visualstudio" Version="2.8.*" />
<PackageReference Include="Moq" Version="4.20.*" />
<PackageReference Include="FluentAssertions" Version="6.12.*" />
<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.0.*" />
<PackageReference Include="Testcontainers" Version="3.8.*" />
<PackageReference Include="Testcontainers.PostgreSql" Version="3.8.*" />
<PackageReference Include="Testcontainers.Redis" Version="3.8.*" />
```

### Python Packages (`requirements-test.txt`)

```
pytest==8.2.*
httpx==0.27.*
pytest-asyncio==0.23.*
respx==0.21.*
fakeredis[aioredis]
```

### Load Tests (k6 — chạy trước sprint demo)

| File | Endpoint | Threshold |
|------|----------|-----------|
| `tests/load/gateway_routing.js` | `GET /health` | p95 < 50ms |
| `tests/load/streaming_url.js` | `GET /streaming/{id}/url` | p95 < 300ms |
| `tests/load/search.js` | `GET /search` | p95 < 200ms |
| `tests/load/recommendation.js` | `GET /recommendations` | p95 < 300ms |
| `tests/load/analytics_heatmap.js` | `GET /analytics/creator/heatmap/{id}` | p95 < 500ms |

### Chaos Tests (chạy một lần trước final demo)

| Scenario | Lệnh | Expected |
|----------|------|----------|
| C-01: Kafka down | `docker-compose stop kafka` | 202, local disk queue |
| C-02: Redis down | `docker-compose stop redis` | Top 50 Trending fallback |
| C-03: CDN fail | Invalid `CDN_PRIMARY_URL` | Secondary CDN URL |
| C-04: Auth down | `docker-compose stop auth-service` | < 60s: OK; > 60s: 503 |

---

## 10. Checklist Trước Khi Submit

- [ ] Mọi service method có unit test?
- [ ] Mọi endpoint có đủ 7 test cases (hoặc đánh dấu N/A với lý do)?
- [ ] Mỗi test method comment AC tương ứng?
- [ ] Unit tests dùng mock — không connect real Redis/DB/Kafka?
- [ ] Integration tests dùng Testcontainers / test infrastructure?
- [ ] File ngoại lệ có comment `// No test needed: [lý do]`?
- [ ] Ghi chú rõ test nào cần infrastructure để chạy?
