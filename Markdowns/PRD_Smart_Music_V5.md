PRODUCT REQUIREMENTS DOCUMENT
Smart Music Streaming Platform
Version 5.0 (Revised Scope)
April 2026

| SCOPE NOTE | Phiên bản này được điều chỉnh để phù hợp với năng lực nhóm 3-4 người trong 1 học kỳ. AI Recommendation được đơn giản hóa thành Rule-based Context Engine. Các tính năng ngoài phạm vi được xác định rõ để tránh scope creep. |
| --- | --- |


1. Problem Framing

Smart Music Streaming Platform là nền tảng nghe nhạc trực tuyến áp dụng kiến trúc Microservices, tập trung giải quyết ba bài toán cốt lõi:

| Pain Point | Mô tả vấn đề | Giải pháp (Revised) |
| --- | --- | --- |
| Filter Bubble | Người dùng bị kẹt trong vòng gợi ý nhàm chán, thiếu khám phá mới. | Context-Aware Rule Engine (thay vì AI/ML phức tạp): gợi ý dựa theo thời gian trong ngày + lịch sử play/skip + onboarding genres. |
| Weak Social | Trải nghiệm nghe nhạc đơn lẻ, thiếu tính cộng đồng. | Realtime Listening Party: đồng bộ playback qua WebSocket, Host authority model. |
| Lack of Creator Insights | Nghệ sĩ không có dữ liệu hành vi người nghe. | Creator Analytics Dashboard: heatmap skip-rate, daily listener count, unique users chart. |


2. User Personas

| Persona | Mô tả | Mục tiêu chính |
| --- | --- | --- |
| Listener | Người yêu nhạc tìm kiếm trải nghiệm được cá nhân hóa và muốn kết nối bạn bè. | Khám phá nhạc mới, nghe cùng bạn bè realtime. |
| Creator (Artist) | Nghệ sĩ tải nhạc lên hệ thống và cần số liệu phân tích. | Upload nhạc, xem analytics hiệu suất bài hát. |
| Admin | Quản trị viên kiểm duyệt nội dung và giám sát hạ tầng. | Quản lý users, nội dung, theo dõi system health. |


3. Objectives & Success Metrics

| Objective | KPI / Metric | Target |
| --- | --- | --- |
| Streaming Performance | Streaming start time | < 1 giây |
| System Responsiveness | Average API response time | < 500ms (p95) |
| Recommendation Engagement | Click-through rate (CTR) cho rule-based suggestions | > 10% (giảm từ 15% do dùng rule-based) |
| Realtime Sync | Listening Party sync delay | < 500ms |
| Reliability | Core service uptime (Gateway, Auth, Streaming) | 99.9% |
| Gateway Performance | API Gateway routing latency | < 50ms |


4. Scope Control

In Scope — MVP (Phase 1)
Authentication & RBAC (Listener, Creator, Admin)
Core Audio Streaming (HTTP Range Requests + Pre-signed URLs + CDN)
Context-Aware Rule-based Recommendation Engine (xem Section 6)
Realtime Listening Party (WebSocket / SignalR)
Creator Analytics Dashboard (heatmap, daily listeners, unique users)
Search (fuzzy search songs, artists via Elasticsearch)
Notification Service (new release alerts)
API Gateway (routing, rate limiting, auth termination)
Event-driven Analytics (Kafka, idempotency, DLQ)
Frontend Web SPA (React)

In Scope — Advanced (Phase 2, nếu còn thời gian)
Nâng cấp Rule Engine lên Collaborative Filtering đơn giản (user-based similarity)
Host re-election khi Host disconnect trong Listening Party

Out of Scope

| CUT | Các tính năng sau đây bị loại khỏi scope để đảm bảo deliverable thực tế trong 1 học kỳ với nhóm 3-4 người. |
| --- | --- |


| Feature bị cắt | Lý do |
| --- | --- |
| Vector DB (Pinecone, Weaviate) | Thay bằng Redis sorted set — đủ cho rule-based, không cần embedding. |
| ML/AI models (LSTM, GRU, PyTorch) | Quá phức tạp để train và serve đúng hạn. Dùng rule-based thay thế. |
| Collaborative Filtering (Phase 1) | Chuyển sang Phase 2 nếu còn thời gian sau MVP. |
| Bloom Filter cho dedup | Thay bằng Redis SET. Bloom Filter là optimization, không phải requirement. |
| gRPC full internal mesh | Chỉ dùng gRPC cho 1-2 call quan trọng (Auth → User). Còn lại dùng REST. |
| Digital Rights Management (DRM) | Ngoài scope nghiệp vụ. |
| Mobile App (iOS/Android) | Chỉ build Web SPA. |
| Payment Gateway / Premium Subscription | Ngoài scope môn học. |
| Train AI models from scratch | Không có GPU, không có dataset đủ lớn. |


