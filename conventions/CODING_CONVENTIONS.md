# CODING_CONVENTIONS.md

Smart Music Streaming Platform — Coding Conventions
Team: 3-4 people, 1 semester
Stack: C# ASP.NET Core (9 services) + Python FastAPI (1 service) + React TypeScript (frontend)

---

## 1. C# / ASP.NET Core Conventions

### 1.1 Folder Structure (per service)

Each C# service follows Clean Architecture with four projects. Use `auth-service` as the canonical example:

```
services/
└── auth-service/
    ├── src/
    │   ├── AuthService.Api/                   ← ASP.NET Core project (entry point)
    │   │   ├── Controllers/                   ← HTTP controllers only, no business logic
    │   │   ├── Middleware/                    ← CorrelationId, Exception, Logging
    │   │   ├── Extensions/                    ← IServiceCollection extensions (DI setup)
    │   │   └── Program.cs
    │   ├── AuthService.Application/           ← Business logic, use cases
    │   │   ├── Services/                      ← IAuthService, AuthService
    │   │   ├── DTOs/                          ← Request/Response DTOs (not domain models)
    │   │   ├── Exceptions/                    ← Domain-specific exceptions
    │   │   └── Interfaces/                    ← ITokenBlacklist, IRefreshTokenRepo, etc.
    │   ├── AuthService.Infrastructure/        ← External dependencies
    │   │   ├── Repositories/                  ← EF Core implementations
    │   │   ├── Kafka/                         ← Producers, Consumers
    │   │   ├── Redis/                         ← Redis client wrappers
    │   │   └── Data/                          ← DbContext, Migrations
    │   └── AuthService.Domain/                ← Pure domain models, no dependencies
    │       └── Models/                        ← User, RefreshToken, etc.
    ├── tests/
    │   ├── AuthService.UnitTests/
    │   └── AuthService.IntegrationTests/
    └── Dockerfile
```

### 1.2 Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Class | PascalCase | `AuthService`, `TokenBlacklistRepository` |
| Interface | I + PascalCase | `IAuthService`, `IRefreshTokenRepository` |
| Method (public) | PascalCase | `ValidateTokenAsync`, `GetUserProfileAsync` |
| Method (private) | PascalCase | `HashPassword`, `BuildJwtClaims` |
| Variable (local) | camelCase | `accessToken`, `correlationId` |
| Parameter | camelCase | `userId`, `tokenExpiry` |
| Private field | _camelCase | `_logger`, `_redisCache` |
| Constant | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_TOKEN_TTL` |
| DTO suffix | Request/Response | `LoginRequest`, `LoginResponse` |
| Exception suffix | Exception | `TokenExpiredException`, `AccountLockedException` |
| Async method suffix | Async | `GetUserAsync`, `PublishEventAsync` |

### 1.3 Controller Pattern

```csharp
[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpPost("login")]
    [ProducesResponseType(typeof(ApiResponse<LoginResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _authService.LoginAsync(request, cancellationToken);
        return Ok(ApiResponse<LoginResponse>.Success(result, HttpContext));
    }
}
```

Rules:
- Controllers are thin — no business logic, only: validate input → call service → return response
- Always accept `CancellationToken cancellationToken` in async endpoints
- Never catch exceptions in controllers — let `GlobalExceptionMiddleware` handle it
- Use `[ProducesResponseType]` on every action for OpenAPI docs

### 1.4 Response Wrapper

All API responses use a shared `ApiResponse<T>` wrapper that matches the contract below:

```json
{
  "success": true,
  "data": { "...": "..." },
  "meta": { "apiVersion": "v1", "requestId": "uuid", "timestamp": "ISO8601", "cache": "HIT|MISS" },
  "error": null
}
```

```csharp
public class ApiResponse<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public ApiMeta Meta { get; init; }
    public ApiError? Error { get; init; }

    public static ApiResponse<T> Success(T data, HttpContext ctx, string? cache = null) => new()
    {
        Success = true,
        Data = data,
        Meta = ApiMeta.From(ctx, cache),
        Error = null
    };

    public static ApiResponse<T> Fail(string code, string message, HttpContext ctx) => new()
    {
        Success = false,
        Data = default,
        Meta = ApiMeta.From(ctx),
        Error = new ApiError(code, message)
    };
}

