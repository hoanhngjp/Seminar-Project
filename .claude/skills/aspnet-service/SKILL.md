# SKILL: aspnet-service

> Claude đọc file này mỗi khi tạo hoặc chỉnh sửa C# ASP.NET Core service.
> Ngắn gọn — đọc để làm, không phải đọc để học.

---

## 1. Folder Structure

```
services/
└── {name}-service/
    ├── src/
    │   ├── {Name}Service.Api/              ← Entry point: Controllers, Middleware, Extensions, Program.cs
    │   │   ├── Controllers/                ← HTTP only, không có business logic
    │   │   ├── Middleware/                 ← CorrelationId, GlobalException
    │   │   ├── Extensions/                 ← ServiceCollectionExtensions (DI groups)
    │   │   └── Program.cs
    │   ├── {Name}Service.Application/      ← Business logic
    │   │   ├── Services/                   ← I{Name}Service + implementation
    │   │   ├── DTOs/                       ← {Action}Request / {Action}Response
    │   │   ├── Exceptions/                 ← DomainException subclasses
    │   │   └── Interfaces/                 ← IRepository contracts
    │   ├── {Name}Service.Infrastructure/   ← External I/O
    │   │   ├── Repositories/               ← EF Core implementations
    │   │   ├── Kafka/                      ← Producer / Consumer
    │   │   ├── Redis/                      ← Redis wrappers
    │   │   └── Data/                       ← DbContext, Migrations
    │   └── {Name}Service.Domain/           ← Pure models, zero dependencies
    │       └── Models/
    ├── tests/
    │   ├── {Name}Service.UnitTests/
    │   └── {Name}Service.IntegrationTests/
    └── Dockerfile
```

---

## 2. Boilerplate

### Program.cs

```csharp
var builder = WebApplication.CreateBuilder(args);

// Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "{name}-service")
    .WriteTo.Console(new JsonFormatter())
    .CreateLogger();
builder.Host.UseSerilog();

// DI
builder.Services.AddApplicationServices();
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Health checks — add per-service dependencies
builder.Services.AddHealthChecks()
    .AddNpgsql(builder.Configuration.GetConnectionString("Postgres")!, name: "database")
    .AddRedis(builder.Configuration["Redis:ConnectionString"]!, name: "redis");

var app = builder.Build();

// Middleware pipeline — ORDER MATTERS
app.UseMiddleware<CorrelationIdMiddleware>();   // 1st — inject before logging
app.UseMiddleware<GlobalExceptionMiddleware>(); // 2nd — catch all
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.Run();
```

### appsettings.json (mandatory sections)

```json
{
  "Serilog": {
    "MinimumLevel": { "Default": "Information", "Override": { "Microsoft": "Warning" } }
  },
  "ConnectionStrings": {
    "Postgres": "Host=localhost;Database={name}_db;Username=...;Password=..."
  },
  "Redis": { "ConnectionString": "localhost:6379" },
  "Kafka": {
    "BootstrapServers": "localhost:9092",
    "ConsumerGroupId": "{name}-service-group"
  },
  "ServiceName": "{name}-service",
  "ServiceVersion": "1.0.0"
}
```

### Response Wrapper