5. User Journey & Edge Cases

Listener Flow — Happy Path
Login thành công
Onboarding: chọn 3 genres/artists yêu thích
Nhận Context-aware Recommendation (VD: "Nhạc tập trung buổi sáng")
Click Play → nhạc phát trong < 1s
Tạo Listening Party → chia sẻ link → bạn bè join và nghe cùng realtime

Listener Flow — Edge Cases
Người dùng mới (Cold Start): Rule Engine fallback về "Top 50 Trending" cache cứng.
Reconnect trong Listening Party: tự động resync playback timestamp theo Host.
Recommendation timeout: fallback về Trending list được cache tại Edge (Redis).
S3 timeout: retry với Exponential Backoff, fallback sang secondary CDN.

Creator Flow
Login → Upload audio file → Gắn Metadata (Genre, Mood)
Truy cập Dashboard → xem biểu đồ Heatmap skip-rate theo từng giây bài hát
Xem Daily Active Listeners và Unique Users chart

6. Functional Requirements

| KEY CHANGE | Recommendation System được đơn giản hóa từ ML-based sang Rule-based Context Engine để phù hợp scope nhóm. Kiến trúc microservices được giữ nguyên hoàn toàn. |
| --- | --- |


| Feature | Acceptance Criteria (Revised) |
| --- | --- |
| Authentication & RBAC | Cấp phát JWT qua HTTP-only cookie; Refresh Token Rotation; Token revocation qua Redis Blacklist; RBAC 3 roles: Listener / Creator / Admin. |
| Streaming | Phát nhạc < 1s bằng HTTP Range Requests (HTTP 206); Hỗ trợ seek mượt mà; Phân phối file qua Pre-signed URLs (15 phút) kết hợp CDN caching. |
| Context-Aware Rule Engine (Recommendation) | Trả về >= 5 bài hát kèm explain_text. Signal đầu vào: (1) thời điểm trong ngày, (2) genres từ onboarding, (3) skip/play history từ Redis. Fallback: Top 50 Trending (cache Redis TTL 1h) nếu không đủ data. |
| Listening Party | Tạo phòng bằng Code/Link; Shared Queue; Đồng bộ Play/Pause/Seek < 500ms theo host-based timestamp; Host authority model (chỉ Host được điều khiển). |
| Creator Dashboard | Heatmap skip-rate theo giây (timeRange 7d/30d); Daily active listeners; Biểu đồ Unique Users. Dữ liệu cập nhật qua Kafka event pipeline. |
| Search | Fuzzy search songs/artists, trả kết quả < 200ms; Cursor pagination; Cache frequent queries TTL 10 phút. |
| Notification | Push alert tới follower khi Creator upload bài mới; Đánh dấu đã đọc đơn/tất cả. |
| Music Upload (Creator) | Creator upload audio file + metadata (genre, mood, title, artist); File lưu trên S3; Metadata lưu trên Music Service DB. |


7. Rule-based Recommendation Engine — Chi tiết

Đây là thay đổi quan trọng nhất so với V4. Rule Engine hoàn toàn thay thế ML model trong Phase 1, nhưng vẫn đặt trong Recommendation Service độc lập với DB riêng — đảm bảo tính microservices.

Input Signals
| Signal | Data Source | Cách dùng |
| --- | --- | --- |
| Thời gian trong ngày | Server timestamp | Sáng (6-12h): ưu tiên tags 'focus', 'morning'. Chiều (12-18h): 'energetic', 'pop'. Tối (18-23h): 'chill', 'acoustic'. Khuya (23-6h): 'lofi', 'ambient'. |
| Onboarding genres/artists | Redis (User Preferences) | Ưu tiên bài thuộc genres/artists user đã chọn khi đăng ký. |
| Play history | Redis (User Behavior cache, TTL 7d) | Bài nghe > 80% duration: tăng weight genre đó. Bài skip < 30%: giảm weight genre đó. |
| Trending | Redis Sorted Set (cập nhật mỗi 1h qua Kafka) | Fallback và mix vào result nếu rule-based không đủ bài. |