public class ApiMeta
{
    public string ApiVersion { get; init; } = "v1";
    public string RequestId { get; init; } = string.Empty;
    public string Timestamp { get; init; } = string.Empty;
    public string? Cache { get; init; }

    public static ApiMeta From(HttpContext ctx, string? cache = null) => new()
    {
        RequestId = ctx.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString(),
        Timestamp = DateTime.UtcNow.ToString("O"),
        Cache = cache
    };
}

public record ApiError(string Code, string Message);
```

Error response shape:

```json
{
  "success": false,
  "data": null,
  "meta": { "apiVersion": "v1", "requestId": "uuid", "timestamp": "ISO8601" },
  "error": { "code": "AUTH_INVALID_CREDENTIALS", "message": "Invalid email or password." }
}
```

### 1.5 Custom Exceptions & Global Exception Middleware

Define domain exceptions in `AuthService.Application/Exceptions/`:

```csharp
// Base
public abstract class DomainException : Exception
{
    public string ErrorCode { get; }
    public int HttpStatusCode { get; }
    protected DomainException(string errorCode, string message, int httpStatusCode)
        : base(message)
    {
        ErrorCode = errorCode;
        HttpStatusCode = httpStatusCode;
    }
}

// Specific exceptions
public class AuthInvalidCredentialsException()
    : DomainException("AUTH_INVALID_CREDENTIALS", "Invalid email or password.", 400);

public class AccountLockedException()
    : DomainException("ACCOUNT_LOCKED", "Account is temporarily locked.", 423);

public class TokenReusedException()
    : DomainException("TOKEN_REUSED", "Refresh token reuse detected. All sessions revoked.", 403);

public class TokenExpiredException()
    : DomainException("TOKEN_EXPIRED", "Access token has expired.", 401);

public class NotFoundException(string resource)
    : DomainException($"{resource.ToUpper()}_NOT_FOUND", $"{resource} not found.", 404);

public class IdempotencyConflictException()
    : DomainException("IDEMPOTENCY_CONFLICT", "Duplicate request detected.", 409);

public class ValidationException(string message)
    : DomainException("VALIDATION_ERROR", message, 400);
```

Global exception middleware — register before all other middleware in `Program.cs`:

```csharp
public class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (DomainException ex)
        {
            logger.LogWarning(ex, "Domain exception: {ErrorCode}", ex.ErrorCode);
            context.Response.StatusCode = ex.HttpStatusCode;
            await context.Response.WriteAsJsonAsync(
                ApiResponse<object>.Fail(ex.ErrorCode, ex.Message, context));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(
                ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.", context));
        }
    }
}
```

Exception-to-HTTP mapping:

| Exception | HTTP Status | Error Code |
|---|---|---|
| `AuthInvalidCredentialsException` | 400 | `AUTH_INVALID_CREDENTIALS` |
| `AccountLockedException` | 423 | `ACCOUNT_LOCKED` |
| `TokenReusedException` | 403 | `TOKEN_REUSED` |
| `TokenExpiredException` | 401 | `TOKEN_EXPIRED` |
| `NotFoundException` | 404 | `{RESOURCE}_NOT_FOUND` |
| `IdempotencyConflictException` | 409 | `IDEMPOTENCY_CONFLICT` |
| `ValidationException` | 400 | `VALIDATION_ERROR` |
| Unhandled `Exception` | 500 | `INTERNAL_ERROR` |

### 1.6 Dependency Injection Conventions

Group DI registrations by layer in `Extensions/ServiceCollectionExtensions.cs`:

```csharp
// Extensions/ServiceCollectionExtensions.cs
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ITokenService, TokenService>();
        return services;
    }

    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddSingleton<ITokenBlacklist, RedisTokenBlacklist>();
        // EF Core, Redis, Kafka registrations here
        return services;
    }
}
```

Rules:
- `AddScoped` for repositories and business services (per-request lifetime)
- `AddSingleton` for Redis client, Kafka producer, HttpClient factories
- `AddTransient` for lightweight stateless utilities only
- Never `new` a dependency inside a class — always inject via constructor

### 1.7 Async/Await Conventions

```csharp
// CORRECT: always pass CancellationToken through
public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct)
{
    var user = await _userRepository.GetByEmailAsync(request.Email, ct);
    // ...
}