```csharp
public class ApiResponse<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public ApiMeta Meta { get; init; } = null!;
    public ApiError? Error { get; init; }

    public static ApiResponse<T> Success(T data, HttpContext ctx, string? cache = null) => new()
    {
        Success = true, Data = data, Meta = ApiMeta.From(ctx, cache), Error = null
    };

    public static ApiResponse<T> Fail(string code, string message, HttpContext ctx) => new()
    {
        Success = false, Data = default, Meta = ApiMeta.From(ctx),
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

### CorrelationId Middleware

```csharp
public class CorrelationIdMiddleware(RequestDelegate next)
{
    private const string Header = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext ctx)
    {
        var id = ctx.Request.Headers[Header].FirstOrDefault() ?? Guid.NewGuid().ToString();
        ctx.Items["CorrelationId"] = id;
        ctx.Response.Headers[Header] = id;
        using (LogContext.PushProperty("CorrelationId", id))
            await next(ctx);
    }
}
```

### Global Exception Middleware

```csharp
public class GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        try { await next(ctx); }
        catch (DomainException ex)
        {
            logger.LogWarning(ex, "Domain exception: {ErrorCode}", ex.ErrorCode);
            ctx.Response.StatusCode = ex.HttpStatusCode;
            await ctx.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(ex.ErrorCode, ex.Message, ctx));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception");
            ctx.Response.StatusCode = 500;
            await ctx.Response.WriteAsJsonAsync(ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.", ctx));
        }
    }
}
```

---

## 3. Patterns

### Repository Pattern

```csharp
// Application/Interfaces/ISongRepository.cs
public interface ISongRepository
{
    Task<Song?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Song>> GetByArtistAsync(Guid artistId, CancellationToken ct);
    Task AddAsync(Song song, CancellationToken ct);
}

// Infrastructure/Repositories/SongRepository.cs
public class SongRepository(AppDbContext db) : ISongRepository
{
    public async Task<Song?> GetByIdAsync(Guid id, CancellationToken ct)
        => await db.Songs.FindAsync([id], ct).ConfigureAwait(false);

    public async Task AddAsync(Song song, CancellationToken ct)
    {
        db.Songs.Add(song);
        await db.SaveChangesAsync(ct).ConfigureAwait(false);
    }
}
```

### Service Layer Pattern

```csharp
// Thin controller — no business logic
[HttpGet("{id}")]
public async Task<IActionResult> GetSong(Guid id, CancellationToken ct)
{
    var result = await _songService.GetSongAsync(id, ct);
    return Ok(ApiResponse<SongResponse>.Success(result, HttpContext));
}

// Application service — owns business logic
public async Task<SongResponse> GetSongAsync(Guid id, CancellationToken ct)
{
    var song = await _repo.GetByIdAsync(id, ct)
        ?? throw new NotFoundException("Song");
    return _mapper.Map<SongResponse>(song);
}
```

### DTO vs Domain Model

```csharp
// Domain model — Infrastructure/Domain only
public class Song { public Guid Id; public string Title; public Guid ArtistId; /* ... */ }

// DTO — never expose domain model directly in API
public record SongResponse(Guid Id, string Title, string ArtistName, int DurationSec);
public record CreateSongRequest(string Title, Guid ArtistId, int DurationSec);
```

### Async/Await Rules

```csharp
// ✅ Always CancellationToken on every public async method
public async Task<T> GetAsync(Guid id, CancellationToken ct) { ... }

// ✅ ConfigureAwait(false) in Infrastructure layer
var result = await _db.FindAsync(id).ConfigureAwait(false);

// ✅ ConfigureAwait omitted in Application/Controllers (ASP.NET Core handles sync context)
var result = await _service.GetAsync(id, ct);

// ❌ Never block
var r = _service.GetAsync().Result;
var r = _service.GetAsync().GetAwaiter().GetResult();

// ❌ Never async void
public async void Handle() { }  // exceptions are swallowed
```

### DI Scopes

```csharp
// ✅ Scoped: Repositories, Services (per-request)
services.AddScoped<ISongService, SongService>();
services.AddScoped<ISongRepository, SongRepository>();

// ✅ Singleton: Redis client, Kafka producer, HttpClientFactory
services.AddSingleton<IConnectionMultiplexer>(_ =>
    ConnectionMultiplexer.Connect(config["Redis:ConnectionString"]!));

// ❌ Never new a dependency inside a class — always inject
```

---

## 4. Error Handling

### Custom Exceptions

```csharp
// Application/Exceptions/DomainException.cs
public abstract class DomainException(string errorCode, string message, int httpStatusCode)
    : Exception(message)
{
    public string ErrorCode { get; } = errorCode;
    public int HttpStatusCode { get; } = httpStatusCode;
}

