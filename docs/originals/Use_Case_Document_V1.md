USE CASE DOCUMENT
Smart Music Streaming Platform
Version 1.0 — Aligned to PRD V5 / Backlog V7
April 2026
1. Tổng quan hệ thống Use Cases

| Use Case ID | Actor chính | Tên Use Case | Epic / User Story |
| --- | --- | --- | --- |
| UC-01 | Listener | Đăng nhập & Đăng xuất | US-1.1 | EPIC 1 |
| UC-02 | Listener | Làm mới Access Token (Refresh) | US-1.1 | EPIC 1 |
| UC-03 | Listener (lần đầu đăng nhập) | Onboarding — Chọn Genres / Artists | US-1.2 | EPIC 1 |
| UC-04 | Listener | Tìm kiếm Bài hát / Nghệ sĩ | US-5.1 | EPIC 5 |
| UC-05 | Listener | Phát nhạc | US-3.1, US-4.1 | EPIC 3, EPIC 4 |
| UC-06 | Listener | Seek (tua) bài hát | US-3.1 | EPIC 3 |
| UC-07 | Listener | Xem thông tin bài hát | EPIC 3 |
| UC-08 | Listener | Xem gợi ý nhạc theo ngữ cảnh | US-2.1 | EPIC 2 |
| UC-09 | Listener | Cung cấp phản hồi Play / Skip | US-2.2, US-4.1 | EPIC 2, EPIC 4 |
| UC-10 | Listener (trở thành Host) | Tạo phòng nghe nhạc | US-7.1 | EPIC 7 |
| UC-11 | Listener (Member) | Tham gia phòng qua Join Code | US-7.1 | EPIC 7 |
| UC-12 | Listener — Host | Điều khiển phát nhạc (Host) | US-7.2 | EPIC 7 |
| UC-13 | Listener — Member | Đồng bộ nhạc realtime (Member) | US-7.3 | EPIC 7 |
| UC-14 | Creator | Tải nhạc lên hệ thống | US-1.3 | EPIC 1 |
| UC-15 | Creator | Xem Heatmap Skip-rate | US-4.2 | EPIC 4 |
| UC-16 | Creator | Xem thống kê lượt nghe | US-4.2 | EPIC 4 |
| UC-17 | Listener (follower của Creator) | Nhận thông báo bài hát mới | US-6.1 | EPIC 6 |
| UC-18 | Listener | Đánh dấu đã đọc thông báo | US-6.1 | EPIC 6 |
| UC-19 | Admin | Quản lý người dùng | EPIC 0 (RBAC) |
| UC-20 | Admin | Kiểm duyệt nội dung | PRD V5 — Admin persona |
| UC-21 | Admin | Giám sát hệ thống | PRD V5 — Observability |
| UC-22 | System (Streaming Service → Kafka → Analytics Service) | Tracking sự kiện phát nhạc | US-4.1 | EPIC 4 |
| UC-23 | System (Kafka → Recommendation Service) | Cập nhật trọng số gợi ý (Rule Engine) | US-2.2 | EPIC 2 |
| UC-24 | System (Kafka → Notification Service) | Fan-out thông báo tới Followers | US-6.1 | EPIC 6 |


2. Actors & Mô tả

| Actor | Role trong hệ thống | Use Cases liên quan |
| --- | --- | --- |
| Listener | Người dùng nghe nhạc, sử dụng Recommendation, tạo/tham gia Listening Party, nhận Notification. | UC-01 → UC-13, UC-17, UC-18 |
| Creator (Artist) | Nghệ sĩ upload nhạc, xem Analytics Dashboard. | UC-01, UC-02, UC-14, UC-15, UC-16 |
| Admin | Quản trị viên hệ thống, quản lý users, kiểm duyệt nội dung, giám sát hạ tầng. | UC-01, UC-02, UC-15, UC-16, UC-19, UC-20, UC-21 |
| System (Automated) | Các tiến trình tự động chạy nền (Kafka consumers, background jobs). | UC-22, UC-23, UC-24 |


3. Chi tiết Use Cases

Authentication & Account (EPIC 0 & 1)

