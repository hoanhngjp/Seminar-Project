# RULE: security-non-negotiable

**Áp dụng tuyệt đối — không có ngoại lệ, không có "tạm thời", không có "chỉ để test".**
Code test hôm nay là code production ngày mai.

---

## 1. Secrets & Credentials

### KHÔNG BAO GIỜ

- Hardcode JWT secret, AWS credentials, DB connection string, Redis password, Kafka credentials trong source code
- Commit file `.env` thật lên Git (chỉ commit `.env.example`)
- Log ra bất kỳ secret nào — kể cả `logger.Debug()`
- Trả secret về trong API response dù là error hay success

### LUÔN LUÔN

- Đọc secrets từ environment variables
- Dùng `.env.example` với placeholder values
- Throw exception ngay khi start nếu required env var không tồn tại

---

#### Ví dụ — Secrets

**SAI:**
```csharp
// WRONG: hardcoded secret
var jwtKey = "my-super-secret-key-1234";
var connStr = "Host=localhost;Database=authdb;Username=sa;Password=Admin123";

// WRONG: log sensitive data
_logger.LogDebug("Token: {token}", accessToken);
_logger.LogError("DB error: {connStr}", connectionString);
```

```python
# WRONG: hardcoded AWS credentials
s3_client = boto3.client(
    's3',
    aws_access_key_id='AKIAIOSFODNN7EXAMPLE',
    aws_secret_access_key='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
)
```

**ĐÚNG:**
```csharp
// CORRECT: read from env, throw if missing
var jwtKey = Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? throw new InvalidOperationException("JWT_SECRET environment variable is required.");

var connStr = Environment.GetEnvironmentVariable("AUTH_DB_CONNECTION_STRING")
    ?? throw new InvalidOperationException("AUTH_DB_CONNECTION_STRING is required.");

// CORRECT: mask sensitive fields in logs
_logger.LogDebug("Login attempt for userId: {userId}", userId);
// Never log the token itself
```

```python
# CORRECT: read from env
import os
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    region_name=os.environ["AWS_REGION"]
)
```

**`.env.example` đúng:**
```dotenv
JWT_SECRET=your-jwt-secret-here
AUTH_DB_CONNECTION_STRING=Host=localhost;Database=authdb;Username=sa;Password=
AWS_ACCESS_KEY_ID=your-access-key-here
AWS_SECRET_ACCESS_KEY=your-secret-key-here
REDIS_PASSWORD=your-redis-password-here
KAFKA_SASL_PASSWORD=your-kafka-password-here
```

---

## 2. JWT & Authentication

### KHÔNG BAO GIỜ

- Lưu Access Token trong `localStorage` hoặc `sessionStorage` (XSS có thể đánh cắp)
- Verify JWT với algorithm `"none"` — đây là lỗ hổng nghiêm trọng
- Bỏ qua expiry (`ValidateLifetime = false`)
- Trả thông tin user (email, role, userId) trong JWT error response
- Dùng Refresh Token nhiều lần — phải ONE-TIME USE

### LUÔN LUÔN

- Access Token: lưu **in-memory** ở frontend (React state)
- Refresh Token: HTTP-only Cookie (không accessible từ JavaScript)
- Token revocation: Redis Blacklist với TTL = remaining expiry
- Refresh Token reuse → revoke **toàn bộ session** của user đó
- Brute-force: lock account sau 5 lần fail liên tiếp

---

#### Ví dụ — JWT

**SAI:**
```typescript
// WRONG: store token in localStorage — XSS vulnerable
localStorage.setItem('accessToken', response.data.accessToken);

// WRONG: send token in Authorization header from localStorage
const token = localStorage.getItem('accessToken');
```

```csharp
// WRONG: disable lifetime validation
TokenValidationParameters = new TokenValidationParameters
{
    ValidateLifetime = false, // NEVER do this
    ValidAlgorithms = new[] { "none", "HS256" } // NEVER allow "none"
};

// WRONG: expose user info on auth failure
return Unauthorized(new { message = "Token invalid", email = user.Email });
```

**ĐÚNG:**
```typescript
// CORRECT: store access token in memory only
let accessToken: string | null = null;

export const setAccessToken = (token: string) => { accessToken = token; };
export const getAccessToken = () => accessToken;
// Refresh token is in HTTP-only cookie — browser handles it automatically
```