// CORRECT: ConfigureAwait(false) in Infrastructure layer (not in Controllers/Application)
public async Task<string?> GetAsync(string key, CancellationToken ct)
{
    return await _redis.StringGetAsync(key).ConfigureAwait(false);
}

// WRONG: blocking async — deadlock risk
var result = _service.GetAsync().Result;                        // ❌
var result = _service.GetAsync().GetAwaiter().GetResult();      // ❌

// WRONG: async void — exceptions are swallowed
public async void DoSomething() { }                             // ❌
```

Rules:
- All async methods must carry the `Async` suffix
- Always accept `CancellationToken` in every public async method
- Use `ConfigureAwait(false)` in the Infrastructure layer; omit it in Controllers and Application layer
- Never use `.Result` or `.Wait()` — always `await`

### 1.8 CorrelationId — Inject & Propagate

Extract or generate the correlation ID on every inbound request:

```csharp
// Middleware/CorrelationIdMiddleware.cs
public class CorrelationIdMiddleware(RequestDelegate next)
{
    private const string HeaderName = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext context)
    {
        var correlationId = context.Request.Headers[HeaderName].FirstOrDefault()
                            ?? Guid.NewGuid().ToString();
        context.Items["CorrelationId"] = correlationId;
        context.Response.Headers[HeaderName] = correlationId;

        using var scope = context.RequestServices
            .GetRequiredService<ILogger<CorrelationIdMiddleware>>()
            .BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId });

        await next(context);
    }
}
```

Propagate to outgoing HTTP calls via a delegating handler:

```csharp
public class CorrelationIdDelegatingHandler(IHttpContextAccessor accessor) : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        var correlationId = accessor.HttpContext?.Items["CorrelationId"]?.ToString();
        if (correlationId != null)
            request.Headers.TryAddWithoutValidation("X-Correlation-Id", correlationId);
        return base.SendAsync(request, ct);
    }
}
```

Propagate to Kafka messages (include in both header and payload):

```csharp
// Always include correlation_id in the Kafka message value
var message = new SongPlayedEvent
{
    EventId = Guid.NewGuid().ToString(),
    Version = "v1",
    CorrelationId = httpContext.Items["CorrelationId"]?.ToString() ?? "",
    SongId = songId,
    // ...
};
```

---

## 2. Python / FastAPI Conventions (Recommendation Service)

### 2.1 Folder Structure

```
services/
└── recommendation-service/
    ├── src/
    │   ├── main.py                            ← FastAPI app entry point
    │   ├── routers/
    │   │   └── recommendations.py             ← Route handlers (thin, like controllers)
    │   ├── services/
    │   │   └── recommendation_service.py      ← Business logic
    │   ├── repositories/
    │   │   └── redis_repository.py            ← Redis access layer
    │   ├── schemas/
    │   │   ├── request.py                     ← Pydantic input models
    │   │   └── response.py                    ← Pydantic output models
    │   ├── models/
    │   │   └── recommendation.py              ← Internal domain models
    │   ├── kafka/
    │   │   ├── consumer.py
    │   │   └── producer.py
    │   ├── middleware/
    │   │   └── correlation_id.py
    │   ├── exceptions/
    │   │   └── domain_exceptions.py
    │   └── config.py                          ← Settings via pydantic-settings
    ├── tests/
    │   ├── unit/
    │   └── integration/
    ├── requirements.txt
    └── Dockerfile
