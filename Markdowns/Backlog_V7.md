# PRODUCT BACKLOG
## Smart Music Streaming Platform
**Version 7.0 — Aligned to PRD V5 (Revised Scope)**
*April 2026*

| SCOPE NOTE | Backlog này được viết lại theo PRD V5. AI/ML recommendation được thay bằng Rule-based Context Engine. Bloom Filter thay bằng Redis SET. gRPC giới hạn ở Auth↔User. Scope được freeze — không thêm feature nếu không có approval. |
| --- | --- |


## 1. NON-FUNCTIONAL REQUIREMENTS & SYSTEM BOUNDARIES

Các tiêu chuẩn áp dụng toàn cục cho mọi Service.

| Category | Constraint | Value / Rule |
| --- | --- | --- |
| SLO / SLA | API latency p95 | < 500ms |
| SLO / SLA | Core services uptime (Gateway, Auth, Streaming) | 99.9% |
| Timeout Budget | Tổng end-to-end request budget | 500ms = Gateway 50ms + Service 300ms + Buffer 150ms |
| Timeout Budget | Fail Fast | Mỗi service phải trả lỗi ngay nếu biết đã vượt budget |
| Load Shedding | Priority khi overload | Streaming > Auth > Recommendation > Analytics |
| Load Shedding | Kafka lag threshold | > 10s → event sampling 50% cho non-critical logs |
| Security | Auth protocol | JWT Bearer + HTTP-only Cookie + RBAC (Listener / Creator / Admin) |
| Security | Refresh Token | Rotation — ONE-TIME USE. Reuse → revoke toàn bộ session. |
| Security | Token revocation | Redis Blacklist, TTL = token expiry |
| Security | Replay protection | Nonce + timestamp, chỉ cho POST/PUT/DELETE. Redis TTL 30-60s. |
| Rate Limiting | Public endpoints | 100 req/min per IP tại API Gateway |
| Redis | Memory policy | maxmemory-policy: allkeys-lru |
| Observability | Distributed tracing | CorrelationId propagated xuyên suốt mọi service |
| Observability | Metrics (Prometheus) | API latency, Streaming start time, Kafka lag, CTR |
| Data Privacy | PII trong Analytics | Anonymized — tuyệt đối không lưu PII vào Time-series DB |
| Data Privacy | Right to be forgotten | Endpoint chuẩn hóa xóa toàn bộ dữ liệu user |
| Event Schema | Versioning | Mọi Kafka event phải có field version (VD: v1) |
| Event Schema | Backward Compatibility | Consumer bỏ qua field không nhận diện. Producer chỉ ADD field — không sửa/xóa field cũ. |
| Resilience | Circuit Breaker | Gateway trả 503 nếu downstream > 2000ms |
| Resilience | Retry | Max 3 lần, Exponential Backoff |
| Resilience | DLQ | Dead Letter Queue giữ event lỗi tối thiểu 7 ngày |


## 2. PRODUCT BACKLOG — PHASE 1 (MVP)

| PHASE 1 GOAL | Deliver 5 luồng core có thể demo live: (1) Auth + Onboarding, (2) Rule-based Recommendation, (3) Streaming + Play tracking, (4) Search, (5) Listening Party cơ bản. |
| --- | --- |


### EPIC 0: API Gateway & Security Layer  [Phase 1 — Foundation]

**Data Ownership:** Stateless. Đọc từ Redis cho rate limiting. Tuyệt đối không chứa business logic.
**Success Metrics:** Routing latency < 50ms | 100% unauthorized requests bị reject

#### User Story 0.1: Central Routing & Security Enforcement
| Field | Content |
| --- | --- |
| Story | As a System, I want to route all external traffic through a single Gateway so that security policies, rate limits, and SSL termination are handled centrally. |
| AC1 | Given a request without JWT. When it hits a protected route. Then return 401 Unauthorized. |
| AC2 | Given a downstream service responds > 2000ms. Then Gateway triggers Circuit Breaker and returns 503 Service Unavailable. |
| AC3 | Given 100+ req/min from same IP. Then Gateway returns 429 Too Many Requests. |
| Failure Handling | Nếu Auth Service chết: Gateway dùng cached public keys để verify JWT tạm thời (Circuit Breaker + fallback). |
| Priority | High | Estimate: 5 SP |


