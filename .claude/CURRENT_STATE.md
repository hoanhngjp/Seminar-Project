# CURRENT_STATE.md — Trạng thái thực thi Smart Music Platform

> File này do nhóm tự cập nhật sau mỗi ngày làm việc.
> Các plan files gốc: `.claude/plan/` (7 files — đọc file tương ứng với phase hiện tại).

---

## Trạng thái hiện tại

- **Phase:** Week 7–9 — Frontend + Listening Party (đang thực hiện — Tuần 7 xong)
- **Tuần tiếp theo:** Tuần 8 — HomePage + SearchPage + SignalR PartyHub
- **Ngày làm việc gần nhất:** 2026-05-07 (Tuần 9 hoàn thành)

---

## Đã hoàn thành

### Pre-Day 5 — Setup

- [X] Documentation: PRD V5, Backlog V7, API Design V2, Use Cases V1
- [X] Repo structure: SmartMusic.sln, folder scaffold, .gitignore
- [X] Infrastructure local: docker-compose.yml, .env.example, verify-infra.sh
- [X] Architecture docs: system diagrams, sequence diagrams, use case diagrams
- [X] Contracts: GRPC_CONTRACTS.md, KAFKA_EVENT_CONTRACTS.md, kafka-schemas/
- [X] Database schema: DATABASE_SCHEMA.md
- [X] Execution plans: .claude/plan/ (7 files)

### Day 5 — Boilerplate

- [X] api-gateway boilerplate — GET /health → 200
- [X] auth-service boilerplate — GET /health → 200
- [X] user-service boilerplate — GET /health → 200
- [X] music-service boilerplate — GET /health → 200
- [X] streaming-service boilerplate — GET /health → 200
- [X] listening-party-service boilerplate — GET /health → 200
- [X] analytics-service boilerplate — GET /health → 200
- [X] notification-service boilerplate — GET /health → 200
- [X] search-service boilerplate — GET /health → 200
- [X] recommendation-service boilerplate — GET /health → 200
- [X] React SPA boilerplate — npm run dev hiển thị "Smart Music Platform"
- [X] docker-compose up --build — không có container exit

### Week 2 — Auth + User + Gateway

- [X] Bước 0: generate C# từ proto/auth.proto và proto/user.proto
- [X] Bước 0: grpcurl test gRPC connection pass
- [X] User Service: EF Core migration InitialCreate (user_db)
- [X] User Service: GET /api/v1/users/me
- [X] User Service: POST /api/v1/users/me/preferences
- [X] User Service: gRPC server GetUserProfile + VerifyCredentials
- [X] User Service: Internal GET /internal/users/{id}/preferences
- [X] Auth Service: EF Core migration InitialCreate (auth_db)
- [X] Auth Service: POST /api/v1/auth/login
- [X] Auth Service: POST /api/v1/auth/refresh
- [X] Auth Service: POST /api/v1/auth/logout
- [X] API Gateway: YARP routing 9 routes
- [X] API Gateway: JWT Validation Middleware
- [X] API Gateway: Rate Limiting Middleware (Redis)
- [X] API Gateway: Circuit Breaker (2000ms → 503)
- [X] Checkpoint W2: login flow end-to-end pass

### Week 3–4 — Music + Streaming + Recommendation

- [X] Seed script: infra/seed/s3_seed.sh — bucket smartmusic-audio + test-song-001 upload (MinIO)
- [X] Seed script: infra/seed/redis_seed.sh — 50 trending songs trong rec:trending:global
- [X] Music Service: EF Core migration InitialCreate (music_db — 5 tables)
- [X] Music Service: S3StorageService (MinIO AWS SDK) + KafkaEventPublisher (Confluent.Kafka)
- [X] Music Service: POST /api/v1/music/songs (Creator only, S3-first atomicity, Exp Backoff)
- [X] Music Service: GET /api/v1/music/songs/{songId} — Redis cache TTL 30m, GatewayAuth
- [X] Music Service: Internal GET /internal/songs/{songId}/storage-key
- [X] Music Service: Internal GET /internal/songs/batch
- [X] Music Service: Tests 15/15 xanh
- [X] Streaming Service: GET /api/v1/streaming/{songId}/url (pre-signed URL 900s, AC3.1.3)
- [X] Streaming Service: GET /api/v1/streaming/{songId}/chunk (206 Partial Content, AC3.1.2)
- [X] Streaming Service: Tests 15/15 xanh
- [X] Recommendation Service: Rule Engine scoring (pure Python, AC2.1.1, AC2.1.4, AC2.1.5)
- [X] Recommendation Service: GET /api/v1/recommendations (fallback chain + cache)
- [X] Recommendation Service: POST /api/v1/recommendations/feedback (async 202)
- [X] Recommendation Service: Kafka consumer Song_Played (AC2.2.1)
- [X] Recommendation Service: Kafka consumer Song_Skipped (AC2.2.2)
- [X] Recommendation Service: Kafka consumer User_Preferences_Updated
- [X] Recommendation Service: Tests 42/42 xanh
- [ ] Checkpoint W4: play 1 bài nhạc end-to-end pass _(chờ verify)_