| UC-01  Đăng nhập & Đăng xuất |
| --- |
| Actor(s) | Listener, Creator, Admin |
| Trigger | Người dùng nhập email/password và nhấn Đăng nhập. |
| Preconditions | Hệ thống đang hoạt động. Người dùng đã có tài khoản. |
| Main Flow | 1. Người dùng nhập email và password.
2. Hệ thống kiểm tra thông tin qua Auth Service (gRPC → User Service).
3. Auth Service tạo Access Token (JWT) và Refresh Token.
4. Trả Access Token dạng Bearer + Refresh Token trong HTTP-only Cookie.
5. Người dùng được redirect vào trang chủ theo role (Listener / Creator / Admin). |
| Alternative / Exception | ALT-1: Sai thông tin → trả 400 AUTH_INVALID_CREDENTIALS. ALT-2: Sai quá 5 lần → tài khoản bị khóa tạm thời, trả 429. EX-1: DB Master chết → tự động failover sang Read-Replica. EX-2: Auth Service chết → Gateway dùng cached public key để verify. |
| Postconditions | Access Token hợp lệ, Refresh Token lưu trong HTTP-only Cookie. Role của người dùng được nhận diện và áp dụng RBAC. |
| Non-functional | Budget: 500ms (p95). Rate Limit: 10 req/min per IP+User. Refresh Token Rotation: ONE-TIME USE — reuse → revoke toàn bộ session. |
| Related US / Epic | US-1.1 | EPIC 1 |



| UC-02  Làm mới Access Token (Refresh) |
| --- |
| Actor(s) | Listener, Creator, Admin (System-triggered) |
| Trigger | Access Token hết hạn; client gửi Refresh Token từ Cookie. |
| Preconditions | Người dùng đã đăng nhập. Refresh Token còn hiệu lực và chưa bị dùng lại. |
| Main Flow | 1. Client gửi POST /api/v1/auth/refresh (Refresh Token tự động từ HTTP-only Cookie).
2. Auth Service xác thực Refresh Token, kiểm tra Redis Blacklist.
3. Phát hành Access Token mới + Refresh Token mới (Rotation).
4. Token cũ được thêm vào Redis Blacklist (TTL = expiry còn lại). |
| Alternative / Exception | ALT-1: Token hết hạn → 401 TOKEN_EXPIRED. ALT-2: Token bị dùng lại → 403 TOKEN_REUSED, revoke toàn bộ session của user. EX-1: Redis không phản hồi → từ chối refresh để bảo vệ bảo mật. |
| Postconditions | Access Token mới được cấp. Token cũ không còn giá trị. |
| Non-functional | Budget: 200ms. Safe to retry: NO (không retry — mỗi lần gọi tiêu thụ token). |
| Related US / Epic | US-1.1 | EPIC 1 |



| UC-03  Onboarding — Chọn Genres / Artists |
| --- |
| Actor(s) | Listener (lần đầu đăng nhập) |
| Trigger | Phát hiện người dùng chưa có preference data sau khi đăng nhập. |
| Preconditions | Người dùng vừa đăng nhập lần đầu. Chưa có preference data trong Redis. |
| Main Flow | 1. Hệ thống redirect tới màn hình Onboarding.
2. Người dùng chọn tối thiểu 3 genres và/hoặc artists yêu thích.
3. User Service lưu preferences vào PostgreSQL.
4. Hệ thống publish User_Preferences_Updated (v1) lên Kafka.
5. Recommendation Service consume event → cập nhật Redis preference weights.
6. Người dùng được redirect vào trang chủ với recommendations sẵn sàng. |
| Alternative / Exception | ALT-1: Người dùng chọn < 3 items → hiển thị validation error, chặn tiến tiếp. EX-1: Kafka publish fail → retry 3 lần; nếu vẫn fail lưu local queue, không block user. EX-2: User đã có preference → skip Onboarding (idempotent). |
| Postconditions | Preference của người dùng được lưu. Recommendation Service sẵn sàng trả gợi ý ngay lập tức. |
| Non-functional | Budget: 400ms. Idempotency-Key: TTL 24h. Kafka: at-least-once delivery. |
| Related US / Epic | US-1.2 | EPIC 1 |