```csharp
// CORRECT: strict JWT validation
TokenValidationParameters = new TokenValidationParameters
{
    ValidateIssuerSigningKey = true,
    IssuerSigningKey = new SymmetricSecurityKey(
        Encoding.UTF8.GetBytes(jwtSecret)),
    ValidateLifetime = true,
    ClockSkew = TimeSpan.Zero,
    ValidAlgorithms = new[] { "HS256" } // explicit allowlist only
};

// CORRECT: generic error — no user info leaked
return Unauthorized(new ApiResponse { Success = false, Error = new ApiError
{
    Code = "TOKEN_EXPIRED",
    Message = "Authentication required."
}});

// CORRECT: Refresh Token reuse detection → revoke all sessions
if (await _redis.KeyExistsAsync($"rt:used:{refreshToken}"))
{
    await RevokeAllUserSessionsAsync(userId); // nuclear option
    return Forbidden("TOKEN_REUSED");
}
await _redis.SetAsync($"rt:used:{refreshToken}", "1", ttl: tokenExpiry);
```

---

## 3. Input Validation

### KHÔNG BAO GIỜ

- Trust bất kỳ input từ client mà không validate
- Dùng user input trực tiếp trong SQL query
- Dùng user input trực tiếp trong file path (path traversal)
- Deserialize JSON/payload mà không validate schema
- Upload file lên S3 mà không validate MIME type và size server-side

### LUÔN LUÔN

- Validate tại Controller/Router layer — trước khi business logic
- Trả `400 VALIDATION_ERROR` với message mô tả rõ field lỗi
- File upload: validate MIME type và size (max 50MB) trước khi gọi S3

---

#### Ví dụ — Input Validation

**SAI:**
```csharp
// WRONG: raw string interpolation in SQL (SQL Injection)
var query = $"SELECT * FROM songs WHERE title = '{req.Title}'";
await _db.ExecuteAsync(query);

// WRONG: user-controlled file path (Path Traversal)
var filePath = Path.Combine("/audio", req.FileName);
return File(filePath, "audio/mpeg");

// WRONG: no file type validation before S3 upload
await _s3.PutObjectAsync(new PutObjectRequest
{
    BucketName = bucket,
    Key = req.FileName,
    InputStream = req.File.OpenReadStream()
});
```

**ĐÚNG:**
```csharp
// CORRECT: parameterized query — EF Core does this by default
var songs = await _db.Songs
    .Where(s => s.Title == req.Title)
    .ToListAsync();

// CORRECT: never use user input in file path — use songId from DB
var storageKey = $"songs/{songId}/audio.mp3"; // server-controlled path

// CORRECT: validate MIME type and size before S3 upload
private static readonly HashSet<string> AllowedMimeTypes =
    new() { "audio/mpeg", "audio/wav", "audio/ogg" };

if (!AllowedMimeTypes.Contains(req.File.ContentType))
    return BadRequest(ValidationError("File type not allowed."));

if (req.File.Length > 50 * 1024 * 1024)
    return StatusCode(413, PayloadTooLargeError());

// Only upload after validation passes
await _s3.PutObjectAsync(...);
```

```python
# CORRECT: pydantic validation in FastAPI — validate before business logic
from pydantic import BaseModel, Field

class FeedbackRequest(BaseModel):
    event_id: str = Field(..., pattern=r'^[0-9a-f-]{36}$')
    song_id: str = Field(..., min_length=1, max_length=50)
    action: Literal["PLAY", "SKIP"]
    duration_percent: float = Field(..., ge=0, le=100)
```

---

## 4. RBAC Enforcement

### KHÔNG BAO GIỜ

- Bỏ RBAC check vì "endpoint này ít người dùng"
- Chỉ check role ở frontend — backend phải luôn check lại
- Để Admin endpoint accessible bởi Listener hoặc Creator
- Creator xem analytics của song không phải của mình

### LUÔN LUÔN

- Check role tại backend (Controller/middleware) — không trust claim từ request body
- Creator analytics: check ownership (`song.ArtistId == currentUserId`)
- Admin có thể xem tất cả — không cần ownership check

---

#### Ví dụ — RBAC

**SAI:**
```csharp
// WRONG: no ownership check — any Creator can see any song's analytics
[HttpGet("creator/heatmap/{songId}")]
[Authorize(Roles = "Creator,Admin")]
public async Task<IActionResult> GetHeatmap(string songId) { ... }

// WRONG: trust role from request body
var role = req.Body["role"]; // NEVER
```

**ĐÚNG:**
```csharp
// CORRECT: ownership check for Creator, bypass for Admin
[HttpGet("creator/heatmap/{songId}")]
[Authorize(Roles = "Creator,Admin")]
public async Task<IActionResult> GetHeatmap(string songId)
{
    var currentUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
    var currentRole = User.FindFirstValue(ClaimTypes.Role);

    if (currentRole != "Admin")
    {
        var song = await _musicService.GetSongAsync(songId);
        if (song == null) return NotFound(SongNotFoundError());
        if (song.ArtistId != currentUserId) return Forbid();
    }
    // proceed
}
```

