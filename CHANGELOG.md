# Changelog — Smart Music Streaming Platform

**Mục đích:** Ghi lại toàn bộ thay đổi có ý nghĩa của dự án theo từng milestone.
Tài liệu này dành cho: thầy hướng dẫn, hội đồng bảo vệ, và thành viên nhóm.

**Cách cập nhật:**
1. Mỗi khi hoàn thành feature/fix/task đáng kể, thêm vào `[Unreleased]`.
2. Khi kết thúc milestone, chuyển nội dung xuống section tương ứng và ghi ngày.
3. Sub-sections: **Added**, **Changed**, **Fixed**, **Removed**.

Format chuẩn: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

---

## [Unreleased]

_(Không có thay đổi pending — tất cả đã được đưa vào milestone tương ứng.)_

---

## [Week 5–6] — 2026-05-06

> **Milestone:** Search + Analytics + Notification — Creator thấy heatmap sau play/skip events.

### Added

**Analytics Service**
- `POST /api/v1/analytics/events/play` — 202 async: idempotency Redis SETNX `analytics:idem:{key}` TTL 24h, background Kafka publish + InfluxDB write, DLQ fallback `/tmp/analytics-dlq.jsonl` (Analytics Service)
- `GET /api/v1/analytics/creator/heatmap/{songId}?timeRange=7d|30d` — Creator ownership check via Music Service internal, Redis cache TTL 6h `heatmap:{songId}:{timeRange}`, Admin bypass (Analytics Service)
- `GET /api/v1/analytics/creator/stats/{songId}` — totalPlays, totalSkips, uniqueListeners, avgListenPercent; Redis cache TTL 6h `stats:{songId}` (Analytics Service)
- Kafka consumer `Song_Played` → InfluxDB `song_played` measurement, idempotency dedup `dedup:analytics:Song_Played:{eventId}` (Analytics Service)
- Kafka consumer `Song_Skipped` → InfluxDB `song_skipped` measurement (Analytics Service)
- Kafka consumer `Notification_Sent` → InfluxDB `notification_sent` counter (Analytics Service)
- `KafkaConsumerBackgroundService` — generic background service, manual commit, scope per message (Analytics Service)
- `GatewayAuthHandler`, `RedisIdempotencyRepository`, `RedisAnalyticsCache`, `KafkaEventPublisher`, `MusicServiceClient` (Analytics Service)
- `GET /internal/songs/{songId}` — trả `{ id, artistId, title }` cho Analytics Service ownership check (Music Service)
- Tests: 15 AnalyticsService unit + 13 AnalyticsController unit + 5 KafkaHandler unit = **32/32 xanh** (Analytics Service)
- ACs covered: AC4.1.1, AC4.1.2, AC4.1.3, AC4.1.4, AC4.2.1, AC4.2.2, AC4.2.3, AC4.2.4

**Notification Service**
- `GET /api/v1/notifications/unread` — cursor pagination (ObjectId-based), filter `status IN [Pending, Delivered]`, budget 150ms (Notification Service)
- `PATCH /api/v1/notifications/{id}/read` — idempotent via `Idempotency-Key`, Redis SETNX `notification:idem:{key}` TTL 24h, ownership check (Notification Service)
- `PATCH /api/v1/notifications/read-all` — 202 async, bulk MongoDB UpdateMany background, budget 200ms (Notification Service)
- Kafka consumer `New_Release` → full cursor-loop fan-out tới tất cả followers (batch 500), insert MongoDB, publish `Notification_Sent` best-effort, retry 3x Exponential Backoff (Notification Service)
- `MongoNotificationRepository` — MongoDB.Driver 2.28, ObjectId cursor pagination, bulk InsertMany (Notification Service)
- `RedisIdempotencyRepository` — `SETNX` TTL 24h (Notification Service)
- `UserServiceClient` — `IAsyncEnumerable<Guid>` cursor loop, full pagination via `/internal/artists/{artistId}/followers` (Notification Service)
- `KafkaEventPublisher` — Confluent.Kafka, idempotent producer, local file fallback (Notification Service)
- `GatewayAuthHandler` — trust `X-User-Id`/`X-User-Role` headers (Notification Service)
- `GET /internal/artists/{artistId}/followers` — cursor pagination `follows` table (User Service)
- `Follow` domain model + EF Core mapping + `GetFollowerIdsAsync` (User Service)
- Tests: 18 unit (NotificationService 15 + NewReleaseHandler 3) + 13 integration = **31/31 xanh** (Notification Service)
- ACs covered: AC6.1.1, AC6.1.2, AC6.1.3