### Week 5–6 — Search + Analytics + Notification

- [X] Elasticsearch index mapping songs tạo xong
- [X] Seed script: infra/seed/elasticsearch_seed.sh (10 songs — Sơn Tùng, Chillies, Ngọt, Vũ.)
- [X] Search Service: GET /api/v1/search — 20/20 tests xanh
- [X] Analytics Service: POST /api/v1/analytics/events/play — 202 async, idempotency 24h
- [X] Analytics Service: GET /api/v1/analytics/creator/heatmap/{songId} — ownership check, Redis cache 6h
- [X] Analytics Service: GET /api/v1/analytics/creator/stats/{songId} — Redis cache 6h
- [X] Analytics Service: Kafka consumer Song_Played → InfluxDB (idempotency dedup)
- [X] Analytics Service: Kafka consumer Song_Skipped → InfluxDB
- [X] Analytics Service: Kafka consumer Notification_Sent → counter
- [X] Notification Service: GET /api/v1/notifications/unread
- [X] Notification Service: PATCH /api/v1/notifications/{id}/read
- [X] Notification Service: PATCH /api/v1/notifications/read-all
- [X] Notification Service: Kafka consumer New_Release → fan-out (full cursor loop, batch 500)
- [X] User Service: GET /internal/artists/{artistId}/followers (cursor pagination)
- [ ] Kafka wiring: consumer groups hoạt động, DLQ topics tồn tại
- [ ] Checkpoint W6: Creator thấy heatmap sau play/skip events

### Week 7–9 — Frontend + Listening Party

- [X] Track A W7: LoginPage
- [X] Track A W7: AudioPlayer component
- [X] Track B W7: POST /api/v1/parties
- [X] Track B W7: POST /api/v1/parties/{joinCode}/join
- [X] SYNC POINT W7: services/frontend/src/types/listening-party.ts tạo xong
- [X] Track A W8: HomePage (recommendations list) — 19/19 tests xanh
- [X] Track A W8: SearchPage — 23/23 tests xanh
- [X] Track B W8: SignalR PartyHub (PLAYER_ACTION, SYNC_STATE) — 38/38 tests xanh
- [X] Track A W9: CreatorDashboardPage — 10/10 tests xanh
- [X] Track A W9: NotificationBell component — 13/13 tests xanh
- [X] Track B W9: Reconnect + resync logic (đã có từ Tuần 8 — OnConnected/OnDisconnected)
- [X] Track A+B W9: usePartyWebSocket hook (SignalR thật, @microsoft/signalr) — 14/14 tests xanh
- [ ] Checkpoint W9: 2-tab test — Host Play → Member sync < 500ms

### Frontend Redesign — Spotify Design System

- [X] Phase 1: Design tokens (`src/styles/tokens.ts`) + Global CSS reset (`index.css`) + playerStore (`src/store/playerStore.ts`)
- [ ] Phase 2: AppShell layout (sidebar + bottom player bar)
- [ ] Phase 3: Restyle pages (LoginPage, HomePage, SearchPage, CreatorDashboardPage)
- [ ] Phase 4: Restyle components (AudioPlayer, NotificationBell)
- [ ] Phase 5: PartyPage mới
- [ ] Phase 6: Update tests (playerStore reset, renderWithShell)

### Week 10–12 — Polish + Demo

- [X] Prometheus metrics expose trên tất cả services (prometheus-net 8.2 + fastapi-instrumentator 6.1)
- [X] Grafana dashboard: 4 panels (latency, streaming, kafka lag, CTR) — `infra/grafana/dashboards/smart-music.json`
- [X] k6 load test: tests/load/streaming_url.js — p95 < 150ms
- [X] k6 load test: tests/load/search.js — p95 < 200ms
- [X] k6 load test: tests/load/recommendation.js — p95 < 300ms
- [X] POST /api/v1/auth/register endpoint — Auth Service + User Service gRPC CreateUser
- [X] infra/seed/demo_accounts.sh — tạo listener@ + creator@ qua API
- [X] infra/verify_ac.sh — 33 ACs automated curl verification (PASS/FAIL/SKIP)
- [ ] AC checklist W11: chạy verify_ac.sh, fix FAILs, verify thủ công SKIPs còn lại
- [ ] Demo script rehearsal: 14 phút, đủ tất cả tính năng
- [ ] Pre-upload demo songs cho Creator account

