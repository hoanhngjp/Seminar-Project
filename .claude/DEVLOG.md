# DEVLOG — Smart Music Streaming Platform

**Dành cho:** nhóm dev + Claude (đọc khi debug để tránh lặp lại vấn đề cũ).

**Khi nào ghi:**
- Bug mất > 30 phút mới tìm ra nguyên nhân
- Quyết định kỹ thuật quan trọng (chọn A thay vì B, và tại sao)
- Workaround/hack đang dùng tạm — để người khác không "fix" nó thành broken
- Gotcha với infrastructure local (Docker, Kafka, Redis, LocalStack)

**Khi nào KHÔNG cần ghi:**
- Bug hiển nhiên (typo, missing null check)
- Thay đổi nhỏ đã có trong commit message
- Mọi thứ — chỉ ghi những gì người khác trong nhóm cần biết

**Format mỗi entry:**
```
---
[YYYY-MM-DD] [SERVICE/LAYER] [LOẠI: BUG | DECISION | BLOCKER | NOTE]

**Problem:** Mô tả vấn đề — triệu chứng quan sát được
**Root cause:** Tại sao xảy ra
**Fix / Decision:** Cách giải quyết, hoặc quyết định đã chọn
**Lesson / Warning:** Điều cần nhớ / tránh lặp lại
---
```

**Claude đọc file này:** Khi user báo bug hoặc hỏi về infrastructure, Claude sẽ đọc DEVLOG
để check xem vấn đề tương tự đã từng gặp chưa — tránh đề xuất lại cách fix đã thất bại.

---

## Entries

---

[2026-05-03] [USER SERVICE / EF CORE / INTEGRATION TESTS] [BUG]

**Problem:** `dotnet test` throws `System.InvalidOperationException : Relational-specific methods can only be used when the context is using a relational database provider` in `DbInitializer.SeedAsync`.
**Root cause:** The test `TestWebApplicationFactory` overrides `DbContext` to use `InMemoryDatabase`. But `DbInitializer` blindly calls `await db.Database.MigrateAsync();` which requires a relational provider.
**Fix / Decision:** Added `if (db.Database.IsRelational())` check before calling `MigrateAsync()`. Fallback to `EnsureCreatedAsync()` for InMemory tests.
**Lesson / Warning:** Luôn check `IsRelational()` trong seed data nếu project có dùng InMemory database cho integration tests.

---

[2026-05-03] [USER SERVICE / EF CORE / MIGRATION] [BUG]

**Problem:** `dotnet ef database update` fails with `password authentication failed for user "smartmusic"` despite `.env` configuration.
**Root cause:** The native Windows Postgres service on port 5432 was intercepting the connection instead of the Docker container. The user explicitly stated the Windows native postgres has username `postgres` and password `4L27hN04@`.
**Fix / Decision:** Updated `appsettings.json` connection string to `Host=localhost;Port=5432;Database=user_db;Username=postgres;Password=4L27hN04@` to connect directly to the native postgres on Windows.
**Lesson / Warning:** Cẩn thận port collision giữa Docker services và Windows native services.

---