**Search Service**
- `GET /api/v1/search` — Elasticsearch 8 fuzzy search (fuzziness AUTO, fields title^3/artist^2/album), cursor pagination (base64 offset), Redis cache TTL 10m (`search:cache:{sha256}`), fallback `[]` on timeout/ES error (Search Service)
- `GatewayAuthHandler` — trust `X-User-Id`/`X-User-Role` từ API Gateway (Search Service)
- `ElasticsearchSearchRepository` — `Elastic.Clients.Elasticsearch` v8 client, MultiMatch query, offset-based pagination (Search Service)
- `RedisSearchCache` — TTL 600s, `StackExchange.Redis`, non-fatal on Redis failure (Search Service)
- `infra/seed/elasticsearch_seed.sh` — tạo index mapping + bulk-index 10 songs (Sơn Tùng M-TP x2, Chillies x2, Ngọt x4, Vũ. x2) (Infrastructure)
- Tests: 9 unit SearchService + 11 unit SearchController = **20/20 xanh** (Search Service)

---

## [Week 3–4] — 2026-05-05

> **Milestone:** Music + Streaming + Recommendation — Listener có thể nghe nhạc end-to-end.
> Creator upload → Music Service → Streaming Service cấp pre-signed URL → Listener nghe.
> Checkpoint W4: chờ verify end-to-end.

### Added

**Music Service**
- `POST /api/v1/music/songs` — upload audio (validate MIME magic bytes, max 50MB, S3-first atomicity, Exponential Backoff retry 3x, Kafka `New_Release` event sau khi commit DB) (Music Service)
- `GET /api/v1/music/songs/{songId}` — metadata lookup, Redis cache TTL 30m, key `song:meta:{songId}`, GatewayAuth (Music Service)
- `GET /internal/songs/{songId}/storage-key` — internal endpoint cho Streaming Service (Music Service)
- `GET /internal/songs/batch?ids=...` — batch metadata fetch cho Recommendation Service (Music Service)
- `GatewayAuthHandler` — trust `X-User-Id`/`X-User-Role` headers từ API Gateway (Music Service)
- `ISongCache` + `RedisSongCache` — cache abstraction tách Application khỏi Infrastructure (Music Service)
- EF Core migration `InitialCreate` — 5 tables: `artists`, `genres`, `albums`, `songs`, `song_genres` (music_db) (Music Service)
- `IdempotencyFilterAttribute` — Redis SET NX, TTL 24h, block duplicate upload (Music Service)
- Tests: 7 unit (mock S3/Kafka/DB) + 8 integration (native postgres music_db) = **15/15 xanh** (Music Service)

**Streaming Service**
- `GET /api/v1/streaming/{songId}/url` — gọi Music Service internal (timeout 150ms), generate pre-signed URL expiry chính xác 900s (AC3.1.3), GatewayAuth (Streaming Service)
- `GET /api/v1/streaming/{songId}/chunk` — HTTP Range Request, 206 Partial Content, S3 proxy via `ByteRange` (AC3.1.2), GatewayAuth (Streaming Service)
- `S3StoragePresigner` — pre-sign URL + byte-range fetch từ MinIO/S3 (Streaming Service)
- `MusicServiceClient` — typed HttpClient gọi `/internal/songs/{songId}/storage-key` (Streaming Service)
- Tests: 7 unit (mock-based) + 8 integration (WebApplicationFactory + mock DI) = **15/15 xanh** (Streaming Service)

**Recommendation Service**
- `GET /api/v1/recommendations` — fallback chain: cache HIT → Rule Engine (300ms timeout) → Top 50 Trending (AC2.1.1, AC2.1.4, AC2.1.5), GatewayAuth (Recommendation Service)
- `POST /api/v1/recommendations/feedback` — async 202, fire-and-forget weight update (Recommendation Service)
- Rule Engine — pure Python, formula: `base + context_bonus(+0.4) + preference_bonus - skip_penalty`, CONTEXT_GENRE_MAP 4 contexts, `TIMEOUT_MS=300` (Recommendation Service)
- `RedisRepository` — genre weights Hash, recommendation cache (TTL 1h), trending Sorted Set (read-only), idempotency SET NX (TTL 24h), onboarding prefs (Recommendation Service)
- Kafka consumer `Song_Played` — duration >= 80% → +0.3 genre weight, cache invalidate (AC2.2.1) (Recommendation Service)
- Kafka consumer `Song_Skipped` — duration < 30% → -0.2 genre weight, cache invalidate (AC2.2.2) (Recommendation Service)
- Kafka consumer `User_Preferences_Updated` — seed onboarding genre prefs (Recommendation Service)
- Idempotency SET NX trước mỗi Kafka event, DLQ sau 3 retries Exp Backoff 1s→2s→4s (AC2.2.3) (Recommendation Service)
- Tests: 15 unit rule engine + 9 handlers + 7 service + 11 integration = **42/42 xanh**, 0 warnings (Recommendation Service)

**Infrastructure**
- Seed script `infra/seed/s3_seed.sh` — bucket `smartmusic-audio` + upload test MP3 lên MinIO (Infrastructure)
- Seed script `infra/seed/redis_seed.sh` — 50 trending songs trong `rec:trending:global` Sorted Set, TTL 1h (Infrastructure)

### Fixed