Music Streaming (EPIC 3)

| UC-04  Tìm kiếm Bài hát / Nghệ sĩ |
| --- |
| Actor(s) | Listener |
| Trigger | Listener nhập chuỗi tìm kiếm vào thanh Search. |
| Preconditions | Listener đã đăng nhập. Elasticsearch index đã được đồng bộ. |
| Main Flow | 1. Listener nhập query (VD: 'son tung').
2. Hệ thống gửi GET /api/v1/search?q=son+tung.
3. Search Service thực hiện fuzzy search trên Elasticsearch Read-Replica.
4. Kiểm tra Redis cache (TTL 10 phút) trước khi query ES.
5. Trả về danh sách kết quả có relevance score, hỗ trợ cursor pagination. |
| Alternative / Exception | ALT-1: Không có kết quả → trả empty array [], không trả lỗi. EX-1: Elasticsearch timeout → trả empty array [], log warning, không crash. |
| Postconditions | Kết quả tìm kiếm được hiển thị có sắp xếp theo relevance score. |
| Non-functional | Budget: 200ms. Cache: Redis TTL 10 phút. Rate Limit: 60 req/min per Token. |
| Related US / Epic | US-5.1 | EPIC 5 |



| UC-05  Phát nhạc |
| --- |
| Actor(s) | Listener |
| Trigger | Listener nhấn nút Play trên một bài hát. |
| Preconditions | Listener đã đăng nhập. Bài hát tồn tại và đã được publish. |
| Main Flow | 1. Listener nhấn Play trên bài hát (songId).
2. Client gửi GET /api/v1/streaming/{songId}/url.
3. Streaming Service tạo Pre-signed URL (expiry 15 phút) trỏ tới S3/CDN.
4. Trả Pre-signed URL về client.
5. Client tải audio trực tiếp từ CDN bằng HTTP Range Requests.
6. Nhạc bắt đầu phát trong < 1 giây.
7. System tự động publish Song_Played event lên Kafka (UC-22). |
| Alternative / Exception | EX-1: S3 get-object timeout > 1s → retry Exponential Backoff, tối đa 3 lần. EX-2: Primary CDN fail → fallback sang secondary CDN. EX-3: Bài hát không tồn tại → 404 SONG_NOT_FOUND. |
| Postconditions | Bài hát đang phát trên client. Song_Played event được ghi vào Analytics. |
| Non-functional | Streaming start time < 1s. Pre-signed URL TTL: 15 phút. <<include>> UC-22 (Tracking sự kiện). |
| Related US / Epic | US-3.1, US-4.1 | EPIC 3, EPIC 4 |



| UC-06  Seek (tua) bài hát |
| --- |
| Actor(s) | Listener |
| Trigger | Listener kéo thanh progress bar đến vị trí mới. |
| Preconditions | Listener đang phát nhạc (UC-05). |
| Main Flow | 1. Listener kéo progress bar đến timestamp 01:45.
2. Client gửi HTTP Range Request với header Range: bytes=X-Y.
3. Streaming Service trả HTTP 206 Partial Content với audio chunk từ timestamp tương ứng.
4. Client tiếp tục phát từ vị trí mới. |
| Alternative / Exception | ALT-1: Range không hợp lệ → 416 Range Not Satisfiable. EX-1: CDN miss → fetch trực tiếp từ Origin với bandwidth throttling. |
| Postconditions | Playback tiếp tục từ đúng vị trí được seek. |
| Non-functional | HTTP Range Requests (RFC 7233). Chunk size: ~64KB. Budget: < 500ms để bắt đầu play từ vị trí mới. |
| Related US / Epic | US-3.1 | EPIC 3 |



| UC-07  Xem thông tin bài hát |
| --- |
| Actor(s) | Listener, Creator |
| Trigger | Người dùng click vào bài hát để xem chi tiết. |
| Preconditions | Đã đăng nhập. |
| Main Flow | 1. Người dùng click vào bài hát.
2. Client gửi GET /api/v1/music/songs/{songId}.
3. Music Service trả metadata: title, artist, genre, mood, duration.
4. Thông tin được render trên UI. |
| Alternative / Exception | EX-1: Bài hát không tồn tại → 404 SONG_NOT_FOUND. |
| Postconditions | Metadata bài hát được hiển thị đầy đủ. |
| Non-functional | Budget: 200ms. Cache: Redis TTL 30 phút. |
| Related US / Epic | EPIC 3 |