---

## 5. Pre-signed URLs & S3

### KHÔNG BAO GIỜ

- Generate Pre-signed URL không có thời gian hết hạn
- Expose S3 bucket URL trực tiếp (public bucket)
- Commit metadata vào DB trước khi S3 upload confirm thành công

### LUÔN LUÔN

- Pre-signed URL expiry: **15 phút (900 giây)** — không dài hơn
- S3 bucket: **không public** — chỉ access qua Pre-signed URL
- S3 atomicity: chỉ commit metadata vào DB **sau** khi S3 upload confirm

---

#### Ví dụ — S3

**SAI:**
```csharp
// WRONG: no expiry on pre-signed URL
var url = await _s3.GetPreSignedURLAsync(new GetPreSignedUrlRequest
{
    BucketName = bucket,
    Key = storageKey
    // missing Expires — URL valid forever
});

// WRONG: save to DB before S3 upload
await _songRepository.AddAsync(song); // committed to DB
await _s3.PutObjectAsync(...);        // if this fails, DB has orphan record
```

**ĐÚNG:**
```csharp
// CORRECT: 15-minute expiry
var url = await _s3.GetPreSignedURLAsync(new GetPreSignedUrlRequest
{
    BucketName = bucket,
    Key = storageKey,
    Expires = DateTime.UtcNow.AddSeconds(900), // exactly 900s
    Verb = HttpVerb.GET
});

// CORRECT: S3 first, DB second — atomicity
try
{
    await _s3.PutObjectAsync(uploadRequest); // S3 upload
    await _songRepository.AddAsync(song);    // commit only after S3 success
    await _kafkaProducer.PublishAsync("New_Release", newReleaseEvent);
}
catch (AmazonS3Exception)
{
    // S3 failed — do NOT commit to DB
    return StatusCode(500, InternalError());
}
```

---

## 6. Rate Limiting

### KHÔNG BAO GIỜ

- Bỏ rate limit trên auth endpoints (login, refresh token)
- Để "thêm sau" — rate limit phải có từ ngày đầu
- Chỉ rate limit ở code service — phải ở API Gateway

### LUÔN LUÔN

Rate limit được enforce tại **API Gateway** — không trust client:

| Endpoint | Rate Limit | Key |
|----------|-----------|-----|
| `POST /auth/login` | 10 req/min | IP + Username |
| `POST /auth/refresh` | 20 req/min | IP + User |
| `GET /users/me` | 100 req/min | Token |
| `GET /recommendations` | 60 req/min | Token |
| `GET /streaming/{songId}/url` | 120 req/min | Token |
| `GET /streaming/{songId}/chunk` | 120 req/min | Token |
| `GET /analytics/creator/*` | 30 req/min | Token |
| `GET /search` | 60 req/min | Token |
| `GET /notifications/*` | 60 req/min | Token |
| `POST /parties/{joinCode}/join` | 30 req/min | Token |

Response khi vượt limit: `429 RATE_LIMIT_EXCEEDED`

---

## 7. Replay Attack Protection

### Nonce + Timestamp cho mutating requests (POST/PUT/DELETE)

| Check | Rule | Action khi fail |
|-------|------|----------------|
| Nonce tồn tại trong Redis | Reject — đã xử lý | `409 IDEMPOTENCY_CONFLICT` |
| Timestamp lệch > 60s so với server time | Reject — request cũ | `400 VALIDATION_ERROR` |
| Nonce TTL | 30–60 giây (replay window) | Auto-expire |

---

#### Ví dụ — Replay Protection

**ĐÚNG:**
```csharp
// CORRECT: nonce + timestamp validation
public async Task ValidateIdempotency(string idempotencyKey, long requestTimestamp)
{
    var serverNow = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    if (Math.Abs(serverNow - requestTimestamp) > 60)
        throw new ValidationException("Request timestamp too old or too far in future.");

    var redisKey = $"nonce:{idempotencyKey}";
    var set = await _redis.SetAsync(redisKey, "1", TimeSpan.FromSeconds(60),
        when: When.NotExists); // SET NX — atomic
    if (!set)
        throw new IdempotencyConflictException();
}
```

---

## 8. Logging & PII

### KHÔNG BAO GIỜ

- Log: password, token (access/refresh), API key, bất kỳ credential nào
- Log: email, họ tên, số điện thoại, địa chỉ, CCCD
- Lưu PII vào Analytics Service (InfluxDB) — chỉ `userId` (UUID)
- Expose stack trace trong production error response

### LUÔN LUÔN