```

### 2.2 Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Module/file | snake_case | `recommendation_service.py` |
| Class | PascalCase | `RecommendationService`, `SongWeightRepository` |
| Function/method | snake_case | `get_recommendations`, `update_genre_weight` |
| Variable | snake_case | `user_id`, `correlation_id` |
| Constant | UPPER_SNAKE_CASE | `MAX_RECOMMENDATIONS`, `DEFAULT_TTL` |
| Pydantic schema (request) | PascalCase + Request | `RecommendationRequest`, `FeedbackRequest` |
| Pydantic schema (response) | PascalCase + Response | `RecommendationResponse`, `SongItem` |
| Private method | _snake_case | `_build_cache_key`, `_compute_score` |

### 2.3 Pydantic Schema Conventions

```python
# schemas/request.py
from pydantic import BaseModel, Field, field_validator
from typing import Literal
from uuid import UUID

class FeedbackRequest(BaseModel):
    event_id: UUID = Field(..., description="Unique event ID for idempotency")
    version: str = Field(default="v1")
    song_id: UUID = Field(..., description="Song being rated")
    action: Literal["PLAY", "SKIP"] = Field(..., description="User action")
    duration_percent: float = Field(..., ge=0, le=100, description="Percent of song listened")

    @field_validator("duration_percent")
    @classmethod
    def validate_duration(cls, v: float) -> float:
        return round(v, 2)


# schemas/response.py
class ReasonItem(BaseModel):
    type: Literal["CONTEXT", "PREFERENCE", "TRENDING"]
    text: str

class SongItem(BaseModel):
    song_id: str
    title: str
    artist: str
    thumbnail: str
    reason: ReasonItem

class RecommendationResponse(BaseModel):
    success: bool = True
    data: list[SongItem]
    meta: dict
    error: None = None
```

### 2.4 Router Pattern

```python
# routers/recommendations.py
from fastapi import APIRouter, Depends, Request
from schemas.request import FeedbackRequest
from schemas.response import RecommendationResponse
from services.recommendation_service import RecommendationService

router = APIRouter(prefix="/api/v1/recommendations", tags=["recommendations"])

@router.get("", response_model=RecommendationResponse)
async def get_recommendations(
    request: Request,
    context: str = "morning",
    limit: int = 10,
    service: RecommendationService = Depends(),
):
    result = await service.get_recommendations(
        user_id=request.state.user_id,
        context=context,
        limit=limit,
        correlation_id=request.state.correlation_id,
    )
    return RecommendationResponse(data=result, meta=_build_meta(request))

@router.post("/feedback", status_code=202)
async def post_feedback(
    request: Request,
    body: FeedbackRequest,
    service: RecommendationService = Depends(),
):
    await service.record_feedback(
        feedback=body,
        user_id=request.state.user_id,
        correlation_id=request.state.correlation_id,
    )
    return {"success": True, "data": True, "meta": _build_meta(request), "error": None}
```

### 2.5 Error Handling

```python
# exceptions/domain_exceptions.py
class DomainException(Exception):
    def __init__(self, error_code: str, message: str, http_status: int):
        self.error_code = error_code
        self.message = message
        self.http_status = http_status
        super().__init__(message)

class ValidationException(DomainException):
    def __init__(self, message: str):
        super().__init__("VALIDATION_ERROR", message, 400)

class IdempotencyConflictException(DomainException):
    def __init__(self):
        super().__init__("IDEMPOTENCY_CONFLICT", "Duplicate request.", 409)


# main.py — register handler
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import datetime

app = FastAPI()

@app.exception_handler(DomainException)
async def domain_exception_handler(request: Request, exc: DomainException):
    return JSONResponse(
        status_code=exc.http_status,
        content={
            "success": False,
            "data": None,
            "meta": {
                "apiVersion": "v1",
                "requestId": request.state.correlation_id,
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            },
            "error": {"code": exc.error_code, "message": exc.message},
        },
    )
```

### 2.6 Async Conventions

```python
# CORRECT: async def for all route handlers and I/O-bound methods
async def get_recommendations(self, user_id: str, context: str) -> list[SongItem]:
    weights = await self._repo.get_weights(user_id)
    # ...