Recommendation (EPIC 2)

| UC-08  Xem gợi ý nhạc theo ngữ cảnh |
| --- |
| Actor(s) | Listener |
| Trigger | Listener mở trang Home hoặc yêu cầu recommendations. |
| Preconditions | Listener đã đăng nhập. Onboarding đã hoàn thành (UC-03). |
| Main Flow | 1. Listener truy cập trang Home.
2. Client gửi GET /api/v1/recommendations?context=morning&limit=10.
3. Recommendation Service xác định context từ time-of-day (sáng/chiều/tối/khuya).
4. Rule Engine tính score: base_score + context_bonus + preference_bonus - skip_penalty.
5. Truy vấn Redis để lấy user preference weights và trending sorted set.
6. Trả về >= 5 bài kèm explain_text (VD: 'Gợi ý buổi sáng', 'Vì bạn nghe Indie Rock').
7. Kết quả được cache tại Redis (TTL 1h, key: recs:{userId}:{context}). |
| Alternative / Exception | ALT-1: Rule Engine timeout > 300ms → fallback về Top 50 Trending từ Redis cache. ALT-2: User mới không có play history → trả bài theo genres từ onboarding. EX-1: Redis miss hoàn toàn → trả empty recommendations với explain_text 'Đang tải...'. |
| Postconditions | Danh sách gợi ý được hiển thị cùng explain_text. Cache được làm mới. |
| Non-functional | Budget: 300ms. CTR target: > 10%. Cache hit ratio: > 80%. Không dùng Vector DB hay ML model (Rule-based only — PRD V5). |
| Related US / Epic | US-2.1 | EPIC 2 |



| UC-09  Cung cấp phản hồi Play / Skip |
| --- |
| Actor(s) | Listener, System |
| Trigger | Listener nghe bài > 80% duration (Play) hoặc skip < 30% duration (Skip). |
| Preconditions | Listener đang phát nhạc. Bài hát có songId hợp lệ. |
| Main Flow | 1. Streaming Service phát hiện play event hoặc skip event.
2. Gửi POST /api/v1/recommendations/feedback với action=PLAY hoặc SKIP.
3. Hệ thống kiểm tra idempotency qua Redis SET (eventId, TTL 24h).
4. Publish Song_Played hoặc Song_Skipped event (v1) lên Kafka.
5. Recommendation Service consume event → cập nhật genre weight trong Redis (TTL 7 ngày):
   • PLAY (>80%): tăng weight của genre bài đó.
   • SKIP (<30%): giảm weight của genre bài đó. |
| Alternative / Exception | ALT-1: Duplicate event (same eventId) → bỏ qua (idempotency via Redis SET). EX-1: Kafka down → lưu tạm local disk queue, retry khi Kafka phục hồi. |
| Postconditions | Preference weights của người dùng được cập nhật trong Redis. Analytics Service nhận event để ghi log. |
| Non-functional | Budget: 100ms (trả 202 Accepted ngay — async). Idempotency TTL: 24h. Kafka: at-least-once; Consumer: effectively-once nhờ Redis SET dedup. <<include>> UC-22, UC-23. |
| Related US / Epic | US-2.2, US-4.1 | EPIC 2, EPIC 4 |



Listening Party (EPIC 7 — Phase 2)