- Mask email trong logs: `u***@***.com`
- Analytics: chỉ lưu `userId` (UUID dạng anonymized) — không lưu email/name
- Production error response: chỉ trả `code` + `message` — không trả `stackTrace`

---

#### Ví dụ — Logging & PII

**SAI:**
```csharp
// WRONG: log PII và credentials
_logger.LogInformation("User {email} logged in with password {password}", email, password);
_logger.LogDebug("Access token: {token}", accessToken);
_logger.LogError(ex, "DB error"); // stack trace exposed in response?

// WRONG: return stack trace in production
return StatusCode(500, new { error = ex.ToString() }); // NEVER
```

```python
# WRONG: store PII in InfluxDB
point = Point("song_played") \
    .tag("user_email", user.email) \   # NEVER — PII in analytics
    .tag("user_name", user.name) \     # NEVER
    .field("song_id", song_id)
```

**ĐÚNG:**
```csharp
// CORRECT: mask email, never log token
_logger.LogInformation("Login attempt for userId: {userId}", userId);
// email masked: _logger.LogInformation("User {email}", MaskEmail(email));

private static string MaskEmail(string email)
{
    var at = email.IndexOf('@');
    return at <= 1 ? "***" : $"{email[0]}***@***.com";
}

// CORRECT: production error — no stack trace
return StatusCode(500, new ApiResponse
{
    Success = false,
    Error = new ApiError { Code = "INTERNAL_ERROR", Message = "An unexpected error occurred." }
    // No StackTrace, no ExceptionMessage, no InnerException
});
```

```python
# CORRECT: only anonymized userId in analytics
point = Point("song_played") \
    .tag("user_id", str(user_id)) \    # UUID only — no name/email
    .tag("song_id", song_id) \
    .field("duration_sec", duration_sec) \
    .field("duration_percent", duration_percent)
```

---

## 9. Behavior khi User Yêu Cầu Vi Phạm Security Rule

Khi user yêu cầu implement thứ gì vi phạm bất kỳ rule nào trên, Claude **phải**:

**a.** Từ chối implement phần vi phạm — không implement "tạm thời" hay "chỉ để test".

**b.** Nêu rõ rule nào bị vi phạm và tại sao nguy hiểm.

**c.** Đề xuất cách implement đúng ngay trong response đó.

**d.** Không implement dù user dùng bất kỳ lý do nào:
- "test nhanh thôi" → Không
- "demo thôi, không production" → Không
- "tôi sẽ sửa sau" → Không
- "project học thôi" → Không

---

#### Template Response

```
"Tôi không thể implement [X] vì vi phạm security rule [tên rule].

Rủi ro cụ thể:
  [giải thích ngắn gọn — attack vector, hậu quả]

Cách đúng:
  [code hoặc approach thay thế]

Code tạm thời thường trở thành code production.
Tôi sẽ implement theo cách đúng ngay từ đầu."
```

---

#### Ví dụ

```
User: "Hardcode JWT secret tạm thôi để test nhanh"

Claude: "Tôi không thể implement hardcoded JWT secret vì vi phạm
rule Secrets & Credentials.

Rủi ro cụ thể:
  Secret hardcoded trong source code sẽ bị commit lên Git.
  Bất kỳ ai có quyền đọc repo (kể cả contributor tương lai)
  có thể forge JWT token và giả mạo bất kỳ user nào.

Cách đúng:
  var jwtKey = Environment.GetEnvironmentVariable('JWT_SECRET')
      ?? throw new InvalidOperationException('JWT_SECRET is required.');
  Copy .env.example → .env và điền giá trị thật vào local.

Code tạm thời thường trở thành code production.
Tôi sẽ implement theo cách đúng ngay từ đầu."
```

---

## Security Checklist — Trước khi Submit Code

- [ ] Không có secret nào hardcoded?
- [ ] Không có PII trong logs?
- [ ] JWT verify có `ValidateLifetime = true` và không có `"none"` algorithm?
- [ ] Access Token lưu in-memory (không localStorage)?
- [ ] Refresh Token là HTTP-only Cookie?
- [ ] Tất cả input được validate trước business logic?
- [ ] SQL dùng parameterized query (EF Core / Dapper)?
- [ ] File path không dùng user input?
- [ ] RBAC check ở backend + Creator ownership check?
- [ ] Pre-signed URL có expiry 900s?
- [ ] S3 metadata chỉ commit sau khi upload thành công?
- [ ] Rate limit được cấu hình tại API Gateway?
- [ ] Nonce + timestamp validation cho mutating endpoints?
- [ ] Production error response không có stack trace?
- [ ] Analytics chỉ lưu `userId` (UUID) — không có email/name?