public class NotFoundException(string resource)
    : DomainException($"{resource.ToUpper()}_NOT_FOUND", $"{resource} not found.", 404);

public class ValidationException(string message)
    : DomainException("VALIDATION_ERROR", message, 400);

public class ConflictException(string code, string message)
    : DomainException(code, message, 409);

public class UnauthorizedException(string code = "UNAUTHORIZED", string message = "Unauthorized.")
    : DomainException(code, message, 401);

public class ForbiddenException(string code = "FORBIDDEN", string message = "Access denied.")
    : DomainException(code, message, 403);

public class IdempotencyConflictException()
    : DomainException("IDEMPOTENCY_CONFLICT", "Duplicate request detected.", 409);
```

### HTTP Status Map

| Exception | Status | Error Code |
|---|---|---|
| `NotFoundException` | 404 | `{RESOURCE}_NOT_FOUND` |
| `ValidationException` | 400 | `VALIDATION_ERROR` |
| `ConflictException` | 409 | custom |
| `UnauthorizedException` | 401 | `UNAUTHORIZED` |
| `ForbiddenException` | 403 | `FORBIDDEN` |
| `IdempotencyConflictException` | 409 | `IDEMPOTENCY_CONFLICT` |
| Unhandled `Exception` | 500 | `INTERNAL_ERROR` |

---

## 5. Redis Integration

### Setup

```csharp
// Extensions/ServiceCollectionExtensions.cs
services.AddSingleton<IConnectionMultiplexer>(_ =>
    ConnectionMultiplexer.Connect(config["Redis:ConnectionString"]!));
services.AddSingleton<IRedisCache, RedisCache>();
```

### Cache-Aside Pattern

```csharp
// Infrastructure/Redis/RedisCache.cs
public class RedisCache(IConnectionMultiplexer redis, ILogger<RedisCache> logger) : IRedisCache
{
    private readonly IDatabase _db = redis.GetDatabase();

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        var value = await _db.StringGetAsync(key).ConfigureAwait(false);
        if (value.IsNullOrEmpty) return default;
        return JsonSerializer.Deserialize<T>(value!);
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(value);
        await _db.StringSetAsync(key, json, ttl).ConfigureAwait(false);
    }

    public async Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan ttl)
        => await _db.StringSetAsync(key, value, ttl, When.NotExists).ConfigureAwait(false);

    public async Task DeleteAsync(string key)
        => await _db.KeyDeleteAsync(key).ConfigureAwait(false);
}

// Usage in service — cache-aside
public async Task<SongResponse> GetSongAsync(Guid id, CancellationToken ct)
{
    var cacheKey = $"music:cache:{id}";  // follow REDIS_KEY_DESIGN.md
    var cached = await _cache.GetAsync<SongResponse>(cacheKey, ct);
    if (cached is not null)
        return cached with { /* set cache = "HIT" via ctx */ };

    var song = await _repo.GetByIdAsync(id, ct) ?? throw new NotFoundException("Song");
    var response = _mapper.Map<SongResponse>(song);
    await _cache.SetAsync(cacheKey, response, TimeSpan.FromMinutes(15), ct);
    return response;
}
```

### Key Naming Rules (từ `.github/REDIS_KEY_DESIGN.md`)

```
{service}:{entity}:{identifier}[:{sub-key}]
```

- Prefix phải khớp bảng registry: `auth`, `gateway`, `user`, `rec`, `analytics`, `party`, `search`, `stream`, `music`
- **Không bao giờ** đặt PII (email, tên) trong key — dùng UUID hoặc SHA-256 hash
- **Mọi key phải có TTL** — không có TTL = memory leak
- Tham chiếu bảng TTL trong `REDIS_KEY_DESIGN.md` để lấy đúng TTL cho từng loại key
- Không dùng `KEYS *` — dùng `SCAN` với cursor

---

## 6. Kafka Producer

### Setup

```csharp
// Infrastructure/Kafka/KafkaProducer.cs
public class KafkaProducer : IKafkaProducer, IDisposable
{
    private readonly IProducer<string, string> _producer;
    private readonly ILogger<KafkaProducer> _logger;
    private readonly string _localFallbackPath;