| UC-10  Tạo phòng nghe nhạc |
| --- |
| Actor(s) | Listener (trở thành Host) |
| Trigger | Listener nhấn nút 'Tạo phòng'. |
| Preconditions | Listener đã đăng nhập. |
| Main Flow | 1. Listener nhấn 'Tạo phòng', nhập tên phòng.
2. Client gửi POST /api/v1/parties.
3. Listening Party Service tạo roomId và joinCode (6 ký tự).
4. State phòng được lưu vào Redis cluster (ephemeral).
5. Trả về roomId + joinCode.
6. Listener chia sẻ joinCode với bạn bè. |
| Alternative / Exception | EX-1: Redis crash → state phòng bị mất. Trade-off được chấp nhận (PRD V5). User tạo phòng mới. EX-2: Idempotency conflict (same Idempotency-Key) → 409 IDEMPOTENCY_CONFLICT. |
| Postconditions | Phòng được tạo, Host là người tạo. JoinCode sẵn sàng để chia sẻ. |
| Non-functional | Budget: 200ms. State lưu Redis (ephemeral) — mất nếu Redis crash (trade-off chấp nhận được). |
| Related US / Epic | US-7.1 | EPIC 7 |



| UC-11  Tham gia phòng qua Join Code |
| --- |
| Actor(s) | Listener (Member) |
| Trigger | Listener nhận joinCode từ Host và nhập vào ô Join. |
| Preconditions | Listener đã đăng nhập. Phòng tồn tại và đang hoạt động. |
| Main Flow | 1. Listener nhập joinCode.
2. Client gửi POST /api/v1/parties/{joinCode}/join.
3. Server xác nhận joinCode hợp lệ, lấy state từ Redis.
4. Trả về: roomId, hostId, currentSongId, playbackPositionSec.
5. Client mở WebSocket connection tới /ws/v1/parties/{roomId}.
6. Member bắt đầu nhận SYNC_STATE events từ Host. |
| Alternative / Exception | ALT-1: joinCode không tồn tại → 404 ROOM_NOT_FOUND. EX-1: Mất kết nối WebSocket → reconnect Exponential Backoff (1s, 2s, 4s, max 30s). |
| Postconditions | Member đã join phòng và đồng bộ với playback của Host. |
| Non-functional | Budget: 150ms (REST join). WebSocket sync delay < 500ms. |
| Related US / Epic | US-7.1 | EPIC 7 |



| UC-12  Điều khiển phát nhạc (Host) |
| --- |
| Actor(s) | Listener — Host |
| Trigger | Host nhấn Play / Pause / Seek trong phòng nghe nhạc. |
| Preconditions | Host đã tạo hoặc được bầu làm Host. WebSocket connection đang active. |
| Main Flow | 1. Host nhấn Play/Pause/Seek.
2. Client gửi PLAYER_ACTION event qua WebSocket.
3. Server xác thực: chỉ chấp nhận action từ Host (Host Authority model).
4. Server cập nhật playback state trong Redis.
5. Server broadcast SYNC_STATE event tới tất cả members trong phòng.
6. Tất cả members đồng bộ trong < 500ms. |
| Alternative / Exception | ALT-1: Member gửi PLAYER_ACTION (không phải Host) → server reject. ALT-2: Conflict (2 requests cùng lúc) → áp dụng Host state, broadcast correction. EX-1: Host disconnect > 5s → auto re-election: promote member latency thấp nhất làm Host mới. |
| Postconditions | Toàn bộ members đồng bộ với playback state của Host. |
| Non-functional | Sync delay < 500ms. Heartbeat: Ping 30s, Pong timeout 10s → disconnect. Host Authority: chỉ Host mới có quyền điều khiển. |
| Related US / Epic | US-7.2 | EPIC 7 |



| UC-13  Đồng bộ nhạc realtime (Member) |
| --- |
| Actor(s) | Listener — Member |
| Trigger | Member reconnect sau khi mất kết nối mạng. |
| Preconditions | Member đã join phòng (UC-11). Phòng vẫn còn hoạt động. |
| Main Flow | 1. Member mất kết nối WebSocket.
2. Client tự động thử reconnect với Exponential Backoff.
3. Sau khi kết nối lại: gọi lại POST /parties/{joinCode}/join.
4. Server trả currentSongId và playbackPositionSec hiện tại từ Redis (theo Host state).
5. Client resync về đúng vị trí. |
| Alternative / Exception | EX-1: Phòng không còn tồn tại trên Redis → thông báo 'Phòng đã kết thúc', redirect về Home. |
| Postconditions | Member đã resync thành công, nghe cùng vị trí với Host. |
| Non-functional | Reconnect: Exponential Backoff (1s, 2s, 4s, max 30s). |
| Related US / Epic | US-7.3 | EPIC 7 |



