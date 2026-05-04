# CURRENT_STATE.md — Trạng thái thực thi Smart Music Platform

> File này do nhóm tự cập nhật sau mỗi ngày làm việc.
> Các plan files gốc: `.claude/plan/` (7 files — đọc file tương ứng với phase hiện tại).

---

## Trạng thái hiện tại

- **Phase:** Day 5 — Boilerplate
- **Tuần:** 1
- **Ngày làm việc gần nhất:** 2026-05-03

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
- [X] CURRENT_STATE.md, CLAUDE.md cập nhật

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
- [X] User Service: gRPC server GetUserProfile
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

- [X] LocalStack S3 — không cần (MinIO đã có trong docker-compose)
- [X] Seed script: infra/seed/s3_seed.sh — bucket smartmusic-audio + test-song-001 upload
- [X] Seed script: infra/seed/redis_seed.sh — 50 trending songs trong rec:trending:global
- [X] Music Service: EF Core migration InitialCreate (music_db)
- [X] Music Service: S3StorageService (MinIO AWS SDK) & KafkaEventPublisher (Confluent.Kafka)
- [ ] Music Service: POST /api/v1/music/songs
- [ ] Music Service: GET /api/v1/music/songs/{songId}
- [ ] Music Service: Internal GET /internal/songs/{songId}/storage-key
- [ ] Music Service: Internal GET /internal/songs/batch
- [ ] Streaming Service: GET /api/v1/streaming/{songId}/url
- [ ] Streaming Service: GET /api/v1/streaming/{songId}/chunk
- [ ] Recommendation Service: Rule Engine scoring logic
- [ ] Recommendation Service: GET /api/v1/recommendations
- [ ] Recommendation Service: POST /api/v1/recommendations/feedback
- [ ] Recommendation Service: Kafka consumer Song_Played
- [ ] Recommendation Service: Kafka consumer Song_Skipped
- [ ] Recommendation Service: Kafka consumer User_Preferences_Updated
- [ ] Checkpoint W4: play 1 bài nhạc end-to-end pass

### Week 5–6 — Search + Analytics + Notification

- [ ] Elasticsearch index mapping songs tạo xong
- [ ] Seed script: infra/seed/elasticsearch_seed.sh (10 songs)
- [ ] Search Service: GET /api/v1/search
- [ ] Analytics Service: POST /api/v1/analytics/events/play
- [ ] Analytics Service: GET /api/v1/analytics/creator/heatmap/{songId}
- [ ] Analytics Service: GET /api/v1/analytics/creator/stats/{songId}
- [ ] Analytics Service: Kafka consumer Song_Played → InfluxDB
- [ ] Analytics Service: Kafka consumer Song_Skipped → InfluxDB
- [ ] Analytics Service: Kafka consumer Notification_Sent → counter
- [ ] Notification Service: GET /api/v1/notifications/unread
- [ ] Notification Service: PATCH /api/v1/notifications/{id}/read
- [ ] Notification Service: PATCH /api/v1/notifications/read-all
- [ ] Notification Service: Kafka consumer New_Release → fan-out
- [ ] Kafka wiring: 3 consumer groups hoạt động, DLQ topics tồn tại
- [ ] Checkpoint W6: Creator thấy heatmap sau play/skip events

### Week 7–9 — Frontend + Listening Party

- [ ] Track A W7: LoginPage
- [ ] Track A W7: AudioPlayer component
- [ ] Track B W7: POST /api/v1/parties
- [ ] Track B W7: POST /api/v1/parties/{joinCode}/join
- [ ] SYNC POINT W7: services/frontend/src/types/listening-party.ts tạo xong
- [ ] Track A W8: HomePage (recommendations list)
- [ ] Track A W8: SearchPage
- [ ] Track B W8: SignalR PartyHub (PLAYER_ACTION, SYNC_STATE)
- [ ] Track A W9: CreatorDashboardPage
- [ ] Track A W9: NotificationBell component
- [ ] Track B W9: Reconnect + resync logic
- [ ] Track A+B W9: integrate SignalR thật (replace mock)
- [ ] Checkpoint W9: 2-tab test — Host Play → Member sync < 500ms

### Week 10–12 — Polish + Demo

- [ ] Prometheus metrics expose trên tất cả services
- [ ] Grafana dashboard: 4 panels (latency, streaming, kafka lag, CTR)
- [ ] k6 load test: tests/load/streaming_url.js — p95 < 150ms
- [ ] k6 load test: tests/load/search.js — p95 < 200ms
- [ ] k6 load test: tests/load/recommendation.js — p95 < 300ms
- [ ] AC checklist W11: tất cả 33 ACs verify pass
- [ ] Demo script rehearsal: 14 phút, đủ tất cả tính năng
- [ ] Backup accounts tạo xong: listener@, creator@
- [ ] Pre-upload demo songs cho Creator account

---

## Đang làm

- **Service/Task:** Week 3 — Music Service: Infrastructure layer hoàn tất ✅ (2026-05-05)
- **File plan đang theo:** `.claude/plan/week3_4_music_streaming_recommendation.md`
- **Checkpoint gần nhất đã pass:** Implement S3StorageService và KafkaEventPublisher.
- **Blocked bởi:** —

### Decisions ghi nhận từ Week 2

- Redis blacklist key Gateway đọc là `token:blacklist:{jti}` (không phải `rt:blacklist:{jti}` trong plan) — theo code thực tế Auth Service
- Circuit breaker dùng custom `Task.WaitAsync(CancellationToken)` thay vì Polly — đủ yêu cầu, ít dependency
- `catch` client-disconnect `OperationCanceledException` phải đứng TRƯỚC catch circuit-breaker khi dùng linked CTS
- Thêm `VerifyCredentials` RPC vào `user.proto` — Auth Service không được connect trực tiếp `user_db`

---

## Làm tiếp theo

- **Task tiếp theo:** Tạo boilerplate tất cả 9 C# services + Python recommendation-service + React SPA
- **File plan cần đọc:** `.claude/plan/day5_boilerplate.md`
- **Files cần đính kèm vào conversation:** `CLAUDE.md`, `.claude/skills/aspnet-service/SKILL.md`, `.claude/rules/security-non-negotiable/RULE.md`, `.claude/plan/day5_boilerplate.md`

---

## Decisions đã làm

_(Ghi lại các quyết định kỹ thuật quan trọng khác với tài liệu gốc — format: [date] [service]: [quyết định] — lý do: [...])_

---

## Known Issues

_(Format: [service]: [vấn đề] — workaround: [...])_

---

## Tham khảo nhanh

- Đã fix gì trước đây: `.claude/DEVLOG.md`
- Lịch sử milestone: `CHANGELOG.md`