### EPIC 1: Authentication, RBAC & User Onboarding  [Phase 1 — Foundation]

**Data Ownership:** User Service độc quyền Read/Write bảng Users, Roles, Follows (PostgreSQL). Các service khác lấy qua gRPC.

#### User Story 1.1: RBAC Login & Session Management
| Field | Content |
| --- | --- |
| Story | As a User, I want to log in securely so that my personal data is protected and my role (Listener / Creator / Admin) is recognized across the system. |
| AC1 | Given valid credentials. Then return HTTP-only Cookie chứa Refresh Token + Bearer Access Token (JWT). |
| AC2 | Given invalid credentials. Then return 400 AUTH_INVALID_CREDENTIALS. |
| AC3 | Given > 5 failed attempts. Then lock account tạm thời và return 429. |
| AC4 | Given Refresh Token cũ được dùng lại (reuse). Then revoke toàn bộ session và return 403 TOKEN_REUSED. |
| Failure Handling | DB Master chết → tự động route sang Read-Replica. Auth Service chết → Gateway dùng cached public key để verify token. |
| Priority | High | Estimate: 5 SP |


#### User Story 1.2: Onboarding — Cold Start Mitigation
| Field | Content |
| --- | --- |
| Story | As a New Listener, I want to pick my favorite genres and artists upon first login so the platform can recommend music immediately without waiting for history data. |
| AC1 | Given first-time login. When no preference data exists. Then app forces selection of at least 3 genres/artists before proceeding. |
| AC2 | Given onboarding completed. Then data được publish ngay vào Kafka (User_Preferences_Updated v1) để Recommendation Service cập nhật Redis. |
| AC3 | Given onboarding data đã tồn tại. Then skip onboarding screen (idempotent). |
| Failure Handling | Nếu Kafka publish fail: retry 3 lần. Nếu vẫn fail: lưu vào local queue, retry sau. Không block user trải nghiệm. |
| Priority | High | Estimate: 3 SP |


#### User Story 1.3: Music Upload (Creator)
| Field | Content |
| --- | --- |
| Story | As a Creator, I want to upload my audio file and fill in song metadata so my music is available for listeners on the platform. |
| AC1 | Given valid audio file (MP3/WAV, max 50MB) + metadata (title, genre, mood). Then file được lưu lên S3 và metadata vào Music Service DB. |
| AC2 | Given upload thành công. Then Music Service publish New_Release event (v1) lên Kafka. |
| AC3 | Given file > 50MB hoặc format không hợp lệ. Then return 400 VALIDATION_ERROR. |
| Failure Handling | S3 upload fail: retry 3 lần Exponential Backoff. Nếu vẫn fail: return 503, không commit vào DB. |
| Priority | High | Estimate: 5 SP |


### EPIC 2: Context-Aware Rule-based Recommendation  [Phase 1 — Core (Revised: Rule Engine thay ML)]

**Data Ownership:** Recommendation Service sở hữu User Preference cache (Redis) và Trending Sorted Set. Chỉ READ metadata từ Music Service qua Kafka/REST.
**Success Metrics:** CTR > 10% | Cache hit ratio > 80%

| REVISION | Epic này thay thế hoàn toàn ML-based Recommendation. Không dùng Vector DB, PyTorch, LSTM, hay Collaborative Filtering trong Phase 1. Rule Engine đơn giản nhưng vẫn là independent microservice với đầy đủ Kafka, Redis, fallback chain. |
| --- | --- |


#### User Story 2.1: Context-Aware Rule Engine
| Field | Content |
| --- | --- |
| Story | As a Listener, I want to receive music suggestions that match my current context and listening history, with a short explanation, so I can discover relevant music effortlessly. |
| AC1 | Given time-of-day = morning (6-12h). Then ưu tiên songs có tags: 'focus', 'morning', 'acoustic'. explain_text = 'Gợi ý buổi sáng'. |
| AC2 | Given user skip một genre liên tục (>= 3 lần trong 7 ngày). Then giảm weight genre đó trong Redis. Songs thuộc genre đó xuất hiện ít hơn ở vị trí đầu. |
| AC3 | Given user nghe > 80% duration của một bài. Then tăng weight genre tương ứng. |
| AC4 | Then response trả về >= 5 bài kèm explain_text cho mỗi bài. Ví dụ: 'Vì bạn nghe Indie Rock', 'Đang thịnh hành', 'Gợi ý buổi tối'. |
| AC5 | Given Recommendation Service timeout > 300ms. Then tự động fallback trả Top 50 Trending từ Redis cache (TTL 1h). |
| Failure Handling | Redis miss hoàn toàn (user mới): fallback về danh sách songs thuộc genres từ onboarding, random sort. Không bao giờ trả empty list. |
| Priority | High | Estimate: 8 SP |