Creator Features (EPIC 1 & 4)

| UC-14  Tải nhạc lên hệ thống |
| --- |
| Actor(s) | Creator |
| Trigger | Creator nhấn nút 'Upload' trong Creator Dashboard. |
| Preconditions | Creator đã đăng nhập với role Creator. File audio hợp lệ (MP3/WAV, max 50MB). |
| Main Flow | 1. Creator chọn file audio và điền metadata (title, genre, mood).
2. Client gửi POST /api/v1/music/songs (multipart/form-data).
3. Music Service upload file lên S3 (retry Exponential Backoff nếu fail).
4. Sau khi S3 upload thành công: lưu metadata vào PostgreSQL.
5. Publish New_Release event (v1) lên Kafka.
6. Notification Service consume event → fan-out alert tới followers.
7. Trả songId và status=PROCESSING về Creator. |
| Alternative / Exception | ALT-1: File > 50MB → 413 PAYLOAD_TOO_LARGE. ALT-2: Format không hợp lệ → 400 VALIDATION_ERROR. EX-1: S3 upload fail sau 3 retry → 503, không commit vào DB (atomicity). |
| Postconditions | Bài hát có trên hệ thống và visible với Listeners. Followers nhận notification. |
| Non-functional | Budget: 5000ms (file upload — khác SLO thông thường). Atomic: không commit DB nếu S3 fail. |
| Related US / Epic | US-1.3 | EPIC 1 |



| UC-15  Xem Heatmap Skip-rate |
| --- |
| Actor(s) | Creator, Admin |
| Trigger | Creator mở Creator Dashboard và chọn Analytics của một bài. |
| Preconditions | Creator đã đăng nhập với role Creator. Bài hát đã có đủ dữ liệu analytics (ít nhất 1 ngày). |
| Main Flow | 1. Creator chọn bài hát trong Dashboard.
2. Client gửi GET /api/v1/analytics/creator/heatmap/{songId}?timeRange=7d.
3. Analytics Service truy vấn Time-series DB / Read-Replica.
4. Kiểm tra cache Redis (TTL 6h, key: heatmap:{songId}:{timeRange}).
5. Trả dữ liệu dropOffs: list các giây bị skip nhiều nhất.
6. Frontend render biểu đồ heatmap trực quan. |
| Alternative / Exception | ALT-1: Non-Creator / Non-Admin → 403 FORBIDDEN (RBAC). ALT-2: Bài hát không tồn tại → 404 SONG_NOT_FOUND. EX-1: Query timeout → serve stale cache nếu có; nếu không có cache trả empty data với warning. |
| Postconditions | Heatmap được hiển thị, Creator biết giây nào bị skip nhiều nhất. |
| Non-functional | Budget: 500ms. Cache: Redis TTL 6h. RBAC: chỉ Creator sở hữu bài hoặc Admin. |
| Related US / Epic | US-4.2 | EPIC 4 |



| UC-16  Xem thống kê lượt nghe |
| --- |
| Actor(s) | Creator, Admin |
| Trigger | Creator mở tab Stats trong Creator Dashboard. |
| Preconditions | Creator đã đăng nhập. Bài hát đã có dữ liệu analytics. |
| Main Flow | 1. Creator chọn bài hát và timeRange.
2. Client gửi GET /api/v1/analytics/creator/stats/{songId}?timeRange=7d.
3. Analytics Service trả: dailyListeners (chart), uniqueUsers (số).
4. Frontend render biểu đồ Daily Active Listeners và Unique Users. |
| Alternative / Exception | ALT-1: Non-Creator → 403 FORBIDDEN. |
| Postconditions | Creator thấy được hiệu suất bài hát theo thời gian. |
| Non-functional | Budget: 500ms. Dữ liệu cập nhật hàng ngày qua Kafka pipeline. Cache: Redis TTL 1h. |
| Related US / Epic | US-4.2 | EPIC 4 |



Notification (EPIC 6)