    public KafkaProducer(IConfiguration config, ILogger<KafkaProducer> logger)
    {
        _logger = logger;
        _localFallbackPath = config["Kafka:LocalFallbackPath"] ?? "/tmp/kafka-fallback";
        var producerConfig = new ProducerConfig
        {
            BootstrapServers = config["Kafka:BootstrapServers"],
            EnableIdempotence = true,           // exactly-once producer-side
            Acks = Acks.All,
            MessageSendMaxRetries = 3,
            RetryBackoffMs = 1000
        };
        _producer = new ProducerBuilder<string, string>(producerConfig).Build();
    }

    public async Task PublishAsync<T>(string topic, T @event, CancellationToken ct)
        where T : IKafkaEvent
    {
        var json = JsonSerializer.Serialize(@event);
        var message = new Message<string, string>
        {
            Key = @event.EventId,
            Value = json,
            Headers = new Headers
            {
                { "correlation_id", Encoding.UTF8.GetBytes(@event.CorrelationId) },
                { "version", Encoding.UTF8.GetBytes(@event.Version) }
            }
        };
        try
        {
            await _producer.ProduceAsync(topic, message, ct);
            _logger.LogInformation("Kafka published. Topic={Topic} EventId={EventId}", topic, @event.EventId);
        }
        catch (ProduceException<string, string> ex)
        {
            _logger.LogError(ex, "Kafka publish failed. Topic={Topic} EventId={EventId} — writing to local fallback", topic, @event.EventId);
            await WriteFallbackAsync(topic, json);
        }
    }

    private async Task WriteFallbackAsync(string topic, string json)
    {
        Directory.CreateDirectory(_localFallbackPath);
        var file = Path.Combine(_localFallbackPath, $"{topic}_{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid()}.json");
        await File.WriteAllTextAsync(file, json);
    }

    public void Dispose() => _producer.Dispose();
}
```

### Event Interface

```csharp
public interface IKafkaEvent
{
    string EventId { get; }      // UUID v4 — fresh per publish
    string Version { get; }      // "v1"
    string CorrelationId { get; }
}

