# Changelog — Smart Music Streaming Platform

**Mục đích:** Ghi lại toàn bộ thay đổi có ý nghĩa của dự án theo từng milestone.
Tài liệu này dành cho: thầy hướng dẫn, hội đồng bảo vệ, và thành viên nhóm.

**Cách cập nhật:**
1. Mỗi khi hoàn thành một feature/fix/task đáng kể, thêm entry vào section `[Unreleased]`.
2. Khi kết thúc một milestone (Week 2, Week 3-4, ...), chuyển nội dung từ `[Unreleased]`
   xuống section milestone tương ứng và ghi ngày hoàn thành.
3. Dùng 4 sub-sections: **Added** (tính năng mới), **Changed** (thay đổi existing),
   **Fixed** (sửa lỗi), **Removed** (xóa/loại bỏ).
4. Viết bằng tiếng Anh hoặc tiếng Việt — nhất quán trong một entry.
5. Mỗi dòng: mô tả ngắn gọn + service liên quan trong ngoặc, ví dụ:
   `- JWT refresh token rotation with reuse detection (Auth Service)`

Format chuẩn: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

---

## [Unreleased]

### Added

### Changed

### Fixed

### Removed

---

## [Day 5] — 2026-05-03

> **Milestone:** Project scaffold — tất cả services build thành công, `GET /health` → 200.
> Checkpoint: 21 containers Up, 0 exited; tất cả 10 services `GET /health` → 200.

### Added
- Boilerplate cho 9 C# services theo Clean Architecture (Api / Application / Infrastructure / Domain):
  api-gateway, auth-service, user-service, music-service, streaming-service,
  listening-party-service, analytics-service, notification-service, search-service
- `GET /health` → 200 cho toàn bộ 9 C# services và Recommendation Service
- `CorrelationIdMiddleware` cài sẵn trên mọi C# service
- Boilerplate Recommendation Service (Python FastAPI) — `uvicorn` chạy được
- Boilerplate Frontend SPA (React + TypeScript + Vite) — `npm run dev` hiển thị "Smart Music Platform"
- `docker-compose up --build` — 21 containers healthy, 0 exited

### Fixed
- Pin `Microsoft.EntityFrameworkCore Version="8.0.*"` — mặc định `Version="*"` resolve 10.x không tương thích net8.0
- Pin `Microsoft.AspNetCore.Mvc.Testing Version="8.0.*"` — cùng lý do
- Pin `FluentAssertions` và `Moq` về version cụ thể trong tất cả test projects
- Thêm `ASPNETCORE_HTTP_PORTS=80` vào docker-compose cho tất cả C# services — .NET 8 đổi default port từ 80 → 8080
- Sửa build context từ `./services/X` → `../services/X` trong docker-compose (relative từ `infra/`)
- Xóa `UseHttpsRedirection` khỏi pipeline — không cần trong container, chỉ HTTP

### Changed
- YARP config yêu cầu placeholder `ReverseProxy: { Routes: {}, Clusters: {} }` trong `appsettings.json` để service start được

---

## [Week 2] — _(chưa hoàn thành)_

> **Milestone:** Login flow end-to-end — React SPA → API Gateway → Auth Service → JWT về browser.
> Chi tiết: `.claude/plan/week2_auth_user_gateway.md`

### Added

- [ ] gRPC codegen từ `proto/auth.proto` + `proto/user.proto`
- [ ] User Service: profile CRUD, PostgreSQL (`user_db`)
- [ ] Auth Service: JWT login/refresh/logout, brute-force lock, Refresh Token rotation
- [ ] API Gateway: YARP routing, JWT validation middleware, rate limiting (Redis)
- [ ] `POST /api/v1/auth/login` → accessToken + HTTP-only refresh cookie
- [ ] `POST /api/v1/auth/refresh` → token rotation
- [ ] `POST /api/v1/auth/logout` → blacklist token in Redis
- [ ] `GET /api/v1/users/me` → profile từ Redis cache (TTL 15 min)
- [ ] `POST /api/v1/users/me/preferences` → lưu genre/artist weights vào Redis Hash

### Changed

### Fixed

### Removed

---

## [Week 3-4] — _(chưa hoàn thành)_

> **Milestone:** Listener nghe nhạc end-to-end — Creator upload → pre-signed URL → play audio.
> Chi tiết: `.claude/plan/week3_4_music_streaming_recommendation.md`

### Added

