# SKILL: microservice-api

> Claude đọc file này mỗi khi implement bất kỳ API endpoint nào, bất kể C# hay Python.
> Dạng reference card — bảng + checklist, không phải tutorial.

---

## 1. Response Format (bắt buộc mọi endpoint)

### Success

```json
{
  "success": true,
  "data": { "...": "..." },
  "meta": {
    "apiVersion": "v1",
    "requestId": "<correlationId>",
    "timestamp": "2026-05-01T08:00:00.000Z",
    "cache": "HIT"
  },
  "error": null
}
```

### Error

```json
{
  "success": false,
  "data": null,
  "meta": {
    "apiVersion": "v1",
    "requestId": "<correlationId>",
    "timestamp": "2026-05-01T08:00:00.000Z"
  },
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

### C# — ApiResponse\<T\>

```csharp
// Đã định nghĩa đầy đủ trong SKILL.md aspnet-service — dùng lại, không định nghĩa lại
return Ok(ApiResponse<LoginResponse>.Success(result, HttpContext));
return StatusCode(400, ApiResponse<object>.Fail("AUTH_INVALID_CREDENTIALS", "Invalid email or password.", HttpContext));
```

### Python — FastAPI

```python
# Đã định nghĩa đầy đủ trong SKILL.md fastapi-service — dùng lại, không định nghĩa lại
return ApiResponse.ok(data=result, request_id=request.state.correlation_id, cache="HIT")

# Error — via exception handler (không return error trực tiếp trong handler)
raise ValidationException("Genre list must contain at least 3 items.")
```

**Rules:**
- `meta.requestId` = giá trị `X-Correlation-Id` của request (không phải UUID mới random)
- `meta.cache` chỉ có khi response đến từ cache (`"HIT"` hoặc `"MISS"`) — bỏ qua với non-cached endpoints
- `data` là `null` khi `success: false` — không bao giờ có cả `data` lẫn `error`
- Không bao giờ expose stack trace trong `error.message` ở production

---

## 2. Latency Budget

> Khi implement endpoint, phải đặt timeout tương ứng. Nếu downstream call vượt budget → trả fallback.

| Endpoint | Method | Budget | Ghi chú |
|---|---|---|---|
| `POST /api/v1/auth/login` | POST | **500ms** | p95 target |
| `POST /api/v1/auth/refresh` | POST | **200ms** | Redis blacklist check |
| `POST /api/v1/auth/logout` | POST | **150ms** | |
| `GET /api/v1/users/me` | GET | **300ms** | Redis cache TTL 15m |
| `POST /api/v1/users/me/preferences` | POST | **400ms** | Kafka publish async |
| `GET /api/v1/recommendations` | GET | **300ms** | Rule Engine timeout → fallback trending |
| `POST /api/v1/recommendations/feedback` | POST | **100ms** | Return 202 ngay — async |
| `GET /api/v1/streaming/{songId}/url` | GET | **150ms** | S3 timeout 1s → retry max 3 |
| `GET /api/v1/streaming/{songId}/chunk` | GET | **1000ms** | First chunk time-to-byte |
| `POST /api/v1/analytics/events/play` | POST | **50ms** | Return 202 ngay — async |
| `GET /api/v1/analytics/creator/heatmap/{songId}` | GET | **500ms** | |
| `GET /api/v1/analytics/creator/stats/{songId}` | GET | **500ms** | |
| `POST /api/v1/music/songs` | POST | **5000ms** | File upload — different SLO |
| `GET /api/v1/music/songs/{songId}` | GET | **200ms** | Redis cache TTL 30m |
| `GET /api/v1/search` | GET | **200ms** | Elasticsearch; empty `[]` on timeout |
| `GET /api/v1/notifications/unread` | GET | **150ms** | |
| `PATCH /api/v1/notifications/{id}/read` | PATCH | **150ms** | |
| `PATCH /api/v1/notifications/read-all` | PATCH | **200ms** | |
| `POST /api/v1/parties` | POST | **200ms** | Redis ephemeral |
| `POST /api/v1/parties/{joinCode}/join` | POST | **150ms** | |
| `WS /ws/v1/parties/{roomId}` | WS | **500ms** | sync latency |
| gRPC `ValidateToken` | gRPC | **100ms** | Circuit Breaker sau 3 lần lỗi |
| gRPC `GetUserProfile` | gRPC | **100ms** | Fallback Redis cache |

**Enforcement pattern:**

```csharp
// C# — HttpClient timeout per downstream call
services.AddHttpClient<IMusicServiceClient>()
    .AddPolicyHandler(Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromSeconds(2)));