// Example: SongPlayedEvent (matches kafka-schemas/song_played.v1.json)
public record SongPlayedEvent(
    string EventId, string Version, string Timestamp, string CorrelationId,
    string UserId, string SongId, string ArtistId, string GenreId,
    int DurationSec, int ListenedSec, double DurationPercent,
    string Platform, string? Context = null
) : IKafkaEvent;
```

**Rules:**
- `EventId` phải là UUID v4 mới mỗi lần publish — không tái sử dụng
- Không đưa PII vào event — chỉ UUID
- Validate event fields khớp với JSON Schema trong `docs/contracts/kafka-schemas/`
- Publish SAU khi action đã hoàn thành (ví dụ: sau khi analytics play event nhận từ client)

---

## 7. Kafka Consumer

### Setup với Idempotency + DLQ

```csharp
public class SongPlayedConsumer(
    IConsumer<string, string> consumer,
    IRedisCache cache,
    ILogger<SongPlayedConsumer> logger) : BackgroundService
{
    private const string Topic = "Song_Played";
    private const string DlqTopic = "Song_Played.DLQ";
    private const int MAX_RETRIES = 3;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        consumer.Subscribe(Topic);
        while (!ct.IsCancellationRequested)
        {
            ConsumeResult<string, string>? result = null;
            try
            {
                result = consumer.Consume(ct);
                var eventId = result.Message.Key;

                // 1. Idempotency check — TRƯỚC khi xử lý
                var idempotencyKey = $"analytics:idempotency:{eventId}";
                var isNew = await cache.SetIfNotExistsAsync(idempotencyKey, "1", TimeSpan.FromHours(24));
                if (!isNew)
                {
                    logger.LogWarning("Duplicate event skipped. EventId={EventId}", eventId);
                    consumer.Commit(result);  // commit duplicate vẫn phải commit
                    continue;
                }

                // 2. Process với retry + exponential backoff
                await ProcessWithRetryAsync(result.Message.Value, eventId, ct);

                // 3. Commit offset CHỈ sau khi xử lý thành công
                consumer.Commit(result);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Consumer loop error");
                if (result is not null)
                    await SendToDlqAsync(result.Message, ex);
            }
        }
    }

    private async Task ProcessWithRetryAsync(string json, string eventId, CancellationToken ct)
    {
        var attempt = 0;
        while (true)
        {
            try
            {
                var @event = JsonSerializer.Deserialize<SongPlayedEvent>(json)!;
                await HandleEventAsync(@event, ct);
                return;
            }
            catch (Exception ex) when (attempt < MAX_RETRIES)
            {
                attempt++;
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt - 1)); // 1s → 2s → 4s
                logger.LogWarning(ex, "Event processing failed. Attempt={Attempt} EventId={EventId} Retrying in {Delay}s",
                    attempt, eventId, delay.TotalSeconds);
                await Task.Delay(delay, ct);
            }
        }
        // Reached only after 3 failures — caller sends to DLQ
    }

    private async Task SendToDlqAsync(Message<string, string> original, Exception ex)
    {
        // Publish to DLQ topic with original message + error metadata
        logger.LogError(ex, "Sending to DLQ. EventId={EventId}", original.Key);
        // Use _producer.ProduceAsync(DlqTopic, ...)
    }
}
```

### Consumer Registration

```csharp
// Extensions/ServiceCollectionExtensions.cs
services.AddSingleton<IConsumer<string, string>>(_ =>
{
    var config = new ConsumerConfig
    {
        BootstrapServers = appConfig["Kafka:BootstrapServers"],
        GroupId = appConfig["Kafka:ConsumerGroupId"],   // "{name}-service-group"
        AutoOffsetReset = AutoOffsetReset.Earliest,
        EnableAutoCommit = false    // PHẢI false — manual commit sau xử lý
    };
    return new ConsumerBuilder<string, string>(config).Build();
});
services.AddHostedService<SongPlayedConsumer>();
```

**Rules:**
- `EnableAutoCommit = false` — luôn luôn
- Commit offset CHỈ sau khi xử lý thành công
- Idempotency key prefix phải đúng theo `REDIS_KEY_DESIGN.md` (ví dụ: `analytics:idempotency:`, `rec:idempotency:`)
- DLQ topic = `{OriginalTopic}.DLQ`
- Retry 3 lần với Exponential Backoff: 1s → 2s → 4s

---

## 8. Circuit Breaker (Polly)

```csharp
// Extensions/ServiceCollectionExtensions.cs
services.AddHttpClient<IMusicServiceClient, MusicServiceClient>(client =>
    client.BaseAddress = new Uri(config["Services:MusicService"]!))
    .AddPolicyHandler((sp, _) =>
    {
        var logger = sp.GetRequiredService<ILogger<MusicServiceClient>>();
        return Policy<HttpResponseMessage>
            .Handle<HttpRequestException>()
            .Or<TimeoutRejectedException>()
            .CircuitBreakerAsync(
                handledEventsAllowedBeforeBreaking: 3,
                durationOfBreak: TimeSpan.FromSeconds(30),
                onBreak: (ex, ts) =>
                    logger.LogWarning("Circuit OPEN for {Duration}s. Reason={Reason}", ts.TotalSeconds, ex.Exception?.Message),
                onReset: () => logger.LogInformation("Circuit CLOSED — downstream recovered"),
                onHalfOpen: () => logger.LogInformation("Circuit HALF-OPEN — probing downstream")
            );
    })
    .AddPolicyHandler(Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromSeconds(2)));
