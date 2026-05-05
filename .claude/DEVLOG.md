# DEVLOG — Smart Music Streaming Platform

**Dành cho:** nhóm dev + Claude (đọc khi debug để tránh lặp lại vấn đề cũ).

**Khi nào ghi:**
- Bug mất > 30 phút mới tìm ra nguyên nhân
- Quyết định kỹ thuật quan trọng (chọn A thay vì B, và tại sao)
- Workaround/hack đang dùng tạm — để người khác không "fix" nó thành broken
- Gotcha với infrastructure local (Docker, Kafka, Redis, MinIO)

**Format mỗi entry:**
```
---
[YYYY-MM-DD] [SERVICE/LAYER] [LOẠI: BUG | DECISION | BLOCKER | NOTE]

**Problem:** Mô tả vấn đề — triệu chứng quan sát được
**Root cause:** Tại sao xảy ra
**Fix / Decision:** Cách giải quyết
**Lesson / Warning:** Điều cần nhớ / tránh lặp lại
---
```

---

## Entries

---

[2026-05-03] [USER SERVICE / EF CORE / INTEGRATION TESTS] [BUG]

**Problem:** `dotnet test` throws `InvalidOperationException: Relational-specific methods can only be used when the context is using a relational database provider` trong `DbInitializer.SeedAsync`.
**Root cause:** `TestWebApplicationFactory` override `DbContext` dùng `InMemoryDatabase`, nhưng `DbInitializer` gọi `await db.Database.MigrateAsync()` — method này chỉ chạy được với relational provider.
**Fix / Decision:** Thêm `if (db.Database.IsRelational())` check trước `MigrateAsync()`. Fallback dùng `EnsureCreatedAsync()` cho InMemory tests.
**Lesson / Warning:** Luôn check `IsRelational()` trong seed/initializer nếu project dùng InMemory database cho integration tests.

---

[2026-05-03] [USER SERVICE / EF CORE / MIGRATION] [BUG]

**Problem:** `dotnet ef database update` fails với `password authentication failed for user "smartmusic"` dù `.env` đã cấu hình.
**Root cause:** Native Windows Postgres (port 5432) intercept connection thay vì Docker container. Native postgres dùng username `postgres`, password `4L27hN04@`.
**Fix / Decision:** Cập nhật `appsettings.json` connection string: `Host=localhost;Port=5432;Database=user_db;Username=postgres;Password=4L27hN04@`.
**Lesson / Warning:** Cẩn thận port collision giữa Docker services và Windows native services. Khi migration fail với auth error, check xem đang connect vào postgres nào.

---