```

```python
# Python — asyncio.wait_for cho Rule Engine
result = await asyncio.wait_for(
    rule_engine.compute(user_id, context),
    timeout=0.3   # 300ms
)
```

---

## 3. Idempotency Pattern

### Khi nào bắt buộc

Tất cả **POST/PATCH mutating** operations. Xem bảng:

| Endpoint | Header bắt buộc |
|---|---|
| `POST /api/v1/users/me/preferences` | `Idempotency-Key: <UUID>` |
| `POST /api/v1/recommendations/feedback` | `Idempotency-Key: <UUID>` |
| `POST /api/v1/analytics/events/play` | `Idempotency-Key: <UUID>` |
| `POST /api/v1/music/songs` | `Idempotency-Key: <UUID>` |
| `PATCH /api/v1/notifications/{id}/read` | `Idempotency-Key: <UUID>` |
| `PATCH /api/v1/notifications/read-all` | `Idempotency-Key: <UUID>` |
| `POST /api/v1/parties` | `Idempotency-Key: <UUID>` |

**Không bắt buộc:** GET, login, logout, refresh, party join.

### Implementation — C#

```csharp
// Application/Services/IdempotencyService.cs
public class IdempotencyService(IDatabase redis)
{
    private const int TTL_HOURS = 24;

    // Returns true nếu request là MỚI. False = duplicate → trả 409.
    public async Task<bool> IsNewRequestAsync(string idempotencyKey)
    {
        var key = $"idempotency:{idempotencyKey}";    // prefix theo service namespace
        return await redis.StringSetAsync(key, "1", TimeSpan.FromHours(TTL_HOURS), When.NotExists)
                          .ConfigureAwait(false);
    }
}