# CORRECT: use asyncio-native Redis client (redis.asyncio)
import redis.asyncio as aioredis
client = aioredis.from_url("redis://...")
value = await client.get(key)

# WRONG: blocking calls in async context — blocks the event loop
import time
time.sleep(1)           # ❌ blocks event loop
requests.get(url)       # ❌ use httpx.AsyncClient instead
```

### 2.7 CorrelationId Middleware (Python)

```python
# middleware/correlation_id.py
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import uuid

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = (
            request.headers.get("X-Correlation-Id") or str(uuid.uuid4())
        )
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["X-Correlation-Id"] = correlation_id
        return response
```

Register in `main.py`:

```python
from middleware.correlation_id import CorrelationIdMiddleware
app.add_middleware(CorrelationIdMiddleware)
```

---

## 3. Shared Conventions (both languages)

### 3.1 Structured JSON Logging

Every log line must be JSON. Mandatory shape:

```json
{
  "timestamp": "2026-04-15T08:23:11.452Z",
  "level": "INFO",
  "service": "auth-service",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "User login successful",
  "userId": "uuid-...",
  "durationMs": 145
}
```

C# — Serilog:

```csharp
// Program.cs
Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "auth-service")
    .WriteTo.Console(new JsonFormatter())
    .CreateLogger();

// Usage — push correlationId into the log scope
using (LogContext.PushProperty("CorrelationId", correlationId))
{
    _logger.LogInformation("User login successful. UserId={UserId} Duration={Duration}ms",
        userId, elapsedMs);
}
```

Python — structlog:

```python
import structlog
logger = structlog.get_logger()

# Usage
logger.info("recommendations_returned",
    service="recommendation-service",
    correlation_id=correlation_id,
    user_id=user_id,
    count=len(results),
    cache="HIT")
```

Mandatory log fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `timestamp` | ISO8601 UTC | Yes | Always UTC |
| `level` | DEBUG/INFO/WARN/ERROR | Yes | |
| `service` | string | Yes | Service name constant |
| `correlationId` | UUID string | Yes | From `X-Correlation-Id` header |
| `message` | string | Yes | Human-readable description |
| `userId` | UUID string | When available | Never log email or password |
| `durationMs` | integer | On request end | |
| `error` | string | On exception | Stack trace in DEBUG only |

Rules:
- NEVER log passwords, tokens, or PII (email, phone number, etc.)
- Log at INFO for normal operations, WARN for business rule violations, ERROR for unexpected failures
- Include `durationMs` on every completed operation (login, DB query, Kafka publish)

### 3.2 Kafka Consumer/Producer Pattern

Producer (C#):

```csharp
public async Task PublishAsync<T>(string topic, T message, CancellationToken ct) where T : IKafkaEvent
{
    var json = JsonSerializer.Serialize(message);
    var kafkaMessage = new Message<string, string>
    {
        Key = message.EventId,          // Use eventId as key for ordering
        Value = json,
        Headers = new Headers
        {
            { "correlation_id", Encoding.UTF8.GetBytes(message.CorrelationId) },
            { "version", Encoding.UTF8.GetBytes(message.Version) }
        }
    };
    await _producer.ProduceAsync(topic, kafkaMessage, ct);
    _logger.LogInformation("Kafka published. Topic={Topic} EventId={EventId}", topic, message.EventId);
}
```

Consumer (C# — idempotency check first, then commit after successful processing):

```csharp
public async Task ConsumeLoopAsync(CancellationToken ct)
{
    while (!ct.IsCancellationRequested)
    {
        var result = _consumer.Consume(ct);
        var eventId = result.Message.Key;

        // 1. Idempotency check BEFORE any processing
        var isDuplicate = await _idempotencyStore.CheckAndSetAsync(eventId, TimeSpan.FromHours(24));
        if (isDuplicate)
        {
            _logger.LogWarning("Duplicate event skipped. EventId={EventId}", eventId);
            continue;
        }

        // 2. Process
        try
        {
            await ProcessEventAsync(result.Message.Value, ct);
            _consumer.Commit(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process event. EventId={EventId}", eventId);
            // After 3 failures → send to Dead Letter Queue (DLQ)
        }
    }
}
```

### 3.3 Circuit Breaker Pattern

C# — use Polly:

```csharp
// Registration in DI (Program.cs or Extensions)
services.AddHttpClient<IMusicServiceClient, MusicServiceClient>()
    .AddPolicyHandler(Policy
        .Handle<HttpRequestException>()
        .Or<TimeoutRejectedException>()
        .CircuitBreakerAsync(
            handledEventsAllowedBeforeBreaking: 3,
            durationOfBreak: TimeSpan.FromSeconds(30),
            onBreak: (ex, ts) => logger.LogWarning("Circuit open for {Duration}s", ts.TotalSeconds),
            onReset: () => logger.LogInformation("Circuit closed"),
            onHalfOpen: () => logger.LogInformation("Circuit half-open")
        ))
    .AddPolicyHandler(Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromSeconds(2)));