---

## Đang làm

- **Service/Task:** Frontend Redesign — Spotify Design System (Phase 1 xong)
- **File plan cần đọc:** `.claude/plan/frontend_redesign-spotify_design_system.md`
- **Checkpoint gần nhất đã pass:** Phase 1 xong — 79/79 frontend tests vẫn xanh (2026-05-12)
- **Ngày làm việc gần nhất:** 2026-05-12
- **Tiếp theo:** Phase 2 — AppShell layout (sidebar 240px + bottom player bar 90px)

---

## Decisions quan trọng đã ghi nhận

| Date | Service | Quyết định |
|---|---|---|
| 2026-05-05 | API Gateway | Redis blacklist key là `token:blacklist:{jti}` (không phải `rt:blacklist:{jti}` trong plan) |
| 2026-05-05 | API Gateway | Circuit breaker dùng custom `Task.WaitAsync` thay vì Polly |
| 2026-05-05 | API Gateway | `catch` client-disconnect `OperationCanceledException` phải đứng TRƯỚC catch circuit-breaker |
| 2026-05-05 | Auth/User | Thêm `VerifyCredentials` RPC vào `user.proto` — Auth Service không connect trực tiếp `user_db` |
| 2026-05-05 | All downstream | GatewayAuth pattern: trust `X-User-Id`/`X-User-Role` headers, không re-validate JWT |
| 2026-05-05 | Streaming | Chunk endpoint dùng S3 proxy (ByteRange) thay vì CDN redirect — phù hợp local MinIO |
| 2026-05-05 | Music/Infra | Dùng MinIO (đã có trong docker-compose) thay vì LocalStack S3 |
| 2026-05-05 | Postgres | Services connect native postgres `localhost:5432` (`postgres/4L27hN04@`), không qua Docker postgres |
| 2026-05-06 | Notification Service | Fan-out batch size = 500 — tránh hold >500 Notification objects trong memory |
| 2026-05-06 | Notification Service | `Notification_Sent` publish là best-effort — failure không làm crash fan-out |
| 2026-05-06 | User Service | `follows` table added to DbContext — cần migration `AddFollowsTable` nếu chạy thật |
| 2026-05-06 | Listening Party Service | Lazy factory pattern cho `IConnectionMultiplexer` — PHẢI dùng `_ => ConnectionMultiplexer.Connect(str)` không gọi inline |
| 2026-05-06 | Frontend | `types/listening-party.ts` overwrite với shared_contracts.md Section 6 — nội dung cũ sai hoàn toàn |
| 2026-05-07 | Frontend | `GET /api/v1/music/songs` (list) không có trong API Design V2 — CreatorDashboard dùng Song ID input thay vì list |
| 2026-05-07 | Frontend | `@microsoft/signalr` mock trong vitest: phải dùng `function` constructor (không phải arrow), tất cả builder methods phải return cùng 1 object |
| 2026-05-10 | All Services | Prometheus `/metrics` expose trên cùng HTTP port (80) dùng `MapMetrics()` — không cần port riêng 9091 |
| 2026-05-10 | Auth Service | `POST /api/v1/auth/register` không có trong API Design V2 — thêm cho demo. `USER_ALREADY_EXISTS` chưa có trong error catalogue, dùng `VALIDATION_ERROR` tạm (TODO) |
| 2026-05-10 | All Services | `using Prometheus;` phải thêm explicit vào Program.cs — không nằm trong implicit usings |

---

## Known Issues

_(Format: [service]: vấn đề — workaround: ...)_

- Recommendation Service: IDE VS Code Pylance báo "Cannot find module" — do IDE dùng global Python, không phải `.venv`. Tests chạy đúng với `.venv/Scripts/python -m pytest`.

---

## Tham khảo nhanh

- Bug history & decisions: `.claude/DEVLOG.md`
- Lịch sử milestone: `CHANGELOG.md`
- Plan chi tiết tuần này: `.claude/plan/week5_6_search_analytics_notification.md`