// Controller
[HttpPost("preferences")]
public async Task<IActionResult> SavePreferences(
    [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
    [FromBody] SavePreferencesRequest request,
    CancellationToken ct)
{
    if (string.IsNullOrEmpty(idempotencyKey))
        return BadRequest(ApiResponse<object>.Fail("VALIDATION_ERROR", "Idempotency-Key header is required.", HttpContext));

    var isNew = await _idempotencyService.IsNewRequestAsync(idempotencyKey);
    if (!isNew)
        return Conflict(ApiResponse<object>.Fail("IDEMPOTENCY_CONFLICT", "Duplicate request detected.", HttpContext));

    var result = await _userService.SavePreferencesAsync(request, ct);
    return Ok(ApiResponse<bool>.Success(true, HttpContext));
}
```

### Implementation — Python

```python
# Trong route handler
@router.post("/feedback", status_code=202)
async def post_feedback(
    request: Request,
    body: FeedbackRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    repo: RedisRepository = Depends(get_redis_repo),
):
    is_new = await repo.check_and_set_idempotency(
        key=f"rec:idempotency:{idempotency_key}",   # namespace theo service
        ttl=86400
    )
    if not is_new:
        raise IdempotencyConflictException()

    # process async...
    return ApiResponse.ok(data=True, request_id=request.state.correlation_id)

# Repository helper
async def check_and_set_idempotency(self, key: str, ttl: int) -> bool:
    result = await self._r.set(key, "1", ex=ttl, nx=True)
    return result is not None   # True = mới, False = duplicate
```

**Rules:**
- Redis key prefix phải đúng namespace: `rec:idempotency:`, `analytics:idempotency:`, `user:idempotency:`... (theo `REDIS_KEY_DESIGN.md`)
- TTL luôn là **24h (86400s)**
- `SET key 1 EX 86400 NX` — atomic, không race condition
- Thiếu header `Idempotency-Key` → trả `400 VALIDATION_ERROR`, không phải `409`

---

## 4. Rate Limiting

### Limits theo endpoint

| Endpoint | Limit | Scope |
|---|---|---|
| `POST /api/v1/auth/login` | 10/min | IP + User |
| `POST /api/v1/auth/refresh` | 20/min | IP + User |
| `GET /api/v1/users/me` | 100/min | Token (userId) |
| `GET /api/v1/recommendations` | 60/min | Token |
| `GET /api/v1/streaming/{songId}/url` | 120/min | Token |
| `GET /api/v1/streaming/{songId}/chunk` | 120/min | Token |
| `GET /api/v1/analytics/creator/heatmap/{songId}` | 30/min | Token |
| `GET /api/v1/analytics/creator/stats/{songId}` | 30/min | Token |
| `GET /api/v1/search` | 60/min | Token |
| `GET /api/v1/notifications/unread` | 60/min | Token |
| `POST /api/v1/parties/{joinCode}/join` | 30/min | Token |

### Redis Counter Pattern (API Gateway thực thi)

```csharp
// API Gateway thực hiện rate limit — services không tự implement
// Key pattern: gateway:ratelimit:token:{userId} hoặc gateway:ratelimit:ip:{ip}
// TTL: 60s, counter với SET NX + INCR

// Response khi vượt limit:
// HTTP 429
// Header: X-RateLimit-Remaining: 0
{
  "success": false,
  "data": null,
  "meta": { "apiVersion": "v1", "requestId": "...", "timestamp": "..." },
  "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Please slow down." }
}
```

**Rule:** Rate limit do API Gateway xử lý tập trung. Các services backend không tự implement rate limit — chỉ trả đúng error code nếu cần mock.

---

## 5. Error Codes Catalogue

### AUTH Service

| Code | HTTP | Khi nào |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 400 | Sai email hoặc password |
| `ACCOUNT_LOCKED` | 423 | ≥ 5 lần sai → lock 15 phút |
| `TOKEN_REUSED` | 403 | Refresh token dùng lại → revoke all sessions |
| `TOKEN_EXPIRED` | 401 | Access token hết hạn (không thể refresh) |
| `UNAUTHORIZED` | 401 | Không có JWT hoặc JWT invalid |

### USER Service

| Code | HTTP | Khi nào |
|---|---|---|
| `USER_NOT_FOUND` | 404 | userId không tồn tại |
| `VALIDATION_ERROR` | 400 | Thiếu field, sai format, min 3 genres vi phạm |
| `IDEMPOTENCY_CONFLICT` | 409 | Duplicate Idempotency-Key trong 24h |
| `UNAUTHORIZED` | 401 | JWT thiếu hoặc invalid |

### RECOMMENDATION Service

| Code | HTTP | Khi nào |
|---|---|---|
| `VALIDATION_ERROR` | 400 | context không hợp lệ, limit ngoài 1–50 |
| `UNAUTHORIZED` | 401 | |
| `IDEMPOTENCY_CONFLICT` | 409 | Duplicate feedback event |
| `RATE_LIMIT_EXCEEDED` | 429 | Vượt 60 req/min |
| `SERVICE_UNAVAILABLE` | 503 | Rule Engine timeout + trending fallback cũng fail |

### STREAMING Service

| Code | HTTP | Khi nào |
|---|---|---|
| `SONG_NOT_FOUND` | 404 | songId không tồn tại hoặc chưa published |
| `FORBIDDEN` | 403 | User không có quyền nghe (future: premium) |
| `UNAUTHORIZED` | 401 | |
| `RATE_LIMIT_EXCEEDED` | 429 | Vượt 120 req/min |

### ANALYTICS Service

| Code | HTTP | Khi nào |
|---|---|---|
| `VALIDATION_ERROR` | 400 | |
| `UNAUTHORIZED` | 401 | |
| `FORBIDDEN` | 403 | Creator xem heatmap của người khác |
| `SONG_NOT_FOUND` | 404 | |
| `IDEMPOTENCY_CONFLICT` | 409 | |

### MUSIC Service

| Code | HTTP | Khi nào |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Sai format file, field thiếu |
| `PAYLOAD_TOO_LARGE` | 413 | File > 50MB |
| `FORBIDDEN` | 403 | Listener cố upload (Creator only) |
| `UNAUTHORIZED` | 401 | |
| `IDEMPOTENCY_CONFLICT` | 409 | |
| `SONG_NOT_FOUND` | 404 | GET song không tồn tại |

### SEARCH Service

| Code | HTTP | Khi nào |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `q` rỗng |
| `UNAUTHORIZED` | 401 | |
| `RATE_LIMIT_EXCEEDED` | 429 | |
| *(timeout)* | 200 | Trả `[]` — không expose timeout error |

### NOTIFICATION Service

| Code | HTTP | Khi nào |
|---|---|---|
| `NOTIFICATION_NOT_FOUND` | 404 | notificationId không tồn tại |
| `UNAUTHORIZED` | 401 | |
| `IDEMPOTENCY_CONFLICT` | 409 | |
| `VALIDATION_ERROR` | 400 | |

### PARTY Service

| Code | HTTP | Khi nào |
|---|---|---|
| `ROOM_NOT_FOUND` | 404 | joinCode không tồn tại hoặc expired |
| `VALIDATION_ERROR` | 400 | |
| `UNAUTHORIZED` | 401 | |
| `IDEMPOTENCY_CONFLICT` | 409 | |
| `RATE_LIMIT_EXCEEDED` | 429 | Join vượt 30 req/min |

### WebSocket Codes

| Code | Khi nào |
|---|---|
| `1008 POLICY_VIOLATION` | JWT invalid khi handshake WS |
| `1011 INTERNAL_ERROR` | Server error trong WS handler |
| `1001 GOING_AWAY` | Server shutdown gracefully |

### Chung

| Code | HTTP | Khi nào |
|---|---|---|
| `INTERNAL_ERROR` | 500 | Unhandled exception — generic, không expose details |
| `RATE_LIMIT_EXCEEDED` | 429 | Bất kỳ endpoint nào vượt limit |

---

## 6. Pagination Convention

**Chỉ dùng cursor pagination — không dùng offset/page.**

### Request

```
GET /api/v1/recommendations?context=morning&limit=10&cursor=abc123
GET /api/v1/notifications/unread?limit=20&cursor=notif123
GET /api/v1/search?q=son+tung&type=all&limit=10&cursor=idx1
```

### Response — meta.pagination

```json
{
  "success": true,
  "data": [ "..." ],
  "meta": {
    "apiVersion": "v1",
    "requestId": "uuid",
    "timestamp": "ISO8601",
    "cache": "HIT",
    "pagination": {
      "nextCursor": "xyz456",
      "hasMore": true
    }
  },
  "error": null
}
```

### C# Implementation

```csharp
public record CursorPage<T>(IReadOnlyList<T> Items, string? NextCursor, bool HasMore);