Scoring Logic
Mỗi bài nhạc có score = base_score + context_bonus + preference_bonus - skip_penalty
base_score = play_count (trending signal từ Redis Sorted Set)
context_bonus = +20 nếu tag khớp với time-of-day rule
preference_bonus = +30 nếu genre/artist khớp với onboarding preference
skip_penalty = -15 mỗi lần bị skip trong 7 ngày gần nhất
Sort by score DESC, trả top K bài

Fallback Strategy
Nếu Recommendation Service timeout > 300ms: trả Top 50 Trending từ Redis cache cứng tại Edge.
Nếu Redis miss hoàn toàn (user mới không có history): trả bài thuộc genres đã chọn ở onboarding, random sort.
explain_text được generate từ rule condition: "Gợi ý buổi sáng", "Vì bạn nghe Indie Rock", "Đang thịnh hành".

| WHY THIS IS OK | Rule-based vẫn thể hiện đầy đủ microservices patterns: Recommendation Service độc lập, giao tiếp qua Kafka event, có Redis cache, có fallback chain. Thầy cô chấm kiến trúc — không chấm độ chính xác của AI. |
| --- | --- |


8. Non-Functional Requirements

| Category | Requirement | Target |
| --- | --- | --- |
| Performance | API Gateway routing latency | < 50ms |
| Performance | API response time (p95) | < 500ms |
| Performance | Streaming start time | < 1 giây |
| Performance | Search query latency | < 200ms |
| Reliability | Core services uptime (Gateway, Auth, Streaming) | 99.9% |
| Scalability | Horizontal scaling | Stateless services, Docker/Kubernetes |
| Security | Authentication | JWT Bearer + HTTP-only Cookie + RBAC |
| Security | Rate Limiting | 100 req/min per IP (public endpoints) |
| Security | Replay Attack Protection | Nonce + timestamp cho POST/PUT/DELETE, Redis TTL 30-60s |
| Observability | Distributed tracing | CorrelationId propagated xuyên suốt services |
| Observability | Metrics | Prometheus: API latency, Streaming start time, Kafka lag, CTR |
| Data Privacy | Anonymization | Analytics Service không lưu PII trực tiếp |
| Data Privacy | Right to be forgotten | Endpoint xóa toàn bộ dữ liệu cá nhân |
| Resilience | Circuit Breaker | Trả 503 nếu downstream service không phản hồi |
| Resilience | Retry | Exponential Backoff với max 3 lần |
| Resilience | DLQ | Dead Letter Queue giữ event lỗi tối thiểu 7 ngày |


9. Expected Scale

| Metric | Value | Ghi chú |
| --- | --- | --- |
| Concurrent Users (CCU) | ~1,000 users | Mức demo/staging — phù hợp môn học |
| Throughput | ~200 RPS | Đủ để justify microservices pattern (scale-out independent services) |
| Streaming Bandwidth | ~50-100 MB/s (peak) | Chunk-based streaming + CDN rate limiting |
| Kafka lag threshold | > 10 giây | Kích hoạt event sampling 50% cho logs không quan trọng |
| Redis maxmemory policy | allkeys-lru | Tự động giải phóng RAM khi đạt đỉnh |


10. System Architecture & Data Ownership

Tuân thủ nguyên tắc Database per Service. Mỗi service sở hữu dữ liệu của mình, không truy cập thẳng DB của service khác.

| Service | DB / Storage | Owns |
| --- | --- | --- |
| API Gateway | Redis (stateless cache) | Rate limit counters, cached public keys |
| User Service | PostgreSQL | User profiles, credentials, follow lists, RBAC roles |
| Music Service | PostgreSQL / MongoDB | Song metadata, albums, artists |
| Streaming Service | Stateless (reads S3) | Không sở hữu data. Đọc file audio từ S3, phân phối qua CDN. |
| Recommendation Service | Redis (User Preference cache, TTL 7d) | Rule weights, user preference vectors, Trending sorted set |
| Analytics Service | Time-series DB (InfluxDB / MongoDB) | Play logs, skip events, heatmap data (Append-only) |
| Notification Service | MongoDB | User subscriptions, notification logs |
| Listening Party Service | Redis (ephemeral) | Room state, playback position, member list (mất khi Redis restart — trade-off chấp nhận được) |