| UC-17  Nhận thông báo bài hát mới |
| --- |
| Actor(s) | Listener (follower của Creator) |
| Trigger | Creator upload bài mới (UC-14 hoàn thành), New_Release event được publish. |
| Preconditions | Listener đã follow Creator. Kafka event New_Release (v1) được publish. |
| Main Flow | 1. Music Service publish New_Release event lên Kafka.
2. Notification Service consume event.
3. Lấy danh sách followers của Creator từ User Service.
4. Fan-out push notification tới từng follower (async).
5. Lưu notification vào MongoDB.
6. Listener mở app thấy notification badge. |
| Alternative / Exception | EX-1: Fan-out fail một phần → retry async độc lập cho từng follower. EX-2: Fan-out fail sau 3 retry → DLQ (giữ 7 ngày). |
| Postconditions | Tất cả followers nhận được notification về bài mới. |
| Non-functional | Async fan-out — không block Creator upload flow. DLQ retention: 7 ngày. |
| Related US / Epic | US-6.1 | EPIC 6 |



| UC-18  Đánh dấu đã đọc thông báo |
| --- |
| Actor(s) | Listener |
| Trigger | Listener click vào notification hoặc nhấn 'Đọc tất cả'. |
| Preconditions | Listener đã đăng nhập. Có ít nhất 1 unread notification. |
| Main Flow | 1. Listener xem danh sách notifications (GET /api/v1/notifications/unread).
2a. Đánh dấu 1 notification: PATCH /notifications/{id}/read.
2b. Đánh dấu tất cả: PATCH /notifications/read-all.
3. MongoDB cập nhật trạng thái read=true.
4. Badge count giảm xuống. |
| Alternative / Exception | ALT-1: Notification không tồn tại → 404 NOTIFICATION_NOT_FOUND. ALT-2: Gọi lại với cùng Idempotency-Key → 409 IDEMPOTENCY_CONFLICT (idempotent). |
| Postconditions | Notification được đánh dấu đã đọc. |
| Non-functional | Budget: 150ms. Idempotency-Key TTL: 24h. |
| Related US / Epic | US-6.1 | EPIC 6 |



Admin Features

| UC-19  Quản lý người dùng |
| --- |
| Actor(s) | Admin |
| Trigger | Admin truy cập trang quản lý Users trong Admin Dashboard. |
| Preconditions | Admin đã đăng nhập với role Admin. |
| Main Flow | 1. Admin xem danh sách users (search, filter by role).
2. Admin có thể: khoá/mở khoá tài khoản, thay đổi role, xem lịch sử hoạt động.
3. Mọi thao tác được ghi vào Audit Log. |
| Alternative / Exception | ALT-1: Non-Admin → 403 FORBIDDEN. EX-1: User không tồn tại → 404 USER_NOT_FOUND. |
| Postconditions | Thay đổi được áp dụng, Audit Log được ghi. |
| Non-functional | RBAC: chỉ Admin. Audit log mọi thay đổi. |
| Related US / Epic | EPIC 0 (RBAC) |



| UC-20  Kiểm duyệt nội dung |
| --- |
| Actor(s) | Admin |
| Trigger | Admin nhận report nội dung vi phạm hoặc chủ động review. |
| Preconditions | Admin đã đăng nhập. Nội dung vi phạm được flag. |
| Main Flow | 1. Admin xem danh sách nội dung bị report.
2. Admin review và quyết định: Approve / Remove.
3. Nếu Remove: bài hát bị unpublish khỏi Music Service.
4. Creator nhận notification về quyết định. |
| Alternative / Exception | ALT-1: Nội dung hợp lệ → Approve, xóa khỏi review queue. |
| Postconditions | Nội dung vi phạm được xử lý. |
| Non-functional | RBAC: chỉ Admin. |
| Related US / Epic | PRD V5 — Admin persona |