- Music Service: `ApiResponse<T>` — fix error shape thành `{ code, message }`, thêm `meta.apiVersion/requestId/timestamp` đúng contract (Music Service)
- Music Service: `POST /music/songs` — fix trả 201 thay vì 200 (Music Service)
- Music Service: `IStorageService.BucketName` property — Application layer không inject `IConfiguration` (Music Service)
- Recommendation Service: xóa UTF-8 BOM khỏi `pyproject.toml`; đổi `build-backend` sang `setuptools.build_meta` (Recommendation Service)

### Changed

- API Design V2: cập nhật mã lỗi 503 cho S3, chuẩn hóa response batch endpoint (Documentation)

---

## [Week 2] — 2026-05-05

> **Milestone:** Auth + User + API Gateway — login flow end-to-end hoạt động.
> Auth Service cấp JWT, User Service quản lý identity + preferences, API Gateway route + validate.

### Added

- Auth Service: `POST /api/v1/auth/login` — JWT access token + HTTP-only refresh cookie, brute-force lock sau 5 lần fail (Auth Service)
- Auth Service: `POST /api/v1/auth/refresh` — Refresh Token Rotation với reuse detection, revoke all sessions khi phát hiện tái sử dụng (Auth Service)
- Auth Service: `POST /api/v1/auth/logout` — revoke refresh token + blacklist access token JTI trong Redis (Auth Service)
- Auth Service: EF Core migration `InitialCreate` — tables `refresh_tokens`, `token_blacklist` (auth_db PostgreSQL) (Auth Service)
- User Service: `GET /api/v1/users/me` — profile từ PostgreSQL, Redis cache TTL 15m (User Service)
- User Service: `POST /api/v1/users/me/preferences` — lưu preferences + publish Kafka `User_Preferences_Updated` (User Service)
- User Service: gRPC server `GetUserProfile` + `VerifyCredentials` (User Service)
- User Service: Internal `GET /internal/users/{id}/preferences` cho Recommendation Service (User Service)
- User Service: EF Core migration `InitialCreate` — tables `users`, `user_preferences` (user_db PostgreSQL) (User Service)
- API Gateway: YARP routing 9 routes → 9 downstream services (API Gateway)
- API Gateway: `JwtValidationMiddleware` — validate HS256, check Redis blacklist `token:blacklist:{jti}`, skip login/refresh/health (API Gateway)
- API Gateway: `RateLimitingMiddleware` — Redis Sliding Window, login 10/min IP+SHA256(username), general 100/min IP (API Gateway)
- API Gateway: `CircuitBreakerMiddleware` — downstream timeout 2000ms → 503, swallow client disconnect gracefully (API Gateway)
- API Gateway: `CorrelationIdMiddleware` — generate/propagate `X-Correlation-Id` (API Gateway)

### Fixed

- User Service `DbInitializer`: thêm `if (db.Database.IsRelational())` trước `MigrateAsync()` — fix lỗi InMemory provider trong integration tests (User Service)
- Auth Service `user.proto`: thêm RPC `VerifyCredentials(username, password)` — Auth Service không connect trực tiếp vào `user_db` (Auth Service)
- API Gateway: Redis blacklist key đổi thành `token:blacklist:{jti}` (khớp với key Auth Service writes) (API Gateway)

---

## [Day 5] — 2026-05-03

> **Milestone:** Project scaffold — tất cả services build thành công, `GET /health` → 200.
> Checkpoint: 21 containers Up, 0 exited; 10 services `GET /health` → 200.

### Added

- Boilerplate 9 C# services theo Clean Architecture (Api/Application/Infrastructure/Domain): api-gateway, auth-service, user-service, music-service, streaming-service, listening-party-service, analytics-service, notification-service, search-service
- `GET /health` → 200 cho toàn bộ 9 C# services và Recommendation Service
- `CorrelationIdMiddleware` cài sẵn trên mọi C# service
- Boilerplate Recommendation Service (Python FastAPI) — `uvicorn` chạy được
- Boilerplate Frontend SPA (React + TypeScript + Vite) — `npm run dev` hiển thị "Smart Music Platform"
- `docker-compose up --build` — 21 containers healthy, 0 exited

### Fixed

- Pin `Microsoft.EntityFrameworkCore Version="8.0.*"` — mặc định `Version="*"` resolve 10.x không tương thích net8.0
- Pin `Microsoft.AspNetCore.Mvc.Testing Version="8.0.*"` — cùng lý do
- Pin `FluentAssertions` và `Moq` về version cụ thể trong tất cả test projects
- Thêm `ASPNETCORE_HTTP_PORTS=80` vào docker-compose — .NET 8 đổi default port từ 80 → 8080
- Sửa build context từ `./services/X` → `../services/X` trong docker-compose (relative từ `infra/`)
- Xóa `UseHttpsRedirection` khỏi pipeline — không cần trong container

### Changed

- YARP config yêu cầu placeholder `ReverseProxy: { Routes: {}, Clusters: {} }` trong `appsettings.json`