#### User Story 2.2: Feedback Loop — Realtime Weight Update
| Field | Content |
| --- | --- |
| Story | As the Recommendation Service, I want to update user preference weights in realtime from play/skip events so recommendations improve continuously without batch jobs. |
| AC1 | Given Song_Played event (v1) consumed từ Kafka. Then cập nhật play weight của genre trong Redis (TTL 7 ngày). |
| AC2 | Given Song_Skipped event (v1) consumed. Then giảm skip weight của genre trong Redis. |
| AC3 | Given duplicate event (same eventId). Then bỏ qua (idempotency check qua Redis SET — thay thế Bloom Filter). |
| Failure Handling | Kafka consumer lag > 10s: log warning, trigger sampling 50% cho analytics events. Play/Skip events vẫn được xử lý đầy đủ (high priority). |
| Priority | High | Estimate: 5 SP |


### EPIC 3: Core Streaming & Delivery  [Phase 1 — Core]

**Data Ownership:** Music Service giữ Song Metadata (PostgreSQL/MongoDB). Streaming Service là Stateless, đọc file từ S3.

#### User Story 3.1: Resilient Audio Streaming
| Field | Content |
| --- | --- |
| Story | As a Listener, I want music to start playing immediately and seeking to work smoothly so my listening experience is uninterrupted. |
| AC1 | Given a play request. Then nhạc bắt đầu phát trong < 1 giây. |
| AC2 | Given a seek to 01:45. Then stream bằng HTTP 206 Partial Content từ timestamp chính xác. |
| AC3 | Given a stream request. Then trả Pre-signed URL (expiry 15 phút) — client tải trực tiếp từ CDN/S3, không qua backend. |
| Failure Handling | S3 get-object timeout > 1s: retry Exponential Backoff (max 3 lần). CDN miss: fetch từ Origin Server với bandwidth control. Primary CDN fail: fallback sang secondary CDN. |
| Priority | High | Estimate: 8 SP |


### EPIC 4: Event-driven Analytics & Tracking  [Phase 1 — Core]

**Data Ownership:** Analytics Service độc quyền ghi logs vào Time-series DB (InfluxDB/MongoDB). Append-only — không sửa data cũ.

#### User Story 4.1: Fault-tolerant Playback Tracking
| Field | Content |
| --- | --- |
| Story | As a Product Manager, I want reliable playback metrics (plays, skips, duration) without impacting user stream speed so I can make data-driven decisions. |
| AC1 | Given a stream starts. Then Song_Played event (v1) được publish lên Kafka (at-least-once). |
| AC2 | Given a song is skipped. Then Song_Skipped event (v1) với timestamp được publish lên Kafka. |
| AC3 | Given duplicate event (same eventId). Then Analytics Service bỏ qua (idempotency via Redis SET — effectively-once). |
| AC4 | Given Analytics endpoint nhận request. Then return 202 Accepted ngay (async) — không block streaming. |
| Failure Handling | Retry tối đa 3 lần Exponential Backoff. Sau đó chuyển vào DLQ (giữ 7 ngày). Fallback khi Kafka down: ghi tạm vào local disk queue. |
| Priority | High | Estimate: 5 SP |


#### User Story 4.2: Creator Analytics Dashboard
| Field | Content |
| --- | --- |
| Story | As a Creator, I want to see how listeners interact with my songs — including where they skip — so I can improve my music and understand my audience. |
| AC1 | Given Creator truy cập Dashboard với songId. Then hiển thị heatmap skip-rate theo từng giây (timeRange: 7d / 30d). |
| AC2 | Given Dashboard load. Then hiển thị Daily Active Listeners và Unique Users chart (cập nhật hàng ngày). |
| AC3 | Given non-Creator role cố gắng truy cập. Then return 403 FORBIDDEN (RBAC enforcement). |
| AC4 | Given query heatmap. Then trả kết quả < 500ms (cache Redis TTL 6h, key: heatmap:{songId}:{timeRange}). |
| Failure Handling | Aggregation query timeout: serve stale cache nếu có. Nếu không có cache: return empty data với warning, không crash dashboard. |
| Priority | High | Estimate: 5 SP |