- [ ] LocalStack S3 setup + seed bucket trong `docker-compose.yml`
- [ ] Music Service: upload metadata, lưu storage key, publish `New_Release` Kafka event
- [ ] `POST /api/v1/music/songs` — upload audio (validate MIME, max 50 MB, S3-first atomicity)
- [ ] `GET /api/v1/music/songs/{songId}` — Redis cache TTL 30 min
- [ ] Streaming Service: generate pre-signed URL (expiry 900s), HTTP Range support
- [ ] `GET /api/v1/streaming/{songId}/url` → pre-signed URL
- [ ] `GET /api/v1/streaming/{songId}/chunk` → CDN redirect
- [ ] Recommendation Service (Python FastAPI): Rule Engine scoring
  - `final_score = base_score + context_bonus + preference_bonus − skip_penalty`
  - Kafka consumers: `Song_Played`, `Song_Skipped`, `User_Preferences_Updated`
  - Fallback: Top 50 Trending từ Redis Sorted Set
- [ ] `GET /api/v1/recommendations` — context-aware, fallback on timeout (300 ms)
- [ ] `POST /api/v1/recommendations/feedback` — async 202
- [ ] Internal API: `GET /internal/songs/batch?ids=...` (Music Service → Recommendation)

### Changed

### Fixed

### Removed

---

## [Week 5-6] — _(chưa hoàn thành)_

> **Milestone:** Creator thấy heatmap skip-rate; search fuzzy hoạt động; notification fan-out.
> Chi tiết: `.claude/plan/week5_6_search_analytics_notification.md`

### Added

- [ ] Elasticsearch index setup + seed 10 songs
- [ ] Search Service: fuzzy search, `GET /api/v1/search` (fallback: `[]` không throw)
- [ ] Analytics Service: Kafka consumers (`Song_Played`, `Song_Skipped`, `Notification_Sent`)
  - InfluxDB write — chỉ lưu `userId` UUID, không PII
  - Idempotency dedup via Redis SET (TTL 24 h)
- [ ] `POST /api/v1/analytics/events/play` — async 202, local disk queue fallback
- [ ] `GET /api/v1/analytics/creator/heatmap/{songId}` — ownership check
- [ ] `GET /api/v1/analytics/creator/stats/{songId}` — ownership check
- [ ] Notification Service: MongoDB fan-out, Kafka consumer `New_Release`
- [ ] `GET /api/v1/notifications/unread`
- [ ] `PATCH /api/v1/notifications/{id}/read`
- [ ] `PATCH /api/v1/notifications/read-all` — background async
- [ ] Kafka wiring verify: tất cả 5 consumer groups hoạt động

### Changed

### Fixed

### Removed

---

## [Week 7-9] — _(chưa hoàn thành)_

> **Milestone:** Login → Play nhạc → Tạo party → Bạn join → sync realtime.
> Chi tiết: `.claude/plan/week7_9_frontend_listening_party.md`

### Added

**Frontend (React SPA):**
- [ ] Login page + JWT in-memory storage (không localStorage)
- [ ] Audio Player component — HTTP Range streaming
- [ ] Home page: recommendations + search
- [ ] Creator Dashboard: heatmap + stats
- [ ] Notification bell (polling / SSE)
- [ ] Listening Party UI: tạo room, join, sync player

**Listening Party Service:**
- [ ] `POST /api/v1/parties` — tạo room, sinh joinCode
- [ ] `POST /api/v1/parties/{joinCode}/join`
- [ ] SignalR hub: `PLAYER_ACTION`, `SYNC_STATE`, `MEMBER_JOIN`, `MEMBER_LEAVE`
- [ ] Reconnect với Exponential Backoff
- [ ] TypeScript interfaces export: `services/frontend/src/types/listening-party.ts`

### Changed

### Fixed

### Removed

---

## [Week 10-12] — _(chưa hoàn thành)_

> **Milestone:** Polish, observability, load testing, demo preparation.
> Chi tiết: `.claude/plan/week10_12_polish_demo.md`

### Added

- [ ] Prometheus metrics: `api_request_duration_seconds`, `kafka_consumer_lag`,
  `recommendation_ctr`, `http_requests_total` trên mọi service
- [ ] Grafana dashboard: latency p95, Kafka lag, CTR
- [ ] k6 load tests: Gateway, Streaming, Search, Recommendation, Analytics Heatmap
- [ ] Chaos tests: Kafka down → local disk queue; Redis down → Trending fallback;
  CDN fail → secondary CDN; Auth down → 503 sau 60 s
- [ ] AC Coverage Matrix hoàn chỉnh (46 ACs)
- [ ] Demo script + seed data đầy đủ

### Changed

### Fixed

### Removed