// Controller
[HttpGet]
public async Task<IActionResult> GetNotifications(
    [FromQuery] string? cursor,
    [FromQuery] int limit = 20,
    CancellationToken ct = default)
{
    var page = await _notificationService.GetUnreadAsync(cursor, limit + 1, ct);
    var hasMore = page.Count > limit;
    var items = hasMore ? page.Take(limit).ToList() : page;
    var nextCursor = hasMore ? items.Last().NotificationId : null;

    var meta = ApiMeta.From(HttpContext);
    meta = meta with { Pagination = new ApiPagination(nextCursor, hasMore) };
    return Ok(new ApiResponse<IReadOnlyList<NotificationResponse>>
    {
        Success = true,
        Data = items.Select(_mapper.Map<NotificationResponse>).ToList(),
        Meta = meta,
        Error = null
    });
}
```

### Python Implementation

```python
@router.get("", response_model=ApiResponse)
async def get_recommendations(
    request: Request,
    context: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
    cursor: str | None = Query(None),
    service: RecommendationService = Depends(get_recommendation_service),
):
    items, next_cursor, has_more = await service.get_paginated(
        user_id=request.state.user_id,
        context=context,
        limit=limit,
        cursor=cursor,
    )
    return ApiResponse.ok(
        data=items,
        request_id=request.state.correlation_id,
        pagination={"nextCursor": next_cursor, "hasMore": has_more},
    )