### EPIC 5: Search  [Phase 1 — Core]

**Data Ownership:** Search Service (hoặc Music Service) dùng Elasticsearch Read-Replica.

#### User Story 5.1: Fuzzy Search Songs & Artists
| Field | Content |
| --- | --- |
| Story | As a Listener, I want to search for songs and artists with typo tolerance so I can find music even when I don't know the exact name. |
| AC1 | Given query 'son tug'. Then trả kết quả 'Sơn Tùng M-TP' với relevance score. |
| AC2 | Given search request. Then kết quả trả về < 200ms (Elasticsearch Read-Replica + cache TTL 10 phút cho frequent queries). |
| AC3 | Given no results found. Then trả empty array [] — không trả lỗi. |
| AC4 | Then response hỗ trợ cursor pagination (nextCursor, hasMore). |
| Failure Handling | Elasticsearch timeout: return empty array []. Không cascade fail. Log warning. |
| Priority | Medium | Estimate: 5 SP |


### EPIC 6: Notification Service  [Phase 1 — Core]

**Data Ownership:** Notification Service sở hữu User Subscriptions, Notification Logs (MongoDB).

#### User Story 6.1: New Release Notification
| Field | Content |
| --- | --- |
| Story | As a Listener, I want to receive notifications when artists I follow release new music so I never miss content from my favorite creators. |
| AC1 | Given Creator upload bài mới (New_Release event v1 từ Kafka). Then Notification Service fan-out push alert tới tất cả followers của Creator đó. |
| AC2 | Given Listener mở app. Then danh sách unread notifications hiển thị, hỗ trợ cursor pagination. |
| AC3 | Given Listener mark notification as read. Then idempotent (Idempotency-Key header, TTL 24h). |
| Failure Handling | Fan-out fail một phần: retry async. DLQ cho notifications không gửi được sau 3 lần retry. |
| Priority | Medium | Estimate: 3 SP |


## 3. PRODUCT BACKLOG — PHASE 2 (ADVANCED)

| PHASE 2 NOTE | Phase 2 chỉ bắt đầu sau khi Phase 1 MVP đã hoàn chỉnh và demo được. Nếu không còn thời gian, EPIC 7 và EPIC 8 có thể để lại — không ảnh hưởng đến điểm cốt lõi. |
| --- | --- |


### EPIC 7: Realtime Distributed Listening Party  [Phase 2 — Advanced]

**Data Ownership:** Quản lý state tạm thời trên Redis. Không lưu Room Chat vĩnh viễn. Trade-off: chấp nhận mất state nếu Redis crash để đạt latency thấp.
**Success Metrics:** Sync delay < 500ms

#### User Story 7.1: Create & Join Listening Party
| Field | Content |
| --- | --- |
| Story | As a Listener, I want to create a listening room and share a join code so my friends can join and we listen together in sync. |
| AC1 | Given create party request. Then trả roomId + joinCode (6 ký tự). State lưu vào Redis cluster (ephemeral). |
| AC2 | Given join party với joinCode hợp lệ. Then trả roomId, hostId, currentSongId, playbackPositionSec. |
| AC3 | Given join party với joinCode không tồn tại. Then return 404 ROOM_NOT_FOUND. |
| Failure Handling | Redis crash → room mất state. Trade-off được chấp nhận và document rõ trong tài liệu. User phải tạo room mới. |
| Priority | High | Estimate: 5 SP |


#### User Story 7.2: Host Authority & Realtime Sync
| Field | Content |
| --- | --- |
| Story | As a Party Host, I want to control playback and have all members sync automatically within 500ms so everyone hears the same music at the same time. |
| AC1 | Given Host action (Play/Pause/Seek). Then tất cả members nhận SYNC_STATE event qua WebSocket trong < 500ms. |
| AC2 | Given Member cố gắng Play/Pause (không phải Host). Then server reject action — chỉ Host mới có quyền điều khiển. |
| AC3 | Given conflict (2 requests cùng lúc). Then áp dụng Host is Source of Truth — chỉ chấp nhận action được approve bởi Host state. |
| AC4 | Given WebSocket idle > 30s. Then server gửi Ping. Client không Pong trong 10s → disconnect và clean up Redis state. |
| Failure Handling | Host disconnect > 5s: backend trigger re-election, promote member có lowest latency làm Host mới. |
| Priority | High | Estimate: 8 SP |


