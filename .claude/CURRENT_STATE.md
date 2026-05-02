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
- [x] Documentation: PRD V5, Backlog V7, API Design V2, Use Cases V1
- [x] Repo structure: SmartMusic.sln, folder scaffold, .gitignore
- [x] Infrastructure local: docker-compose.yml, .env.example, verify-infra.sh
- [x] Architecture docs: system diagrams, sequence diagrams, use case diagrams
- [x] Contracts: GRPC_CONTRACTS.md, KAFKA_EVENT_CONTRACTS.md, kafka-schemas/
- [x] Database schema: DATABASE_SCHEMA.md
- [x] Execution plans: .claude/plan/ (7 files)
- [x] CURRENT_STATE.md, CLAUDE.md cập nhật

### Day 5 — Boilerplate
- [ ] api-gateway boilerplate — GET /health → 200
- [ ] auth-service boilerplate — GET /health → 200
- [ ] user-service boilerplate — GET /health → 200
- [ ] music-service boilerplate — GET /health → 200
- [ ] streaming-service boilerplate — GET /health → 200
- [ ] listening-party-service boilerplate — GET /health → 200
- [ ] analytics-service boilerplate — GET /health → 200
- [ ] notification-service boilerplate — GET /health → 200
- [ ] search-service boilerplate — GET /health → 200
- [ ] recommendation-service boilerplate — GET /health → 200
- [ ] React SPA boilerplate — npm run dev hiển thị "Smart Music Platform"
- [ ] docker-compose up --build — không có container exit

### Week 2 — Auth + User + Gateway
- [ ] Bước 0: generate C# từ proto/auth.proto và proto/user.proto
- [ ] Bước 0: grpcurl test gRPC connection pass
- [ ] User Service: EF Core migration InitialCreate (user_db)
- [ ] User Service: GET /api/v1/users/me
- [ ] User Service: POST /api/v1/users/me/preferences
- [ ] User Service: gRPC server GetUserProfile
- [ ] User Service: Internal GET /internal/users/{id}/preferences
- [ ] Auth Service: EF Core migration InitialCreate (auth_db)
- [ ] Auth Service: POST /api/v1/auth/login
- [ ] Auth Service: POST /api/v1/auth/refresh
- [ ] Auth Service: POST /api/v1/auth/logout
- [ ] API Gateway: YARP routing 9 routes
- [ ] API Gateway: JWT Validation Middleware
- [ ] API Gateway: Rate Limiting Middleware (Redis)
- [ ] API Gateway: Circuit Breaker (2000ms → 503)
- [ ] Checkpoint W2: login flow end-to-end pass

### Week 3–4 — Music + Streaming + Recommendation
- [ ] LocalStack S3 thêm vào docker-compose.yml
- [ ] Seed script: infra/seed/s3_seed.sh
- [ ] Seed script: infra/seed/redis_seed.sh (50 trending songs)
- [ ] Music Service: EF Core migration InitialCreate (music_db)
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

- **Service/Task:** Chưa bắt đầu — chuẩn bị Day 5
- **File plan đang theo:** `.claude/plan/day5_boilerplate.md`
- **Checkpoint gần nhất đã pass:** Infrastructure local healthy (verify-infra.sh)
- **Blocked bởi:** —

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