```

**Rules:**
- `cursor` là **opaque string** (ID, base64, timestamp) — client không interpret
- Khi `hasMore: false` thì `nextCursor` là `null`
- Không bao giờ dùng `page=1&page_size=10` — vi phạm convention
- `limit` max: 50 (recommendations), 20 (notifications), 10 (search default)

---

## 7. RBAC Enforcement

### 3 Roles

| Role | Quyền |
|---|---|
| `Listener` | Nghe nhạc, tạo party, xem notifications, đọc search/song |
| `Creator` | Tất cả Listener + upload nhạc + xem analytics của chính mình |
| `Admin` | Tất cả + xem analytics của bất kỳ ai |

### Endpoint → Role restriction

| Endpoint | Restriction |
|---|---|
| `POST /api/v1/music/songs` | `Creator` only |
| `GET /api/v1/analytics/creator/heatmap/{songId}` | `Creator` (own song) hoặc `Admin` |
| `GET /api/v1/analytics/creator/stats/{songId}` | `Creator` (own song) hoặc `Admin` |
| Tất cả endpoints còn lại | `Listener`, `Creator`, `Admin` đều được |

### C# — Policy-Based Authorization

```csharp
// Program.cs
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("CreatorOnly", policy =>
        policy.RequireClaim("role", "Creator", "Admin"));

    options.AddPolicy("AnalyticsAccess", policy =>
        policy.RequireAssertion(ctx =>
            ctx.User.HasClaim("role", "Admin") ||
            ctx.User.HasClaim("role", "Creator")));
});

// Controller
[HttpPost]
[Authorize(Policy = "CreatorOnly")]
public async Task<IActionResult> UploadSong(...) { ... }

[HttpGet("heatmap/{songId}")]
[Authorize(Policy = "AnalyticsAccess")]
public async Task<IActionResult> GetHeatmap(Guid songId, ...)
{
    // Creator: thêm check ownership
    var userId = User.FindFirstValue("sub")!;
    var role = User.FindFirstValue("role")!;
    if (role == "Creator")
    {
        var owns = await _musicService.IsSongOwnerAsync(songId, Guid.Parse(userId), ct);
        if (!owns) return StatusCode(403, ApiResponse<object>.Fail("FORBIDDEN", "Access denied.", HttpContext));
    }
    // ...
}
```

### Python — FastAPI Dependency

```python
# core/dependencies.py
from fastapi import Header, HTTPException, Depends
from typing import Literal

Role = Literal["Listener", "Creator", "Admin"]

def get_current_user(authorization: str = Header(...)) -> dict:
    # Validate JWT và extract claims
    # ...
    return {"user_id": "uuid", "role": "Listener"}

def require_role(*allowed_roles: Role):
    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in allowed_roles:
            raise ForbiddenException()
        return user
    return dependency

# Route — Creator only
@router.post("/songs")
async def upload_song(
    user: dict = Depends(require_role("Creator", "Admin")),
    ...
): ...

# Route — Creator owns song OR Admin
@router.get("/creator/heatmap/{song_id}")
async def get_heatmap(
    song_id: str,
    user: dict = Depends(require_role("Creator", "Admin")),
    service: AnalyticsService = Depends(...),
):
    if user["role"] == "Creator":
        owns = await service.is_song_owner(song_id, user["user_id"])
        if not owns:
            raise ForbiddenException()
    ...