```

Mandatory fallback behavior for every circuit-broken downstream call:

| Dependency down | Fallback |
|---|---|
| Music Service | Return cached data from Redis; if no cache, return empty list with `meta.warning: "degraded"` |
| Auth Service | Gateway uses cached public key for offline JWT verification |
| Recommendation Service | Return Top 50 Trending list from Redis |

### 3.4 Health Check Endpoint

All services must expose `GET /health`. Response shape:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime_seconds": 3600,
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "kafka": "healthy"
  }
}
```

C#:

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    .AddNpgsql(connectionString, name: "database")
    .AddRedis(redisConnection, name: "redis")
    // .AddKafka(kafkaConfig, name: "kafka")
    ;

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});
```

Python (FastAPI):

```python
import os
import time

START_TIME = time.time()

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": os.getenv("SERVICE_VERSION", "1.0.0"),
        "uptime_seconds": int(time.time() - START_TIME),
        "checks": {
            "redis": await check_redis(),
        }
    }
```

---

## Quick Reference Cheatsheet

| Element | C# Convention | Python Convention |
|---|---|---|
| Class | `PascalCase` — `AuthService` | `PascalCase` — `RecommendationService` |
| Interface | `I` + PascalCase — `IAuthService` | N/A (use ABC or Protocol if needed) |
| Public method | `PascalCase` — `LoginAsync` | `snake_case` — `get_recommendations` |
| Private method | `PascalCase` — `HashPassword` | `_snake_case` — `_build_cache_key` |
| Private field | `_camelCase` — `_logger` | `_snake_case` — `_repo` |
| Local variable | `camelCase` — `accessToken` | `snake_case` — `access_token` |
| Parameter | `camelCase` — `userId` | `snake_case` — `user_id` |
| Constant | `UPPER_SNAKE_CASE` — `MAX_RETRY_COUNT` | `UPPER_SNAKE_CASE` — `MAX_RETRY_COUNT` |
| File/module | `PascalCase.cs` — `AuthService.cs` | `snake_case.py` — `auth_service.py` |
| DTO / Schema | `LoginRequest`, `LoginResponse` | `LoginRequest(BaseModel)`, `LoginResponse(BaseModel)` |
| Exception | `TokenExpiredException` | `TokenExpiredException(DomainException)` |
| Async suffix | Required — `GetUserAsync` | Not required — `get_user` (always `async def`) |
| DB/JSON keys | `snake_case` — `user_id`, `created_at` | `snake_case` — `user_id`, `created_at` |
| HTTP header | `X-Correlation-Id` | `X-Correlation-Id` |
| Log format | JSON via Serilog `JsonFormatter` | JSON via structlog |
| Cancellation | `CancellationToken ct` on all async public methods | N/A — FastAPI handles via `anyio` |
| DI scope | `AddScoped` for services/repos | `Depends()` per-request by default |
| Blocking calls | Never use `.Result` / `.Wait()` | Never use `time.sleep` / `requests.get` in async |