[2026-05-03] [ALL C# SERVICES] [BUG]

**Problem:** `dotnet build` thất bại sau scaffold — EF Core, MVC Testing, FluentAssertions, Moq đều resolve version 10.x.
**Root cause:** NuGet `Version="*"` lấy latest stable — tại thời điểm này là 10.x, không tương thích `net8.0`.
**Fix / Decision:** Pin cứng version: `EF Core 8.0.*`, `Mvc.Testing 8.0.*`, `FluentAssertions 6.12.*`, `Moq 4.20.*`, `Testcontainers 3.8.*`.
**Lesson / Warning:** KHÔNG dùng `Version="*"` cho bất kỳ package Microsoft.* nào. Khi thêm package mới, kiểm tra `<TargetFramework>` rồi chọn version major tương ứng.

---

[2026-05-03] [ALL C# SERVICES / DOCKER] [BUG]

**Problem:** Tất cả C# containers exit ngay sau start — log: `Failed to bind to address http://[::]:80`.
**Root cause:** .NET 8 đổi default HTTP port từ 80 → 8080. Container lắng nghe 8080 nhưng docker-compose expose 80.
**Fix / Decision:** Thêm `ASPNETCORE_HTTP_PORTS=80` vào environment của mỗi C# service trong docker-compose.
**Lesson / Warning:** Áp dụng cho tất cả C# service mới. Nếu thấy container exit code 1 ngay sau start mà không có error rõ → check port binding trước.

---

[2026-05-03] [API GATEWAY / YARP] [BUG]

**Problem:** api-gateway container crash với `InvalidOperationException` khi start — YARP không tìm thấy config `ReverseProxy`.
**Root cause:** YARP bắt buộc có section `ReverseProxy` trong `appsettings.json` khi `LoadFromConfig(...)` được gọi, dù chưa có route thật.
**Fix / Decision:** Thêm placeholder vào `appsettings.json`: `"ReverseProxy": { "Routes": {}, "Clusters": {} }`.
**Lesson / Warning:** Khi implement YARP routes, update trực tiếp vào object đó — không xóa placeholder vì YARP throw nếu section missing.

---

[2026-05-03] [INFRA / DOCKER-COMPOSE] [BUG]

**Problem:** `docker-compose up --build` báo `unable to prepare context: path not found` cho tất cả C# services.
**Root cause:** `docker-compose.yml` nằm trong `infra/`, build context `./services/X` resolve từ `infra/` nên không tìm thấy.
**Fix / Decision:** Đổi tất cả build contexts sang `../services/X` (relative từ `infra/`).
**Lesson / Warning:** Khi thêm service mới vào docker-compose, luôn dùng `../services/<tên-service>` làm context.

---

[2026-05-04] [RECOMMENDATION SERVICE / KAFKA] [NOTE]

**Problem:** `Song_Played` consumer nhận duplicate events sau khi restart container — cùng event được process 2 lần, làm tăng sai preference weight.
**Root cause:** Kafka consumer group offset chưa commit trước khi container bị kill. Khi restart, consumer đọc lại từ offset chưa commit.
**Fix / Decision:** Idempotency dedup via Redis SET NX, key `rec:idempotency:{event_id}`, TTL 24h. Event đã có key → skip.
**Lesson / Warning:** KHÔNG tắt idempotency check dù "chỉ để test local". Áp dụng cho tất cả 5 Kafka topics. Chạy `infra/verify-infra.sh` sau mỗi lần reset infrastructure.

---

[2026-05-04] [STREAMING SERVICE / S3] [DECISION]

**Problem:** Nên generate pre-signed URL ở Streaming Service hay API Gateway?
**Root cause:** Kiến trúc chưa rõ ràng về ai là owner của S3 access logic.
**Fix / Decision:** Pre-signed URL chỉ được generate ở Streaming Service. API Gateway không có business logic; expiry 900s là business rule của Streaming.
**Lesson / Warning:** Nếu sau này thêm CDN signed URL (CloudFront), logic vẫn ở Streaming Service — chỉ thay signing method.

---

[2026-05-04] [AUTH SERVICE / USER SERVICE / GRPC] [DECISION]

**Problem:** Auth Service cần verify password nhưng `password_hash` nằm ở `user_db` (User Service). Auth Service không được connect trực tiếp `user_db`.
**Root cause:** `user.proto` ban đầu chỉ có `GetUserProfile(user_id)`, không có cơ chế verify credentials.
**Fix / Decision:** Thêm RPC `VerifyCredentials(username, password)` vào `user.proto`. Auth Service gọi qua gRPC → User Service verify bcrypt → trả về `user_id` + `role` → Auth Service mới cấp JWT.
**Lesson / Warning:** Giữ nguyên Data Boundary: User Service làm chủ Identity/Credentials, Auth Service chuyên Token Lifecycle.

---

[2026-05-05] [USER SERVICE / MIGRATIONS] [BUG]

**Problem:** User service migrations không tồn tại trong repo — Docker build không có migration C# files, `MigrateAsync()` chạy nhưng không có gì apply, bảng `users` không được tạo.
**Root cause:** Migration files chưa bao giờ được `git add` và commit sau khi `dotnet ef migrations add`.
**Fix / Decision:** Chạy lại `dotnet ef migrations add InitialCreate`, git add `UserService.Infrastructure/Migrations/`, commit ngay.
**Lesson / Warning:** Sau mỗi lần tạo migration, PHẢI `git add services/*/src/*/Migrations/` và commit ngay. Migration files là code, không phải artifacts.

---

[2026-05-05] [ALL SERVICES / POSTGRESQL] [DECISION]

**Problem:** Docker postgres và native Windows postgres chạy song song gây nhầm lẫn — migrations apply vào postgres sai.
**Root cause:** `dotnet ef database update` chạy từ Windows host connect native postgres (`localhost:5432`), nhưng containers connect Docker postgres (khác credentials).
**Fix / Decision:** Dùng native postgres (`postgres/4L27hN04@`) cho tất cả migrations và integration tests. Services trong Docker connect qua `host.docker.internal:5432`.
**Lesson / Warning:** Khi chạy `dotnet ef database update`, phải rõ đang apply lên postgres nào. Kiểm tra connection string trong `appsettings.json` trước.

---

[2026-05-05] [ALL DOWNSTREAM SERVICES] [DECISION]

**Problem:** Downstream services (music, streaming, recommendation...) dùng `[Authorize]` với JWT Bearer — fail vì API Gateway đã remove Authorization header trước khi forward.
**Root cause:** Trong API Gateway pattern, chỉ Gateway validate JWT. Downstream nhận `X-User-Id` và `X-User-Role` headers do Gateway inject.
**Fix / Decision:** Tất cả downstream services dùng `GatewayAuthHandler` — trust `X-User-Id`/`X-User-Role` headers, không re-validate JWT. Pattern này áp dụng cho mọi service implement sau: music, streaming, analytics, notification, search, listening-party.
**Lesson / Warning:** KHÔNG thêm JWT Bearer vào downstream services. Không cần `JWT_SECRET` trong env của downstream.

---

[2026-05-05] [USER SERVICE / GRPC] [BUG]

**Problem:** gRPC call từ auth-service đến user-service fail với `HTTP_1_1_REQUIRED`.
**Root cause:** Kestrel `HttpProtocols.Http1AndHttp2` không support h2c (HTTP/2 cleartext) trong .NET 8. Chỉ support HTTP/2 qua TLS (ALPN).
**Fix / Decision:** Tách port: port 80 dùng `Http1` (REST), port 5300 dùng `Http2` (gRPC h2c). Docker-compose expose cả hai. Auth-service gọi `http://user-service:5300`.
**Lesson / Warning:** Pattern này áp dụng cho MỌI service có gRPC server: REST port 80, gRPC port 5300. PHẢI dùng `Http2` (không phải `Http1AndHttp2`) cho gRPC port.

---

[2026-05-05] [USER SERVICE / EF CORE] [BUG]

**Problem:** Docker build fail với `FileNotFoundException: Microsoft.EntityFrameworkCore.Relational, Version=8.0.26.0`.
**Root cause:** `UserService.Api.csproj` pin `EF Core Design Version="8.0.0"` (exact) trong khi Infrastructure dùng `8.0.*` → resolve 8.0.26. Version mismatch giữa Design và Relational DLL.
**Fix / Decision:** Đổi thành `Version="8.0.*"` để cả hai projects resolve cùng version.
**Lesson / Warning:** KHÔNG pin exact version `8.0.0` cho EF Core packages. Dùng `8.0.*` cho tất cả. Build warning về conflict thường báo hiệu runtime failure.

---

[2026-05-05] [API GATEWAY / JWT] [DECISION]

**Problem:** Plan ghi Redis blacklist key là `rt:blacklist:{jti}`, nhưng Auth Service thực tế viết `token:blacklist:{jti}`.
**Root cause:** Spec trong plan không đồng bộ với implementation.
**Fix / Decision:** Gateway đọc `token:blacklist:{jti}` — theo code thực tế Auth Service, không theo plan.
**Lesson / Warning:** Khi implement service cần đọc Redis key của service khác, grep code thực tế (`StringSetAsync`, `KeyExpireAsync`) thay vì chỉ đọc plan.

---

[2026-05-05] [API GATEWAY / CIRCUIT BREAKER] [BUG]

**Problem:** Test `InvokeAsync_ClientDisconnects_DoesNotReturn503` fail — middleware throw `TaskCanceledException` khi client disconnect thay vì swallow.
**Root cause:** `catch (OperationCanceledException) when (cts.IsCancellationRequested && !originalAborted.IsCancellationRequested)` — khi client disconnect, cả hai token đều cancelled → condition false → exception không được catch.
**Fix / Decision:** Thêm catch block riêng: `catch (OperationCanceledException) when (originalAborted.IsCancellationRequested)` để swallow client disconnect. Circuit breaker catch đứng SAU.
**Lesson / Warning:** Thứ tự `catch when` rất quan trọng với linked CancellationTokenSource. Client-disconnect catch phải đứng trước circuit-breaker catch.

---

[2026-05-05] [MUSIC SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Integration tests dùng `EnsureCreatedAsync` + schema isolation — schema mới không được tạo vì database đã tồn tại.
**Root cause:** `EnsureCreatedAsync` là no-op khi database đã exist, bất kể schema state. Hai vấn đề: (1) Docker postgres intercept connection; (2) `EnsureCreated` không tạo schema mới trong existing DB.
**Fix / Decision:** Integration tests dùng native postgres (`postgres/4L27hN04@`, `music_db` đã tồn tại). Bỏ schema isolation — mỗi test seed data riêng và cleanup trong `DisposeAsync`. Thêm `Pooling=false` vào connection string.
**Lesson / Warning:** Không dùng `EnsureCreatedAsync` cho schema isolation với pre-existing database. Dùng cleanup-based isolation thay thế.

---

[2026-05-05] [MUSIC SERVICE / API RESPONSE] [DECISION]

**Problem:** `ApiResponse<T>` dùng `Error: string?`, thiếu `meta` fields đúng contract. `POST /music/songs` trả 200 thay vì 201.
**Fix / Decision:** Rewrite `ApiResponse<T>` với `ApiError(Code, Message)` record và `ApiMeta` class. POST upload trả 201. `cache` field chỉ xuất hiện cho endpoints có caching.
**Lesson / Warning:** Kiểm tra `ApiResponse` shape theo `api-contract-first/RULE.md` trước khi viết bất kỳ controller nào.

---

[2026-05-05] [MUSIC SERVICE / CLEAN ARCHITECTURE] [DECISION]

**Problem:** `SongService` (Application layer) import `StackExchange.Redis` và `IConfiguration` — infrastructure concerns leak vào Application.
**Fix / Decision:** Tạo `ISongCache` abstraction ở Application, implement `RedisSongCache` ở Infrastructure. `IStorageService` thêm `BucketName` property để Application không cần `IConfiguration`.
**Lesson / Warning:** Application layer KHÔNG được reference Infrastructure packages. Nếu service cần config hoặc external clients, thêm typed abstraction vào `Application/Interfaces`.

---

[2026-05-05] [INFRA / MINIO / SEED] [DECISION]

**Problem:** Plan W3-4 mô tả dùng LocalStack S3, nhưng docker-compose đã có MinIO (port 9000).
**Fix / Decision:** Không thêm LocalStack — dùng MinIO đã có. Seed script dùng `mc` (MinIO Client) qua `docker exec` thay AWS CLI. Upload dùng `mc pipe` (stdin) vì Git Bash trên Windows convert path gây lỗi.
**Lesson / Warning:** Trên Windows Git Bash, `docker cp` và `docker exec` với path `/tmp/` bị MSYS convert. Workaround: `MSYS_NO_PATHCONV=1` hoặc pipe stdin.

---

[2026-05-05] [STREAMING SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Test `GetChunk_WithRangeHeader_Returns206PartialContent` fails — `Content-Range` không tìm thấy trong `response.Headers`.
**Root cause:** `Content-Range` là content header theo RFC 7233. .NET `HttpClient` phân loại nó vào `response.Content.Headers`, không phải `response.Headers`.
**Fix / Decision:** Đổi assertion sang `response.Content.Headers.Should().ContainKey("Content-Range")`.
**Lesson / Warning:** Check `response.Content.Headers` cho content headers (Content-Range, Content-Type, Content-Length). Dùng `response.Headers` cho response headers (X-Correlation-Id, Set-Cookie, Location).

---

[2026-05-05] [STREAMING SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Test `GetChunk_WithInvalidRangeHeader_Returns416` throws `HttpHeaderParser.ParseValue` exception khi thêm `Range: invalid-range`.
**Root cause:** `HttpRequestMessage.Headers.Add("Range", ...)` validate format theo RFC. String `"invalid-range"` không hợp lệ → exception ở client side trước khi gửi request.
**Fix / Decision:** Dùng `request.Headers.TryAddWithoutValidation("Range", "invalid-range")` để bypass validation.
**Lesson / Warning:** Khi test edge case với invalid headers, dùng `TryAddWithoutValidation` thay vì `Add`.

---

[2026-05-05] [STREAMING SERVICE] [DECISION]

**Problem:** Chunk endpoint cần chọn: proxy S3 bytes trực tiếp hay redirect về CDN URL.
**Fix / Decision:** S3 proxy — Streaming Service fetch bytes bằng `GetObjectRequest` với `ByteRange`, stream qua `Response.Body`. Không cần CDN cho local dev MinIO.
**Lesson / Warning:** Proxy đơn giản cho local dev nhưng tốn bandwidth ở service layer. Nếu cần scale, thêm CDN redirect ở `/url` endpoint, giữ `/chunk` như backup.

---

[2026-05-05] [RECOMMENDATION SERVICE / PYPROJECT] [BUG]

**Problem:** `pytest` fails với `Invalid statement (at line 1, column 1)` khi đọc `pyproject.toml`.
**Root cause:** File `pyproject.toml` và `pytest.ini` được tạo với UTF-8 BOM (`\xef\xbb\xbf`). TOML parser không chấp nhận BOM.
**Fix / Decision:** Dùng Write tool để overwrite — ghi UTF-8 không BOM. Xóa `pytest.ini` cũ, chuyển config sang `[tool.pytest.ini_options]` trong `pyproject.toml`.
**Lesson / Warning:** File config (`.toml`, `.ini`, `.cfg`) có nguy cơ BOM nếu tạo bởi Windows tools. Khi gặp parse error lạ ở dòng 1 column 1: `python -c "open('f','rb').read(4)"` để check BOM.

---

[2026-05-05] [RECOMMENDATION SERVICE / SETUPTOOLS] [BUG]

**Problem:** `pip install -e .` fails với `BackendUnavailable: Cannot import 'setuptools.backends.legacy'`.
**Root cause:** `setuptools.backends.legacy:build` là backend mới từ setuptools 69+. Venv dùng version cũ hơn.
**Fix / Decision:** Đổi `build-backend` sang `"setuptools.build_meta"` — backend chuẩn, tương thích rộng hơn.
**Lesson / Warning:** Dùng `"setuptools.build_meta"` cho tất cả Python projects. `setuptools.backends.legacy` chỉ dùng khi chắc setuptools >= 69.

---

[2026-05-05] [RECOMMENDATION SERVICE] [DECISION]

**Problem:** IDE VS Code Pylance báo `Cannot find module 'fastapi'`, `Cannot find module 'redis.asyncio'` trên tất cả Python files.
**Root cause:** IDE dùng global Python interpreter (`E:\Python311`) thay vì `.venv`. Packages chỉ install vào `.venv`.
**Fix / Decision:** Không sửa code — đây là IDE config issue. Tests chạy đúng với `.venv/Scripts/python -m pytest`. Fix IDE: chọn interpreter `.venv/Scripts/python.exe` trong VS Code Python extension.
**Lesson / Warning:** Khi thấy "Cannot find module X" trong IDE nhưng tests pass → interpreter mismatch, không phải code bug. Không commit workaround chỉ để làm IDE happy.

---