```

---

## 8. CorrelationId Propagation

### Extract / Generate (mọi service)

```
Header in:  X-Correlation-Id: <uuid>  →  extract nếu có
            (không có)                →  generate UUID v4
Header out: X-Correlation-Id: <uuid>  →  echo lại trong response
```

### C# Middleware (đã có trong SKILL.md aspnet-service)

```csharp
// Middleware/CorrelationIdMiddleware.cs — đăng ký TRƯỚC mọi middleware khác
var correlationId = ctx.Request.Headers["X-Correlation-Id"].FirstOrDefault()
                    ?? Guid.NewGuid().ToString();
ctx.Items["CorrelationId"] = correlationId;
ctx.Response.Headers["X-Correlation-Id"] = correlationId;
using (LogContext.PushProperty("CorrelationId", correlationId))
    await next(ctx);
```

### Python Middleware (đã có trong SKILL.md fastapi-service)

```python
# middleware/correlation_id.py
correlation_id = request.headers.get("X-Correlation-Id") or str(uuid.uuid4())
request.state.correlation_id = correlation_id
structlog.contextvars.bind_contextvars(correlation_id=correlation_id)
response.headers["X-Correlation-Id"] = correlation_id
```

### Propagate vào outgoing HTTP calls

```csharp
// DelegatingHandler — đăng ký cho mọi HttpClient ra ngoài
request.Headers.TryAddWithoutValidation("X-Correlation-Id",
    _accessor.HttpContext?.Items["CorrelationId"]?.ToString());
```

```python
# httpx — truyền header sang service khác
async with httpx.AsyncClient() as client:
    resp = await client.get(url, headers={"X-Correlation-Id": correlation_id})
```

### Propagate vào Kafka events

```csharp
// Bắt buộc trong mọi Kafka event payload
var @event = new SongPlayedEvent
{
    EventId = Guid.NewGuid().ToString(),
    CorrelationId = httpContext.Items["CorrelationId"]?.ToString() ?? "",
    // ...
};
```

```python
# Kafka producer — include trong payload
event = SongPlayedEvent(
    event_id=str(uuid.uuid4()),
    correlation_id=request.state.correlation_id,
    # ...
)
```

**Rules:**
- `meta.requestId` trong response = `correlationId` (không generate UUID mới)
- Log phải có `correlationId` trên mọi dòng (qua Serilog `LogContext` hoặc structlog `contextvars`)
- Không bao giờ generate correlationId mới giữa chừng — extract 1 lần ở middleware, dùng suốt request

---

## 9. Async 202 Pattern

### Endpoints trả 202 ngay lập tức

| Endpoint | Budget | Xử lý async |
|---|---|---|
| `POST /api/v1/analytics/events/play` | **50ms** | Validate → check idempotency → Kafka publish → return 202 |
| `POST /api/v1/recommendations/feedback` | **100ms** | Validate → check idempotency → Kafka publish → return 202 |

### Pattern

```
1. Validate input          (sync — fail fast, return 400)
2. Check Idempotency-Key   (Redis SETNX — fail fast, return 409)
3. Return 202 Accepted     ← response sent HERE
4. Publish to Kafka        (async — client không chờ)
```

### C# Implementation

```csharp
[HttpPost("events/play")]
[ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status202Accepted)]
public async Task<IActionResult> TrackPlay(
    [FromHeader(Name = "Idempotency-Key")] string idempotencyKey,
    [FromBody] PlayEventRequest request,
    CancellationToken ct)
{
    // 1. Validate (ModelState auto via [ApiController])

    // 2. Idempotency check
    if (!await _idempotencyService.IsNewRequestAsync(idempotencyKey))
        return Conflict(ApiResponse<object>.Fail("IDEMPOTENCY_CONFLICT", "Duplicate request.", HttpContext));

    // 3. Return 202 — ngay lập tức
    var response = Accepted(ApiResponse<bool>.Success(true, HttpContext));

    // 4. Fire-and-forget Kafka publish (không await trước khi return)
    _ = Task.Run(() => _kafkaProducer.PublishAsync("Song_Played", _mapper.Map<SongPlayedEvent>(request)), CancellationToken.None);

    return response;
}
```

### Python Implementation

```python
@router.post("/feedback", status_code=202)
async def post_feedback(
    request: Request,
    body: FeedbackRequest,
    idempotency_key: str = Header(..., alias="Idempotency-Key"),
    service: RecommendationService = Depends(get_recommendation_service),
):
    # 1. Pydantic đã validate body

    # 2. Idempotency check
    is_new = await service.repo.check_and_set_idempotency(
        f"rec:idempotency:{idempotency_key}", ttl=86400
    )
    if not is_new:
        raise IdempotencyConflictException()

    # 3. Fire-and-forget — không await
    asyncio.create_task(service.publish_feedback_event(body, request.state.correlation_id))

    # 4. Return 202 ngay
    return ApiResponse.ok(data=True, request_id=request.state.correlation_id)