| UC-21  Giám sát hệ thống |
| --- |
| Actor(s) | Admin |
| Trigger | Admin truy cập Observability Dashboard (Prometheus/Grafana). |
| Preconditions | Admin đã đăng nhập. Prometheus và Grafana đang chạy. |
| Main Flow | 1. Admin xem metrics: API latency (p95), Streaming start time, Kafka lag, CTR.
2. Admin xem Centralized Logs với CorrelationId để trace request xuyên services.
3. Admin nhận alert khi metrics vượt threshold (VD: Kafka lag > 10s). |
| Alternative / Exception | EX-1: Prometheus down → alert được gửi qua email/Slack. |
| Postconditions | Admin nắm được tình trạng hệ thống realtime. |
| Non-functional | CorrelationId propagated xuyên suốt. Metrics: API Latency < 500ms, Streaming start time < 1s. |
| Related US / Epic | PRD V5 — Observability |



System Automated (Background Processes)

| UC-22  Tracking sự kiện phát nhạc |
| --- |
| Actor(s) | System (Streaming Service → Kafka → Analytics Service) |
| Trigger | Bài hát được phát hoặc skip bởi Listener. |
| Preconditions | Song_Played / Song_Skipped event được publish lên Kafka. |
| Main Flow | 1. Streaming Service publish Song_Played hoặc Song_Skipped event (v1) lên Kafka.
2. Analytics Service consume event.
3. Kiểm tra idempotency: Redis SET (eventId, TTL 24h).
4. Lưu vào Time-series DB (Append-only).
5. Nếu duplicate: bỏ qua (effectively-once). |
| Alternative / Exception | EX-1: Retry tối đa 3 lần Exponential Backoff. EX-2: Sau 3 lần fail → DLQ (giữ 7 ngày). EX-3: Kafka down → local disk queue, retry khi phục hồi. |
| Postconditions | Playback event được lưu vào Analytics DB. Dữ liệu sẵn sàng cho Creator Dashboard. |
| Non-functional | Budget: 50ms (trả 202 ngay — async). Effectively-once = at-least-once Kafka + Redis SET dedup. Append-only: không sửa data cũ. |
| Related US / Epic | US-4.1 | EPIC 4 |



| UC-23  Cập nhật trọng số gợi ý (Rule Engine) |
| --- |
| Actor(s) | System (Kafka → Recommendation Service) |
| Trigger | Song_Played hoặc Song_Skipped event được publish. |
| Preconditions | Recommendation Service đang subscribe topic Song_Played và Song_Skipped. |
| Main Flow | 1. Recommendation Service consume Song_Played/Song_Skipped event.
2. Kiểm tra idempotency (Redis SET, eventId TTL 24h).
3. PLAY (durationPercent > 80%): tăng genre weight trong Redis (+preference_bonus).
4. SKIP (durationPercent < 30%): giảm genre weight trong Redis (-skip_penalty).
5. Weights có TTL 7 ngày — tự động expire nếu user không active. |
| Alternative / Exception | EX-1: Redis write fail → retry 3 lần; log warning nếu vẫn fail. |
| Postconditions | User preference weights trong Redis được cập nhật. Recommendations tiếp theo sẽ phản ánh hành vi mới nhất của user. |
| Non-functional | Near-realtime: cập nhật trong vài giây sau event. Redis TTL: 7 ngày per user weight. Idempotency: Redis SET (TTL 24h). |
| Related US / Epic | US-2.2 | EPIC 2 |



| UC-24  Fan-out thông báo tới Followers |
| --- |
| Actor(s) | System (Kafka → Notification Service) |
| Trigger | New_Release event được publish khi Creator upload bài mới. |
| Preconditions | Music Service đã publish New_Release event (v1) thành công. |
| Main Flow | 1. Notification Service consume New_Release event.
2. Lấy danh sách followers của Creator từ User Service.
3. Fan-out: tạo notification record trong MongoDB cho từng follower.
4. Publish Notification_Sent event (v1) lên Kafka.
5. Analytics Service ghi lại delivery rate. |
| Alternative / Exception | EX-1: Fan-out fail một phần → retry async độc lập per follower. EX-2: Fail sau 3 retry → DLQ (giữ 7 ngày). |
| Postconditions | Tất cả followers có notification về bài mới. Notification_Sent event được ghi vào Analytics. |
| Non-functional | Async — không block Creator upload. DLQ retention: 7 ngày. Fan-out partial failure không ảnh hưởng các follower khác. |
| Related US / Epic | US-6.1 | EPIC 6 |



— End of Document —