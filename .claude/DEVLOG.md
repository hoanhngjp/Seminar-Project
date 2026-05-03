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