```

### Fallback khi circuit open

```csharp
public async Task<IReadOnlyList<SongResponse>> GetSongsAsync(CancellationToken ct)
{
    try { return await _httpClient.GetSongsAsync(ct); }
    catch (BrokenCircuitException)
    {
        _logger.LogWarning("Circuit open — returning cached fallback");
        var cached = await _cache.GetAsync<List<SongResponse>>("music:cache:fallback", ct);
        return cached ?? [];  // empty list với meta.warning nếu cần
    }
}
```

**Fallback map (từ CODING_CONVENTIONS.md):**

| Downstream down | Fallback |
|---|---|
| Music Service | Redis cache → empty list + `meta.warning: "degraded"` |
| Auth Service | Cached public key cho offline JWT verify |
| Recommendation Service | Top 50 Trending từ `rec:trending:global` |

---

## 9. Logging

### Setup (Program.cs)

```csharp
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "{name}-service")
    .WriteTo.Console(new JsonFormatter())
    .CreateLogger();
builder.Host.UseSerilog();
```

### Usage

```csharp
// ✅ Structured logging — named properties, not string interpolation
_logger.LogInformation("User login successful. UserId={UserId} DurationMs={DurationMs}", userId, elapsedMs);

// ✅ Push correlationId vào log scope (đã inject bởi CorrelationIdMiddleware)
using (LogContext.PushProperty("CorrelationId", correlationId))
    _logger.LogInformation("Processing event. EventId={EventId}", eventId);

// ❌ Không log PII
_logger.LogInformation("User {Email} logged in", user.Email);   // ❌ email là PII
_logger.LogInformation("Token: {Token}", accessToken);           // ❌ token là secret

// ❌ Không dùng string interpolation trong log
_logger.LogInformation($"User {userId} logged in");  // ❌ — mất structured logging
```

### Mandatory Log Fields

| Field | Notes |
|---|---|
| `timestamp` | ISO8601 UTC — Serilog tự inject |
| `level` | INFO / WARN / ERROR |
| `service` | Constant từ `Enrich.WithProperty` |
| `CorrelationId` | Từ `LogContext.PushProperty` trong middleware |
| `message` | Human-readable |
| `UserId` | UUID only — khi available, không bao giờ email |
| `DurationMs` | Trên mọi completed operation |

**Levels:** INFO = normal flow, WARN = business rule violation, ERROR = unexpected failure.

---

## 10. Test Structure

### Project Setup

```xml
<!-- {Name}Service.UnitTests.csproj -->
<PackageReference Include="xunit" Version="2.*" />
<PackageReference Include="Moq" Version="4.*" />
<PackageReference Include="FluentAssertions" Version="6.*" />
<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="9.*" />
```

### Unit Test Convention

```csharp
public class SongServiceTests
{
    private readonly Mock<ISongRepository> _repoMock = new();
    private readonly Mock<IRedisCache> _cacheMock = new();
    private readonly SongService _sut;

    public SongServiceTests()
        => _sut = new SongService(_repoMock.Object, _cacheMock.Object, NullLogger<SongService>.Instance);