```

**Rules:**
- Validate input và idempotency TRƯỚC khi return 202 — client nhận 202 nghĩa là "đã nhận và sẽ xử lý"
- Không bao giờ return 200 cho các endpoint này — phải là `202 Accepted`
- Kafka publish failure không ảnh hưởng response — nhưng phải có local disk fallback

---

## 10. Pre-implement Checklist

Trước khi viết code cho bất kỳ endpoint nào, Claude tự kiểm tra:

**Contract**
- [ ] Đối chiếu `docs/originals/API_DESIGN_V2.md`: HTTP method, path, query params đúng chưa?
- [ ] Response body dùng đúng `ApiResponse<T>` wrapper?
- [ ] `meta.requestId` = `correlationId` (không phải UUID mới)?
- [ ] `data: null` khi error, `error: null` khi success?

**Latency**
- [ ] Budget của endpoint là bao nhiêu ms? (bảng mục 2)
- [ ] Downstream calls có timeout tương ứng?
- [ ] Có fallback nếu downstream vượt timeout?

**Idempotency**
- [ ] Endpoint có trong danh sách cần `Idempotency-Key`? (bảng mục 3)
- [ ] Thiếu header → `400 VALIDATION_ERROR` (không phải `409`)?
- [ ] Redis key dùng đúng namespace prefix theo `REDIS_KEY_DESIGN.md`?
- [ ] TTL = 24h?

**Rate Limit**
- [ ] Endpoint có rate limit? Limit là bao nhiêu? (bảng mục 4)
- [ ] Vượt limit trả `429 RATE_LIMIT_EXCEEDED` (không phải 400 hay 503)?

**Error Codes**
- [ ] Tất cả error cases dùng đúng code từ catalogue mục 5?
- [ ] Không dùng code tự đặt ngoài danh sách?
- [ ] `INTERNAL_ERROR` message luôn là generic — không expose details?

**Pagination**
- [ ] GET list endpoint dùng cursor pagination, không dùng offset?
- [ ] Response có `meta.pagination.nextCursor` và `meta.pagination.hasMore`?

**RBAC**
- [ ] Endpoint cần restrict role không? (bảng mục 7)
- [ ] Creator endpoint có check ownership nếu cần?
- [ ] Sai role trả `403 FORBIDDEN`, không phải `401`?

**CorrelationId**
- [ ] Middleware extract từ header, generate nếu không có?
- [ ] `correlationId` được truyền vào outgoing HTTP calls?
- [ ] `correlationId` có trong Kafka event payload?
- [ ] Mọi log line có `correlationId`?

**Async (202)**
- [ ] Endpoint `analytics/events/play` và `recommendations/feedback` trả 202 (không phải 200)?
- [ ] Validate + Idempotency check TRƯỚC khi return 202?
- [ ] Kafka publish là fire-and-forget sau khi return?

**Tests**
- [ ] Unit test cho happy path?
- [ ] Unit test cho từng error case (401, 403, 404, 409...)?
- [ ] Test idempotency: lần 1 → 200/202, lần 2 → 409?