[2026-05-03] [ALL C# SERVICES] [BUG]

**Problem:** `dotnet build` thất bại sau khi scaffold — EF Core, MVC Testing, FluentAssertions, Moq
đều resolve version 10.x khi dùng `Version="*"` trong `.csproj`.

**Root cause:** NuGet `Version="*"` lấy latest stable — tại thời điểm này latest là 10.x,
không tương thích với `<TargetFramework>net8.0</TargetFramework>`.

**Fix / Decision:** Pin cứng version cho tất cả packages nhạy cảm:
- `Microsoft.EntityFrameworkCore Version="8.0.*"`
- `Microsoft.AspNetCore.Mvc.Testing Version="8.0.*"`
- `FluentAssertions Version="6.12.*"`
- `Moq Version="4.20.*"`
- `Testcontainers Version="3.8.*"`, `Testcontainers.PostgreSql Version="3.8.*"`, v.v.

**Lesson / Warning:** KHÔNG dùng `Version="*"` cho bất kỳ package Microsoft.* nào trong repo này.
Khi thêm package mới, kiểm tra `<TargetFramework>` của service trước, rồi chọn version major phù hợp.

---

[2026-05-03] [ALL C# SERVICES / DOCKER] [BUG]

**Problem:** Tất cả C# containers exit ngay sau khi start — log: `Failed to bind to address http://[::]:80`.

**Root cause:** .NET 8 đổi default HTTP port từ 80 → 8080. Container lắng nghe trên 8080
nhưng docker-compose expose port 80, dẫn đến health check fail và container restart loop.

**Fix / Decision:** Thêm env var vào docker-compose cho mỗi C# service:
```yaml
environment:
  - ASPNETCORE_HTTP_PORTS=80
```

**Lesson / Warning:** Áp dụng cho tất cả service C# mới thêm vào. Nếu thấy container exit code 1
ngay sau start mà không có error rõ ràng — check port binding trước.

---

[2026-05-03] [API GATEWAY / YARP] [BUG]

**Problem:** api-gateway container crash với `InvalidOperationException` khi start —
YARP không tìm thấy config `ReverseProxy`.

**Root cause:** YARP bắt buộc phải có section `ReverseProxy` trong `appsettings.json` khi
`builder.Services.AddReverseProxy().LoadFromConfig(...)` được gọi, dù chỉ là boilerplate chưa có route thật.

**Fix / Decision:** Thêm placeholder vào `appsettings.json` của api-gateway:
```json
"ReverseProxy": {
  "Routes": {},
  "Clusters": {}
}
```
Routes thật sẽ được điền trong Week 2 theo `week2_auth_user_gateway.md`.

**Lesson / Warning:** Khi implement YARP routes trong Week 2, đừng xóa placeholder này —
update trực tiếp vào object đó. YARP sẽ throw nếu section bị missing dù `Routes` rỗng.

---

[2026-05-03] [INFRA / DOCKER-COMPOSE] [BUG]

**Problem:** `docker-compose up --build` báo lỗi `unable to prepare context: path not found`
cho tất cả C# service images.

**Root cause:** `docker-compose.yml` nằm trong `infra/` nhưng build context được viết là
`./services/X` — path này resolve từ thư mục `infra/` nên không tìm thấy.

**Fix / Decision:** Đổi tất cả build contexts sang `../services/X` (relative từ `infra/`).

**Lesson / Warning:** Khi thêm service mới vào docker-compose, luôn dùng `../services/<tên-service>` làm context.

---

[2026-05-04] [AUTH SERVICE / KAFKA] [NOTE]

**Problem:** `Song_Played` consumer trong Recommendation Service nhận duplicate events
sau khi restart container — cùng một event được process 2 lần, làm tăng sai preference weight.

**Root cause:** Kafka consumer group offset chưa được commit trước khi container bị kill.
Khi restart, consumer đọc lại từ offset chưa commit → duplicate processing.

**Fix / Decision:** Implement idempotency dedup via Redis SET với key `dedup:Song_Played:{event_id}`,
TTL 24 giờ, dùng `SET NX` (atomic). Event đã có key trong Redis → skip, không update weight.
Pattern này áp dụng cho tất cả 5 Kafka topics — xem `.claude/rules/testing-required/RULE.md` Section 1.

**Lesson / Warning:** KHÔNG tắt idempotency check dù "chỉ để test local" — nếu tắt,
preference weights sẽ bị skew sau mỗi lần `docker-compose restart`, và bug rất khó reproduce.

---

[2026-05-04] [STREAMING SERVICE / S3] [DECISION]

**Problem:** Team thảo luận: nên generate pre-signed URL ở Streaming Service hay API Gateway?
Nếu để Gateway generate, Streaming Service không cần biết S3 credentials.

**Root cause:** Kiến trúc chưa rõ ràng về ai là owner của S3 access logic.

**Fix / Decision:** Pre-signed URL **chỉ** được generate ở Streaming Service.
Lý do: (1) API Gateway không nên có business logic; (2) Streaming Service đã có
`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` trong env; (3) expiry 900s là business rule
của Streaming, không phải Gateway.
Internal flow: `API Gateway → (forward JWT) → Streaming Service → (generate URL) → trả về client`.

**Lesson / Warning:** Nếu sau này muốn thêm CDN signed URL (CloudFront), logic vẫn nằm ở
Streaming Service — chỉ thay đổi signing method, không cần đụng Gateway.

---

[2026-05-04] [RECOMMENDATION SERVICE / REDIS] [BUG]

**Problem:** `GET /recommendations` trả về 500 khi Redis Sorted Set `rec:trending:global`
chưa có data — xảy ra mỗi lần reset local Redis.

**Root cause:** `ZREVRANGE rec:trending:global 0 49` trả về empty list `[]`.
Code lúc đó raise `ValueError("No trending songs available")` thay vì trả list rỗng,
khiến fallback không hoạt động.

**Fix / Decision:** Fallback chain phải trả về `[]` (không throw) khi trending list rỗng.
Response vẫn 200 với `data: []`. Seed script `infra/seed-redis-trending.sh` phải chạy
sau `docker-compose up` — xem `infra/DOCKER_README.md`.

**Lesson / Warning:** Chạy `infra/verify-infra.sh` sau mỗi lần reset infrastructure
để check Redis có data seed chưa. Nếu `rec:trending:global` missing →
chạy seed script trước khi test Recommendation Service.

---

[2026-05-04] [AUTH SERVICE / USER SERVICE / GRPC] [DECISION]

**Problem:** Auth Service nhận `POST /api/v1/auth/login` (cần username, password) nhưng theo `DATABASE_SCHEMA.md` thì `password_hash` và thông tin `users` lại nằm ở `user_db` (thuộc User Service). Auth Service không được phép connect trực tiếp vào `user_db` để verify password.
**Root cause:** Lỗ hổng trong thiết kế giao tiếp ban đầu. `user.proto` hiện tại chỉ có `GetUserProfile(user_id)` và không có cơ chế nào để Auth Service kiểm tra mật khẩu.
**Fix / Decision:** Thêm mới RPC `VerifyCredentials(username, password)` vào `user.proto`. Auth Service sẽ truyền username và plaintext password qua gRPC sang User Service. User Service sẽ tra cứu user, verify bằng bcrypt, nếu hợp lệ sẽ trả về `user_id` và `role`. Sau đó Auth Service mới cấp JWT.
**Lesson / Warning:** Quyết định này giúp giữ nguyên Data Boundary (User Service vẫn làm chủ Identity/Credentials, Auth Service chuyên lo Token Lifecycle) và không làm hỏng migration `user_db` đã hoàn tất ở Day 5. Bắt buộc gọi qua gRPC nội bộ để đảm bảo an toàn.

---

[2026-05-05] [USER SERVICE / MIGRATIONS] [BUG]

**Problem:** User service migrations không tồn tại trong repo — Docker build không có migration C# files, `MigrateAsync()` chạy nhưng không có gì để apply, bảng `users` không được tạo.
**Root cause:** Migration files chưa bao giờ được `git add` và commit. `dotnet ef migrations add` tạo files nhưng chúng nằm trong working directory mà không được stage.
**Fix / Decision:** Chạy lại `dotnet ef migrations add InitialCreate` với appsettings.Development.json point đến native postgres. Files mới tạo ở `UserService.Infrastructure/Migrations/` (không phải `Data/Migrations/`). Apply migration lên native postgres với `dotnet ef database update`.
**Lesson / Warning:** Sau mỗi lần tạo migration, PHẢI `git add services/*/src/*/Migrations/` và commit ngay. Migration files là code, không phải artifacts.

---

[2026-05-05] [ALL SERVICES / POSTGRESQL] [DECISION]

**Problem:** Docker postgres (smartmusic-postgres) không có schema, native Windows postgres (localhost:5432, postgres/4L27hN04@) đã có migrations applied. Hai postgres chạy song song gây nhầm lẫn.
**Root cause:** Migrations trong DEVLOG được chạy trên native postgres, nhưng docker-compose services kết nối đến Docker postgres với user/pass khác.
**Fix / Decision:** Đổi `.env` để auth-service và user-service kết nối native postgres qua `host.docker.internal:5432` với `postgres/4L27hN04@`. Docker postgres vẫn chạy cho các service chưa implement (music, streaming, v.v.).
**Lesson / Warning:** Khi chạy `dotnet ef database update`, PHẢI rõ đang apply lên postgres nào. Kiểm tra `AUTH_DB_CONNECTION` và `USER_DB_CONNECTION` trong `.env` trước khi `docker compose up`.

---

[2026-05-05] [USER SERVICE / AUTH] [DECISION]

**Problem:** User service có `[Authorize]` với JWT Bearer, nhưng API Gateway đã remove Authorization header trước khi forward. User service validate JWT với fallback secret → 401.
**Root cause:** Thiết kế ban đầu dự định user-service validate JWT riêng. Nhưng trong API Gateway pattern, chỉ gateway mới validate JWT — downstream trust headers.
**Fix / Decision:** Thay `AddJwtBearer` bằng custom `GatewayAuthHandler` đọc `X-User-Id` và `X-User-Role` headers từ gateway. Không cần JWT_SECRET trong user-service.
**Lesson / Warning:** Internal services (user, music, streaming, v.v.) KHÔNG cần JWT Bearer auth. Dùng `GatewayAuthHandler` pattern này cho tất cả downstream services khi implement.

---

[2026-05-05] [USER SERVICE / GRPC] [BUG]

**Problem:** gRPC call từ auth-service đến user-service fail với `HTTP_1_1_REQUIRED` — server từ chối HTTP/2 cleartext.
**Root cause:** Kestrel `HttpProtocols.Http1AndHttp2` không support h2c (HTTP/2 cleartext prior knowledge) trong .NET 8. Chỉ support HTTP/2 qua TLS (ALPN). Warning misleading: "HTTP/2 is not enabled" thực chất nghĩa là ALPN không work, không phải h2c.
**Fix / Decision:** Tách port: port 80 dùng `Http1` (REST), port 5300 dùng `Http2` (gRPC h2c). docker-compose expose cả hai ports. Auth-service gRPC client gọi `http://user-service:5300`.
**Lesson / Warning:** Áp dụng pattern này cho MỌI service có gRPC server: REST port 80, gRPC port 5300. Kestrel PHẢI dùng `Http2` (không phải `Http1AndHttp2`) cho port gRPC cleartext.

---

[2026-05-05] [USER SERVICE / EF CORE] [BUG]

**Problem:** Docker build fail với `FileNotFoundException: Microsoft.EntityFrameworkCore.Relational, Version=8.0.26.0` — runtime cần 8.0.26 nhưng publish chỉ có 8.0.11.
**Root cause:** `UserService.Api.csproj` pin `Microsoft.EntityFrameworkCore.Design Version="8.0.0"` (exact) trong khi Infrastructure dùng `8.0.*` resolve 8.0.26. Version mismatch giữa Design và runtime Relational DLL.
**Fix / Decision:** Đổi thành `Version="8.0.*"` để cả hai projects resolve cùng version.
**Lesson / Warning:** KHÔNG pin exact version `8.0.0` cho EF Core packages. Dùng `8.0.*` cho tất cả. Khi build warning nói "conflict between X and Y", đó là dấu hiệu sẽ fail runtime.

---

[2026-05-05] [API GATEWAY / JWT] [DECISION]

**Problem:** Plan ghi Redis blacklist key là `rt:blacklist:{jti}`, nhưng Auth Service thực tế viết key `token:blacklist:{jti}` (trong `RedisCacheService.RevokeTokenInCacheAsync`).
**Root cause:** Spec trong plan không đồng bộ với implementation của Auth Service.
**Fix / Decision:** Gateway đọc `token:blacklist:{jti}` — theo code thực tế của Auth Service, không phải plan. Ưu tiên code thực tế vì Auth Service đã được test và commit.
**Lesson / Warning:** Khi implement service mới cần đọc key từ Redis của service khác, LUÔN kiểm tra code thực tế (grep `StringSetAsync`, `KeyExpireAsync`) thay vì chỉ đọc plan/spec.

---

[2026-05-05] [API GATEWAY / CIRCUIT BREAKER] [DECISION]

**Problem:** Cần chọn giữa Polly và custom implementation cho circuit breaker 2000ms → 503.
**Root cause:** Plan nói "Polly hoặc YARP built-in health checks" nhưng không chỉ định rõ.
**Fix / Decision:** Dùng custom `CircuitBreakerMiddleware` với `Task.WaitAsync(CancellationTokenSource(2000ms))`. Không thêm Polly dependency. Lý do: (1) đủ yêu cầu của project; (2) dễ unit test hơn Polly pipeline; (3) ít dependency hơn.
**Lesson / Warning:** Nếu sau này cần retry/circuit state (half-open, open), lúc đó mới dùng Polly. Hiện tại simple timeout là đủ.

---

[2026-05-05] [API GATEWAY / CIRCUIT BREAKER] [BUG]

**Problem:** Test `InvokeAsync_ClientDisconnects_DoesNotReturn503` fail với `TaskCanceledException` — middleware throw exception khi client disconnect thay vì swallow.
**Root cause:** `catch (OperationCanceledException) when (cts.IsCancellationRequested && !originalAborted.IsCancellationRequested)` — khi client disconnect, cả hai token đều cancelled nên condition là false, exception không được catch.
**Fix / Decision:** Thêm một catch block riêng: `catch (OperationCanceledException) when (originalAborted.IsCancellationRequested)` để swallow client disconnect gracefully. Circuit breaker catch phải đứng SAU.
**Lesson / Warning:** Thứ tự `catch when` rất quan trọng khi dùng linked CancellationTokenSource. Catch client-disconnect trước, circuit breaker sau.

---

[2026-05-05] [INFRA / MINIO / SEED] [DECISION]

**Problem:** Plan W3-4 mô tả dùng LocalStack S3, nhưng docker-compose đã có MinIO (port 9000) là S3-compatible storage. Seed script ban đầu dùng AWS CLI (không có trên Windows).
**Root cause:** Plan được viết trước khi docker-compose được scaffold; MinIO đã được chọn thay LocalStack trong Day 5.
**Fix / Decision:** Không thêm LocalStack — dùng MinIO đã có. Seed script dùng `mc` (MinIO Client) qua `docker exec` thay AWS CLI. Upload file dùng `mc pipe` (stdin) thay `docker cp` vì Git Bash trên Windows convert path `/tmp/` → Windows temp path gây lỗi.
**Lesson / Warning:** Trên Windows Git Bash, `docker cp host:/tmp/file` và `docker exec container cmd /tmp/file` đều bị MSYS convert path. Workaround: dùng `MSYS_NO_PATHCONV=1` hoặc pipe stdin (`cat file | docker exec -i container cmd`).

---

[2026-05-03] [AUTH SERVICE] [FEATURE]

**Problem:** Implement logic cho Auth Service để cấp và xoay vòng Refresh Token an toàn, tích hợp với Redis.
**Root cause:** Yêu cầu bảo mật cao của Smart Music Platform đòi hỏi Refresh Token Rotation (RTR) và track số lần thử đăng nhập.
**Fix / Decision:** 
- Đã thiết lập `AuthDbContext` để kết nối vào `auth_db`. Lưu trữ refresh token mapping với IP sang `inet` bằng value converter.
- Implement các repositories `RefreshTokenRepository` và `TokenBlacklistRepository`.
- Track brute-force login trong Redis: lock account sau 5 lần thất bại.
- Xử lý reuse detection: nếu phát hiện token bị dùng lại, revoke toàn bộ session của user (cập nhật DB + Redis).
- Unit Tests và Integration Tests sử dụng Testcontainers đã hoàn tất và xanh.
**Lesson / Warning:** Tương tác với HTTP-only Cookie cần chú ý khi test: tên cookie có thể khác in hoa/thường tùy vào client/server ("refreshToken", "Secure", "HttpOnly" -> "secure", "httponly"). Testcontainers chạy khá tốt để test end-to-end với PostgreSQL và Redis thực.

---

[2026-05-05] [MUSIC SERVICE / API CONTRACT] [DECISION]

**Problem:** Khi chuẩn bị implement Music Service, phát hiện một số endpoint trong `API_DESIGN_V2.md` chưa hoàn toàn khớp với checklist chi tiết (thiếu mã lỗi 503 cho S3, response format batch API chưa chuẩn).
**Root cause:** Tài liệu design tổng quan đôi khi bị thiếu sót edge cases.
**Fix / Decision:** Chủ động cập nhật `API_DESIGN_V2.md` trước khi viết code để đảm bảo Single Source of Truth luôn chính xác và Code tuân thủ đúng rule `api-contract-first`.
**Lesson / Warning:** Luôn đối chiếu kỹ `API_DESIGN_V2.md` và tạo Checklist 8 điểm. Nếu thấy thiếu sót (đặc biệt là 503 cho external dependencies), hãy cập nhật tài liệu trước.

---

[2026-05-05] [MUSIC SERVICE / INFRASTRUCTURE] [DECISION]

**Problem:** MinIO chạy cục bộ không support Virtual Hosted-style URLs tốt nếu không setup DNS chuẩn (gây lỗi khi AWS SDK S3 gọi `bucket.localhost:9000`).
**Fix / Decision:** Cấu hình `AmazonS3Config.ForcePathStyle = true` khi register `IAmazonS3` trong DI container để SDK gọi S3 theo kiểu Path-style (`localhost:9000/bucket`).

---