    [Fact]
    public async Task GetSongAsync_WhenNotFound_ThrowsNotFoundException()
    {
        // Arrange
        _repoMock.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Song?)null);

        // Act
        var act = () => _sut.GetSongAsync(Guid.NewGuid(), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Song*");
    }

    [Fact]
    public async Task GetSongAsync_WhenCacheHit_SkipsRepository()
    {
        var cached = new SongResponse(Guid.NewGuid(), "Title", "Artist", 200);
        _cacheMock.Setup(c => c.GetAsync<SongResponse>(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(cached);

        var result = await _sut.GetSongAsync(Guid.NewGuid(), CancellationToken.None);

        result.Should().BeEquivalentTo(cached);
        _repoMock.Verify(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
```

### Integration Test Convention

```csharp
public class SongsIntegrationTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client = factory.WithWebHostBuilder(builder =>
    {
        builder.ConfigureServices(services =>
        {
            // Replace real Redis with in-memory mock
            services.RemoveAll<IRedisCache>();
            services.AddSingleton<IRedisCache, NullRedisCache>();

            // Replace real DB with in-memory
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(o => o.UseInMemoryDatabase("test"));
        });
    }).CreateClient();

    [Fact]
    public async Task GET_songs_id_Returns200_WhenExists()
    {
        var response = await _client.GetAsync($"/api/v1/songs/{Guid.NewGuid()}");
        // seed data first, then assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<SongResponse>>();
        body!.Success.Should().BeTrue();
    }
}
```

### Mocking Redis

```csharp
// NullRedisCache — for integration tests
public class NullRedisCache : IRedisCache
{
    public Task<T?> GetAsync<T>(string key, CancellationToken ct = default) => Task.FromResult<T?>(default);
    public Task SetAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct = default) => Task.CompletedTask;
    public Task<bool> SetIfNotExistsAsync(string key, string value, TimeSpan ttl) => Task.FromResult(true);
    public Task DeleteAsync(string key) => Task.CompletedTask;
}
```

### Mocking Kafka

```csharp
// Mock IKafkaProducer for unit tests
var kafkaMock = new Mock<IKafkaProducer>();
kafkaMock.Setup(k => k.PublishAsync(It.IsAny<string>(), It.IsAny<IKafkaEvent>(), It.IsAny<CancellationToken>()))
    .Returns(Task.CompletedTask);
// Verify published
kafkaMock.Verify(k => k.PublishAsync("Song_Played", It.Is<SongPlayedEvent>(e => e.SongId == expectedId.ToString()), It.IsAny<CancellationToken>()), Times.Once);
```

---

## ✅ Pre-output Checklist

Trước khi output code, Claude tự kiểm tra:

**Structure**
- [ ] Service có đủ 4 projects: Api / Application / Infrastructure / Domain?
- [ ] Controllers không chứa business logic?
- [ ] Domain models không import Infrastructure dependencies?

**Boilerplate**
- [ ] `CorrelationIdMiddleware` đăng ký TRƯỚC `GlobalExceptionMiddleware` trong pipeline?
- [ ] `/health` endpoint được map với `UIResponseWriter`?
- [ ] Tất cả responses wrap trong `ApiResponse<T>`?

**Async**
- [ ] Mọi public async method có `CancellationToken ct` parameter?
- [ ] Infrastructure layer dùng `ConfigureAwait(false)`?
- [ ] Không có `.Result` hoặc `.Wait()` ở bất kỳ đâu?

**Redis**
- [ ] Key naming đúng pattern `{service}:{entity}:{identifier}` từ `REDIS_KEY_DESIGN.md`?
- [ ] Mọi key có TTL tường minh?
- [ ] Không có PII trong key names?
- [ ] Không dùng `KEYS *` — chỉ `SCAN`?

**Kafka Producer**
- [ ] `EventId` là UUID v4 fresh mỗi lần publish?
- [ ] Không có PII trong event payload?
- [ ] Local disk fallback khi Kafka down?
- [ ] Event fields khớp JSON Schema trong `docs/contracts/kafka-schemas/`?

**Kafka Consumer**
- [ ] `EnableAutoCommit = false`?
- [ ] Idempotency check (`SETNX`) TRƯỚC khi xử lý?
- [ ] Commit offset CHỈ sau khi xử lý thành công?
- [ ] DLQ sau 3 retries với Exponential Backoff (1s → 2s → 4s)?

**Error Handling**
- [ ] Không catch exceptions trong Controllers?
- [ ] `GlobalExceptionMiddleware` xử lý tất cả `DomainException` và `Exception`?
- [ ] Error response đúng format `{ success: false, data: null, meta: {...}, error: {code, message} }`?

**Logging**
- [ ] Không log email, password, token, PII?
- [ ] Dùng named parameters, không string interpolation?
- [ ] `CorrelationId` được push vào `LogContext`?
- [ ] `DurationMs` có trên mọi completed operation?

**Tests**
- [ ] Arrange/Act/Assert tách biệt rõ ràng?
- [ ] Integration tests replace real Redis và real DB?
- [ ] Test method name: `{Method}_When{Condition}_Then{Expected}`?