11. Event-Driven Flow (Kafka Topics)

Giao tiếp bất đồng bộ qua Kafka. Chỉ giữ lại các topic thực sự cần thiết cho MVP.

| Topic / Event | Producer | Consumer(s) | Mục đích |
| --- | --- | --- | --- |
| Song_Played (v1) | Streaming Service | Analytics Service, Recommendation Service | Tracking play event; Recommendation Service cập nhật play weight trong Redis. |
| Song_Skipped (v1) | Streaming Service | Analytics Service, Recommendation Service | Tracking skip event; Recommendation Service giảm weight genre tương ứng trong Redis. |
| User_Preferences_Updated (v1) | User Service | Recommendation Service | Đồng bộ onboarding preferences sang Redis của Recommendation Service. |
| New_Release (v1) | Music Service | Notification Service | Creator upload bài mới → push alert tới followers. |
| Notification_Sent (v1) | Notification Service | Analytics Service | Tracking notification delivery rate. |


| KAFKA SCOPE | 5 topic này là đủ cho MVP. Không cần thêm topic phức tạp hơn. Bloom Filter được thay bằng Redis SET đơn giản cho idempotency dedup. Kafka at-least-once + consumer idempotency = effectively-once. |
| --- | --- |


12. API Design & Internal Communication

| Loại giao tiếp | Protocol | Áp dụng cho |
| --- | --- | --- |
| External API | REST (JSON) qua API Gateway | Tất cả request từ Web SPA client |
| Internal (quan trọng) | gRPC | Chỉ: Auth Service ↔ User Service (verify token + lấy user info) |
| Internal (còn lại) | REST hoặc Kafka event | Các service-to-service call khác dùng REST sync hoặc Kafka async |
| Realtime | WebSocket (SignalR) | Listening Party: sync Play/Pause/Seek, chat messages |


Lý do giới hạn gRPC chỉ 1-2 call: setup gRPC đúng chuẩn (proto files, code gen, TLS) tốn thời gian không tương xứng với benefit trong scope môn học. Auth ↔ User là call hot path thực sự cần low-latency.

13. Risks & Trade-offs

| Risk / Trade-off | Mô tả | Mitigation / Quyết định |
| --- | --- | --- |
| Rule-based vs. ML Recommendation | Rule Engine đơn giản hơn ML nhưng CTR thấp hơn. | Chấp nhận CTR target thấp hơn (>10% thay vì >15%). Vẫn đủ để minh họa kiến trúc. Ghi rõ trong presentation là lộ trình Phase 2. |
| Network Latency vs. Independence | Tách Microservices tăng network hops. | Dùng gRPC cho hot path (Auth↔User). Còn lại chấp nhận REST overhead. |
| Data Consistency vs. Availability | Dữ liệu phân tán nhiều DB. | Chấp nhận Eventual Consistency (Saga Pattern) thay vì ACID distributed. |
| Listening Party State | Room state lưu trên Redis → mất nếu Redis crash. | Đánh đổi persistence để đạt latency thấp. Ghi rõ trade-off trong tài liệu. |
| Recommendation Cold Start | User mới không có play history. | Bắt buộc onboarding chọn 3 genres/artists → push thẳng vào Redis preference. |
| Scope Creep | Nhóm có xu hướng thêm feature không cần thiết. | Freeze scope ở Section 4. Mọi feature mới phải có approval của cả nhóm và thầy hướng dẫn. |


14. Phased Delivery Plan

| Phase | Thời gian (ước tính) | Deliverable |
| --- | --- | --- |
| Phase 0: Foundation | Tuần 1-2 | API Gateway, Auth Service, User Service, DB setup, CI/CD pipeline cơ bản |
| Phase 1: Core MVP | Tuần 3-6 | Streaming Service, Music Service, Rule-based Recommendation, Basic Search |
| Phase 2: Social & Analytics | Tuần 7-9 | Listening Party (WebSocket), Analytics Service, Creator Dashboard, Notification Service |
| Phase 3: Polish & Demo | Tuần 10-12 | Performance tuning, Observability (Prometheus/Grafana), Load testing, Demo preparation |
| Phase 4 (optional) | Nếu còn thời gian | Nâng Recommendation lên Collaborative Filtering đơn giản, Host re-election |


— End of Document —