#### User Story 7.3: Reconnect & Resync
| Field | Content |
| --- | --- |
| Story | As a Party Member who lost connection, I want to automatically resync to the current playback position when I reconnect so I can rejoin seamlessly. |
| AC1 | Given Member reconnect sau khi mất mạng. Then tự động lấy currentSongId và playbackPositionSec từ Redis (theo Host state). |
| AC2 | Given reconnect strategy. Then dùng Exponential Backoff (1s, 2s, 4s, max 30s). |
| Failure Handling | Room không còn tồn tại trên Redis sau reconnect: thông báo 'Room đã kết thúc' và redirect về home. |
| Priority | Medium | Estimate: 5 SP |


### EPIC 8: Recommendation Upgrade — Collaborative Filtering (Optional)  [Phase 2 — Optional nếu còn thời gian]

| OPTIONAL | Epic này chỉ thực hiện nếu Phase 1 và Phase 2 EPIC 7 đã hoàn chỉnh. Không sacrifice chất lượng EPIC 0-7 để làm Epic này. |
| --- | --- |


#### User Story 8.1: Simple User-based Collaborative Filtering
| Field | Content |
| --- | --- |
| Story | As a Listener, I want recommendations based on users with similar taste so I can discover music beyond my own listening history. |
| AC1 | Given user A và user B có genre overlap > 70%. Then một số gợi ý của B được mix vào feed của A. |
| AC2 | Given CF result available. Then ưu tiên hiển thị CF result thay vì pure rule-based, kèm explain_text 'Phổ biến với người cùng gu'. |
| AC3 | Given CF computation fail hoặc timeout. Then graceful degradation về Rule Engine (EPIC 2). Không expose lỗi ra client. |
| Priority | Low | Estimate: 13 SP |


## 4. BACKLOG SUMMARY & VELOCITY PLAN

| Epic | Phase | Total SP | Priority |
| --- | --- | --- | --- |
| EPIC 0: API Gateway & Security | Phase 1 | 5 | High |
| EPIC 1: Auth, RBAC & Onboarding | Phase 1 | 13 | High |
| EPIC 2: Rule-based Recommendation | Phase 1 | 13 | High |
| EPIC 3: Core Streaming | Phase 1 | 8 | High |
| EPIC 4: Analytics & Creator Dashboard | Phase 1 | 10 | High |
| EPIC 5: Search | Phase 1 | 5 | Medium |
| EPIC 6: Notification | Phase 1 | 3 | Medium |
| EPIC 7: Listening Party | Phase 2 | 18 | High |
| EPIC 8: Collaborative Filtering | Phase 2 Optional | 13 | Low |
| TOTAL Phase 1 MVP | — | 57 SP | — |
| TOTAL incl. Phase 2 | — | 75 SP | — |
| TOTAL incl. Optional | — | 88 SP | — |


> **Velocity:** Giả sử velocity 10-12 SP/sprint (1 sprint = 1 tuần với nhóm 3-4 người), Phase 1 MVP hoàn thành trong ~5-6 tuần. Phase 2 thêm 2-3 tuần. Đây là ước lượng — cần điều chỉnh sau sprint đầu tiên.

## 5. DEFINITION OF DONE (DoD)

Một User Story được coi là DONE khi thỏa mãn TẤT CẢ các tiêu chí sau:

| # | Tiêu chí |
| --- | --- |
| 1 | Code đã được review bởi ít nhất 1 thành viên khác trong nhóm (Pull Request approved). |
| 2 | Tất cả Acceptance Criteria đã được verify thủ công hoặc bằng automated test. |
| 3 | Unit test hoặc Integration test đã được viết cho business logic chính. |
| 4 | API endpoint đã được document trong API Design file (cập nhật nếu có thay đổi). |
| 5 | Failure Handling đã được implement và test (không crash khi dependency fail). |
| 6 | CorrelationId được propagate đúng trong mọi request/event. |
| 7 | Service deploy được bằng Docker và chạy ổn định trong local/staging environment. |
| 8 | Không có P0/P1 bug tồn đọng liên quan đến story này. |


— End of Document —