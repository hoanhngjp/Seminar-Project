# Changelog — Smart Music Streaming Platform

**Mục đích:** Ghi lại toàn bộ thay đổi có ý nghĩa của dự án theo từng milestone.
Tài liệu này dành cho: thầy hướng dẫn, hội đồng bảo vệ, và thành viên nhóm.

**Cách cập nhật:**
1. Mỗi khi hoàn thành feature/fix/task đáng kể, thêm vào `[Unreleased]`.
2. Khi kết thúc milestone, chuyển nội dung xuống section tương ứng và ghi ngày.
3. Sub-sections: **Added**, **Changed**, **Fixed**, **Removed**.

Format chuẩn: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

---

## [Unreleased]

### Added

**Frontend — MSW Mock Mode (2026-05-14)**
- `src/mocks/data.ts` — mock data tiếng Việt: 8 bài hát, 2 user profiles (Listener + Creator), 4 notifications, analytics stats 7d/30d, deterministic heatmap pattern, mock party
- `src/mocks/handlers.ts` — 18 MSW handlers phủ toàn bộ API: auth (login/refresh/logout), users/me, recommendations, streaming URL, music CRUD, search, notifications (read/read-all), analytics (stats/heatmap/play event), listening party (create/join)
- `src/mocks/browser.ts` — MSW browser worker setup
- `public/mockServiceWorker.js` — MSW service worker (generated via `npx msw init public/`)
- `.env.development` — `VITE_MOCK=true` bật mock mode mặc định khi `npm run dev`

**Frontend Phase 7 (partial) — Creator Dashboard (2026-05-14)**
- `CreatorDashboardPage.tsx` — rewrite hoàn toàn theo Stitch design: 4 KPI cards với trend badges, Skip Heatmap với tooltip + peak marker, SVG Line Chart, CSS Bar Chart, SVG Donut Chart, song selector dropdown, auto-load khi mount
- `domain.ts` — thêm `completionRate?: number` vào `AnalyticsStats`
- Creator Dashboard tests (15/15 xanh): RBAC, auto-load, KPI values, charts, time range switch, song selector, error state

**Frontend Phase 4 — App Shell + Home Page (2026-05-13)**
- `Sidebar.tsx` — Stitch-based redesign: "Thư viện của bạn" static section, user bottom section (displayName từ `/users/me`), notification dot từ `/notifications/unread` count
- `features/recommendation/hooks/useRecommendations.ts` — hook fetch + split items theo reason.type (CONTEXT / TRENDING / PREFERENCE)
- `features/recommendation/components/SongCard.tsx` — Stitch card design: hover play button overlay, cover art, explain badge
- `services/userService.ts` — thêm `getProfile()` method để lấy displayName
- Sidebar tests (17/17 xanh): navigation, Thư viện section, user bottom, notification dot
- HomePage tests (19/19 xanh): 3 sections, song cards, playback, error, empty, retry

### Changed

**Frontend Phase 4 — Home Page refactor (2026-05-13)**
- `HomePage.tsx` — refactor sang Stitch design: sticky header với greeting + time context + upgrade button, 3 recommendation sections (HorizontalSection × 2, GridSection × 1), dùng SongCard component, xóa inline styles

**Infrastructure — GCS + Cloudinary (2026-05-13)**
- `infra/.env.example` — Thêm biến `GCP_PROJECT_ID`, `GCP_BUCKET_NAME`, `GOOGLE_APPLICATION_CREDENTIALS` cho Google Cloud Storage (lưu trữ file .mp3)
- `infra/.env.example` — Thêm biến `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_SECURE` cho Cloudinary (lưu trữ avatar, ảnh bìa album/playlist)

### Changed

**Infrastructure — Chuyển từ AWS S3/MinIO sang GCS + Cloudinary (2026-05-13)**
- Music Service: storage backend chuyển từ AWS SDK (MinIO local) → Google Cloud Storage SDK cho file audio .mp3
- Streaming Service: pre-signed URL provider chuyển từ S3 → GCS Signed URL (vẫn giữ 900s expiry)
- Image assets (avatar, album art): dùng Cloudinary thay vì S3 bucket riêng

**Frontend Refactor Phase 0 — Tailwind CSS + Service Layer (2026-05-12)**
- `services/frontend/tailwind.config.ts` — Tailwind v4 config với 65 color tokens, fontSize scale, borderRadius, boxShadow từ Google Stitch design output
- `services/frontend/vite.config.ts` — thêm `@tailwindcss/vite` plugin
- `services/frontend/src/index.css` — migrate sang Tailwind directives + giữ CSS custom properties
- `services/frontend/src/types/api.ts` — `ApiResponse<T>`, `ApiMeta`, `ApiError` (shared response types)
- `services/frontend/src/types/domain.ts` — domain models: `Song`, `User`, `RecommendedSong`, `SearchResult`, `Notification`, `Party`, `AnalyticsStats`, v.v.
- `services/frontend/src/utils/errorMessages.ts` — map tất cả API error codes → tiếng Việt
- `services/frontend/src/utils/time.ts` — `getTimeContext()`, `getGreeting()` (morning/afternoon/evening/night)
- `services/frontend/src/services/api.ts` — Axios instance migrate từ `api/client.ts`
- `services/frontend/src/services/recommendationService.ts`, `analyticsService.ts`, `notificationService.ts`, `searchService.ts` — service layer dùng `ApiResponse<T>` types

### Changed

**Backend & Frontend Alignment — Onboarding API (2026-05-12)**
- `services/user-service` — Đổi trường `PreferredLanguages` thành `PreferredArtists` trong `UserPreferences`, `UpdatePreferencesRequest`, `UserPreferencesDto` và Kafka event `UserPreferencesUpdatedEvent`.
- `services/user-service` — API `GET /api/v1/users/me` (và `UserProfileDto`) giờ đây trả về cờ `HasCompletedOnboarding` (kiểm tra `prefs != null && prefs.PreferredGenres.Count >= 3`).
- `services/user-service/src/UserService.Infrastructure` — Thêm EF Core migration `UpdatePreferencesArtists`.
- `services/frontend/src/services/authService.ts` — Lấy `hasCompletedOnboarding` từ response của `getMe` và trả về cùng token.
- `services/frontend/src/store/authStore.ts` — Cập nhật `hasCompletedOnboarding` vào `useAuthStore` và thêm action `completeOnboarding`.
- `services/frontend/src/features/auth/hooks/useAuth.ts` — Xử lý logic redirect: Nếu role là `Listener` và `hasCompletedOnboarding` là false, tự động redirect sang `/onboarding` sau khi login thành công.

- `services/frontend/src/pages/HomePage.tsx` — migrate imports sang `services/*` + `types/domain`, update property names (`item.id`, `item.reason.text`)
- `services/frontend/src/pages/SearchPage.tsx` — migrate sang `searchContent()` + `SearchResult` type
- `services/frontend/src/pages/CreatorDashboardPage.tsx` — migrate sang `AnalyticsStats` shape (dailyListeners[], uniqueUsers) theo API contract
- `services/frontend/src/components/NotificationBell.tsx` — migrate sang `Notification` domain type (`notificationId`, `message`)
- `services/frontend/src/components/Player/AudioPlayer.tsx`, `src/hooks/usePartyWebSocket.ts` — update import path

**Bugfix — notification-service + recommendationApi (2026-05-12)**
- `infra/docker-compose.yml` — thêm `MongoDB__ConnectionString` + `mongodb: service_healthy` dependency cho notification-service (env var bị thiếu khiến service không start)
- `notification-service/KafkaConsumerBackgroundService.cs` — wrap `consumer.Consume(ct)` bằng `await Task.Run()` (blocking call block host startup → Kestrel không start), thêm `await Task.Delay(5s)` trong catch block (tránh tight loop)
- `notification-service/Program.cs` — thêm `BackgroundServiceExceptionBehavior.Ignore` + xóa `MapGet("/health")` trùng với HealthController
- `infra/` — tạo 5 Kafka topics (`Song_Played`, `Song_Skipped`, `New_Release`, `User_Preferences_Updated`, `Notification_Sent`) bằng `kafka-topics --create --if-not-exists`
- `services/frontend/src/api/recommendationApi.ts` — map Python snake_case response (`song_id`, `reason.text`) → camelCase (`songId`, `explainText`); fix `streaming/undefined/url` 404 + React key warning
- `services/frontend/src/tests/pages/HomePage.test.tsx` — cập nhật MSW mock data sang Python format (`song_id`, `reason: { type, text }`)

**Frontend Redesign Phase 2 — Auth Screens (2026-05-12)**
- `services/frontend/src/features/auth/hooks/useAuth.ts` — extracted Auth logic
- `services/frontend/src/features/auth/hooks/useProtectedRoute.ts` — extracted Route protection logic
- `services/frontend/src/services/authService.ts` — extracted API logic
- `services/frontend/src/features/auth/components/LoginForm.tsx` — Login component using new tokens and locked state
- `services/frontend/src/features/auth/components/RegisterForm.tsx` — Register component using new tokens and mock logic
- `services/frontend/src/features/auth/components/PasswordStrengthBar.tsx` — New password strength component
- `services/frontend/src/pages/LoginPage.tsx` — Refactored to utilize LoginForm
- `services/frontend/src/pages/RegisterPage.tsx` — Created the RegisterPage and added route `/register` to `App.tsx`

**Frontend Redesign Phase 3 & 6 — Restyle Pages & Tests Update (2026-05-12)**
- `services/frontend/src/pages/LoginPage.tsx` — Áp dụng font family, pill shape inputs, và button design với letter-spacing.
- `services/frontend/src/pages/HomePage.tsx` — Bọc trong `AppShell`, xóa bỏ `header`/`nav` cứng và `AudioPlayer` cục bộ. Thay thế `setSelectedSong` bằng `usePlayerStore((s) => s.setSong)`. Đưa card thiết kế về màu `colors.surface` với radius chuẩn.
- `services/frontend/src/pages/SearchPage.tsx` — Bọc trong `AppShell`. Áp dụng `radius.fullPill` cho search input. Tích hợp các font-awesome icons `<i className="fa-solid fa-magnifying-glass" />` thay cho placeholder emoji. Xóa `AudioPlayer` cục bộ và đổi sang gọi trạng thái global.
- `services/frontend/src/pages/CreatorDashboardPage.tsx` — Bọc trong `AppShell`. Định dạng lại layout với form input hình "pill", các Toggle cho 7 ngày/30 ngày dùng pill shape. Cập nhật Heatmap hiển thị `colors.error` và `colors.accent` từ hệ thống tokens.
- `services/frontend/index.html` — Đã chèn CDN FontAwesome Kit (`https://kit.fontawesome.com/39b6b90061.js`) để phục vụ bộ icon thống nhất cho ứng dụng.
- **Testing Updates**:
  - `services/frontend/src/tests/setup.ts` — Đảm bảo `afterEach` gọi `usePlayerStore.getState().clearSong()` để reset Zustand state giữa các test (ngăn rò rỉ state `currentSong`).
  - Cập nhật test files (`HomePage.test.tsx`, `SearchPage.test.tsx`, `CreatorDashboardPage.test.tsx`) để mock API Notifications `/api/v1/notifications/unread` vì các trang này giờ đây chứa `AppShell` (kèm `NotificationBell`).

**Frontend Redesign Phase 2 — AppShell Layout (2026-05-12)**
- `services/frontend/src/components/layout/AppShell.tsx` — Shared layout wrapper
  - Sidebar 240px fixed: logo "Smart Music" (#1ed760), nav links (Home / Search / Dashboard cho Creator+Admin), NotificationBell sticky ở bottom
  - Active link detection qua `useLocation()` — active: weight 700 + white + surface background; inactive: weight 400 + #b3b3b3
  - Main content area: `marginLeft: 240px`, `marginBottom: 90px`
  - Bottom player bar 90px fixed: AudioPlayer + close button nếu `playerStore.currentSong` có giá trị; placeholder text nếu không
  - Close button giữ `aria-label="Đóng player"` để tests không bị break

**Frontend Redesign Phase 1 — Design System Foundation (2026-05-12)**
- `services/frontend/src/styles/tokens.ts` — Design tokens theo DESIGN.md: colors, shadows, radius, font stacks, spacing, layout constants
- `services/frontend/src/store/playerStore.ts` — Zustand store cho shared player state (`currentSong`, `setSong`, `clearSong`) — chuẩn bị cho AppShell bottom player bar
- `services/frontend/src/index.css` — Rewrite toàn bộ global CSS: dark theme `#121212`, CSS custom properties, font-family fallback stack (SpotifyMixUI → Helvetica Neue → system), reset margins/paddings, shimmer keyframe animation, dark scrollbar

### Changed

**Frontend Redesign Phase 1 — Design System Foundation (2026-05-12)**
- `src/index.css`: xóa Vite boilerplate (light/dark media query, purple accent, `#root` width 1126px), thay bằng Spotify-inspired dark theme

**Week 11 — Verification + Register Endpoint (2026-05-10)**
- `POST /api/v1/auth/register` — endpoint mới, không có trong API Design V2 (thêm cho demo)
  - Auth Service nhận request, validate, gọi User Service gRPC `CreateUser`
  - User Service hash BCrypt + tạo user trong PostgreSQL
  - Response 201: `{ userId, email, displayName, role }`
  - Hỗ trợ role `Listener` (default) và `Creator`; Admin không tạo được qua API
- `proto/user.proto` — thêm `CreateUser` RPC + `CreateUserRequest/Response` messages
- `UserGrpcService.cs` — implement `CreateUser` handler với validation + BCrypt hash
- `IUserRepository` + `UserRepository` — thêm `CreateAsync` + `ExistsByEmailAsync`
- Auth Service: `RegisterRequest/Response` DTO, `IAuthService.RegisterAsync`, `AuthService.RegisterAsync`, `UserGrpcClient.CreateUserAsync`
- Tests: 10 unit tests + 7 integration tests xanh (thêm 6 tests register mới)
- `infra/seed/demo_accounts.sh` — tạo 3 demo accounts qua API (listener, creator, listener2)
- `infra/verify_ac.sh` — script tự động verify 33 ACs bằng curl, output PASS/FAIL/SKIP có màu
- Fix: thêm `using Prometheus;` vào tất cả 9 Program.cs (extension method không nằm trong implicit usings)

**Week 10 — Observability (2026-05-10)**
- `infra/docker-compose.yml` — thêm Prometheus (port 9090) và Grafana (port 3001) services
- `infra/prometheus.yml` — scrape config cho 10 services (9 C# + 1 Python), interval 15s
- `infra/grafana/provisioning/datasources/prometheus.yml` — auto-provision Prometheus datasource
- `infra/grafana/provisioning/dashboards/dashboard.yml` — auto-provision dashboard provider
- `infra/grafana/dashboards/smart-music.json` — 4-panel dashboard: API Latency p95, Streaming Start Time p95, Kafka Consumer Lag, Recommendation CTR
- `prometheus-net.AspNetCore` (v8.2) thêm vào 9 C# services — expose `/metrics` endpoint trên cùng HTTP port
- `UseHttpMetrics()` + `MapMetrics()` thêm vào pipeline tất cả 9 C# Program.cs
- `prometheus-fastapi-instrumentator` (v6.1) thêm vào Recommendation Service — expose `/metrics` tự động
- `tests/load/streaming_url.js` — k6 load test: 50 VUs × 2 phút, threshold p95 < 150ms
- `tests/load/search.js` — k6 load test: 30 VUs × 2 phút, threshold p95 < 200ms
- `tests/load/recommendation.js` — k6 load test: 30 VUs × 2 phút, threshold p95 < 300ms

**Listening Party Service — Tuần 8 Track B: SignalR PartyHub**
- `PartyHub.cs` — SignalR Hub tại `/hubs/party?roomId=xxx`
  - `OnConnectedAsync`: verify room, add to SignalR group, send SYNC_STATE to caller, broadcast MEMBER_JOIN to others (AC7.3.1)
  - `OnDisconnectedAsync`: remove member, broadcast MEMBER_LEAVE; nếu Host → broadcast ROOM_CLOSED + delete room (Phase 1 — no re-election)
  - `PlayerAction(msg)`: validate hostId == Context.UserIdentifier → update Redis → broadcast SYNC_STATE to group (AC7.2.1); Member gửi → silently ignore + log (AC7.2.2)
  - `GetRoomId()` / `GetUserId()` virtual — testable không cần HttpContext mock
- `HubDtos.cs` — `PlayerActionMessage`, `SyncStateMessage`, `MemberJoinMessage`, `MemberLeaveMessage`, `RoomClosedMessage`
- `Program.cs` — `MapHub<PartyHub>("/hubs/party")` + SignalR KeepAlive 30s / ClientTimeout 40s
- `IPartyRepository` + `RedisPartyRepository` — 4 methods mới: `UpdateRoomStateAsync`, `RemoveMemberAsync`, `GetMembersAsync`, `DeleteRoomAsync`
- `IPartyService` + `PartyService` — 3 methods mới: `GetRoomAsync`, `UpdateRoomStateAsync`, `HandleMemberDisconnectAsync` (returns isHost)
- IntegrationTests.csproj — thêm `Microsoft.AspNetCore.SignalR.Client`
- Tests: 16 unit + 22 integration = **38/38 xanh**
  - Unit (service): GetRoom, UpdateRoomState (Play/Pause/Seek), HandleMemberDisconnect (member/host/race condition)
  - Hub unit (TestablePartyHub): PlayerAction auth AC7.2.1/7.2.2, action→isPlaying mapping, SEEK preserves state, OnConnected/Disconnected flows
  - Integration (SignalR TestServer): OnConnect→SYNC_STATE (AC7.3.1), Host PLAY→member SYNC_STATE <500ms (AC7.2.1), Member PlayerAction ignored (AC7.2.2), Host disconnect→ROOM_CLOSED, MEMBER_JOIN broadcast

**Frontend (React SPA) — Tuần 8 Track A: HomePage + SearchPage**
- `HomePage.tsx` — recommendations list: fetch theo time-of-day context (morning/evening/none), loading skeleton, song grid, `explainText` badge, click bài → mount AudioPlayer bar, error state + retry, empty state
- `recommendationApi.ts` — service layer: `fetchRecommendations(context, limit)`, `getTimeContext()` (pure function, dễ test)
- `SearchPage.tsx` — search input debounce 300ms, `GET /api/v1/search?q=...&type=song&limit=10`, cursor pagination (Load more), empty state, clear button, click → AudioPlayer bar
- `searchApi.ts` — service layer: `searchSongs(query, limit, cursor?)`
- `App.tsx` — wired `/search` route tới `SearchPage` (thay placeholder)
- Test infrastructure: vitest + @testing-library/react + msw v2 + jsdom (lần đầu thiết lập cho frontend)
- `vitest.config.ts`, `src/tests/setup.ts` — cấu hình test environment
- 42/42 tests xanh: 19 (HomePage) + 23 (SearchPage — auth redirect, debounce, render results, artist/album, empty state, clear button, load more + cursor pagination, click→AudioPlayer, API error fallback, new query resets results, searchApi params)

**Frontend (React SPA) — Tuần 9: CreatorDashboard + NotificationBell + usePartyWebSocket**
- `CreatorDashboardPage.tsx` — RBAC redirect nếu không phải Creator/Admin; Song ID input để xem analytics; heatmap visualization (đỏ = skipRate > 30%); 4 stats cards (totalPlays, totalSkips, uniqueListeners, avgListenPercent); time range selector 7d/30d; error state
- `analyticsApi.ts` — service layer: `fetchHeatmap(songId, timeRange)`, `fetchSongStats(songId, timeRange)`
- `NotificationBell.tsx` — bell icon + unread badge (cap 99+); dropdown listbox; poll mỗi 30s; optimistic mark-as-read (PATCH với `Idempotency-Key: crypto.randomUUID()`); restore on API failure; "Xem tất cả" khi hasMore; outside-click close
- `notificationApi.ts` — service layer: `fetchUnreadNotifications(limit)`, `markNotificationRead(id, idempotencyKey)`
- `usePartyWebSocket.ts` — SignalR hook thật (`@microsoft/signalr`); Exponential Backoff reconnect [1s,2s,4s,8s,16s,30s] (AC7.3.2); handles SYNC_STATE, MEMBER_JOIN, MEMBER_LEAVE, ROOM_CLOSED (→ navigate `/`); `sendPlayerAction` chỉ cho Host; `status` state tracking (connecting/connected/reconnecting/disconnected)
- `App.tsx` — wired `/dashboard` route tới `CreatorDashboardPage` (thay placeholder)
- Tests: **37 tests mới** — 10 (CreatorDashboard) + 13 (NotificationBell) + 14 (usePartyWebSocket)
- **Tổng frontend: 79/79 xanh**

### Notes
- `GET /api/v1/music/songs` (list by artist) không có trong API Design V2 — CreatorDashboard dùng Song ID input thay vì artist song list. Endpoint mới sẽ cần propose cho team nếu cần trong demo.
- `@microsoft/signalr` đã được install (`npm install @microsoft/signalr`).

---

## [Week 7 — Tuần 7] — 2026-05-06

> **Milestone:** Frontend Tuần 7 (LoginPage + AudioPlayer) + Listening Party REST + SYNC POINT.

### Added

**Frontend (React SPA)**
- `LoginPage.tsx` — form login, POST `/api/v1/auth/login`, lưu token in-memory (Zustand), redirect theo role (Creator → `/dashboard`, Listener → `/`)
- `AudioPlayer.tsx` — HTML5 `<audio>`, fetch pre-signed URL, play/pause/seek/volume, proactive URL re-fetch 60s trước expiry, best-effort analytics event
- `client.ts` — 401 `TOKEN_EXPIRED` interceptor: auto refresh via `/api/v1/auth/refresh`, queue concurrent requests, redirect `/login` nếu refresh fail
- `types/listening-party.ts` — SYNC POINT: TypeScript interfaces đúng contract (`PlayerAction`, `SyncState`, `MemberJoin`, `MemberLeave`, `HostChanged`, `RoomClosed`)

**Listening Party Service**
- `POST /api/v1/parties` — tạo room: roomId (UUID) + joinCode (6 ký tự alphanumeric), lưu Redis Hash TTL 24h, add host vào members Set — AC7.1.1
- `POST /api/v1/parties/{joinCode}/join` — lookup joinCode → roomId → HGETALL room state, add member — AC7.1.2, AC7.1.3
- `GatewayAuthHandler` — trust `X-User-Id`/`X-User-Role` headers (không re-validate JWT)
- `GlobalExceptionMiddleware` — map `RoomNotFoundException` → 404 `ROOM_NOT_FOUND`
- `RedisPartyRepository` — lazy factory pattern (fix WebApplicationFactory test isolation)
- Tests: 8 unit + 7 integration = **15/15 xanh**; ACs covered: AC7.1.1, AC7.1.2, AC7.1.3

### Fixed
- `types/listening-party.ts` — overwrite nội dung sai từ scaffold, replace với contract đúng từ `shared_contracts.md` Section 6

---

## [Week 5–6] — 2026-05-06

> **Milestone:** Search + Analytics + Notification — Creator thấy heatmap sau play/skip events.

### Added

**Analytics Service**
- `POST /api/v1/analytics/events/play` — 202 async: idempotency Redis SETNX `analytics:idem:{key}` TTL 24h, background Kafka publish + InfluxDB write, DLQ fallback `/tmp/analytics-dlq.jsonl` (Analytics Service)
- `GET /api/v1/analytics/creator/heatmap/{songId}?timeRange=7d|30d` — Creator ownership check via Music Service internal, Redis cache TTL 6h `heatmap:{songId}:{timeRange}`, Admin bypass (Analytics Service)
- `GET /api/v1/analytics/creator/stats/{songId}` — totalPlays, totalSkips, uniqueListeners, avgListenPercent; Redis cache TTL 6h `stats:{songId}` (Analytics Service)
- Kafka consumer `Song_Played` → InfluxDB `song_played` measurement, idempotency dedup `dedup:analytics:Song_Played:{eventId}` (Analytics Service)
- Kafka consumer `Song_Skipped` → InfluxDB `song_skipped` measurement (Analytics Service)
- Kafka consumer `Notification_Sent` → InfluxDB `notification_sent` counter (Analytics Service)
- `KafkaConsumerBackgroundService` — generic background service, manual commit, scope per message (Analytics Service)
- `GatewayAuthHandler`, `RedisIdempotencyRepository`, `RedisAnalyticsCache`, `KafkaEventPublisher`, `MusicServiceClient` (Analytics Service)
- `GET /internal/songs/{songId}` — trả `{ id, artistId, title }` cho Analytics Service ownership check (Music Service)
- Tests: 15 AnalyticsService unit + 13 AnalyticsController unit + 5 KafkaHandler unit = **32/32 xanh** (Analytics Service)
- ACs covered: AC4.1.1, AC4.1.2, AC4.1.3, AC4.1.4, AC4.2.1, AC4.2.2, AC4.2.3, AC4.2.4

**Notification Service**
- `GET /api/v1/notifications/unread` — cursor pagination (ObjectId-based), filter `status IN [Pending, Delivered]`, budget 150ms (Notification Service)
- `PATCH /api/v1/notifications/{id}/read` — idempotent via `Idempotency-Key`, Redis SETNX `notification:idem:{key}` TTL 24h, ownership check (Notification Service)
- `PATCH /api/v1/notifications/read-all` — 202 async, bulk MongoDB UpdateMany background, budget 200ms (Notification Service)
- Kafka consumer `New_Release` → full cursor-loop fan-out tới tất cả followers (batch 500), insert MongoDB, publish `Notification_Sent` best-effort, retry 3x Exponential Backoff (Notification Service)
- `MongoNotificationRepository` — MongoDB.Driver 2.28, ObjectId cursor pagination, bulk InsertMany (Notification Service)
- `RedisIdempotencyRepository` — `SETNX` TTL 24h (Notification Service)
- `UserServiceClient` — `IAsyncEnumerable<Guid>` cursor loop, full pagination via `/internal/artists/{artistId}/followers` (Notification Service)
- `KafkaEventPublisher` — Confluent.Kafka, idempotent producer, local file fallback (Notification Service)
- `GatewayAuthHandler` — trust `X-User-Id`/`X-User-Role` headers (Notification Service)
- `GET /internal/artists/{artistId}/followers` — cursor pagination `follows` table (User Service)
- `Follow` domain model + EF Core mapping + `GetFollowerIdsAsync` (User Service)
- Tests: 18 unit (NotificationService 15 + NewReleaseHandler 3) + 13 integration = **31/31 xanh** (Notification Service)
- ACs covered: AC6.1.1, AC6.1.2, AC6.1.3

**Search Service**
- `GET /api/v1/search` — Elasticsearch 8 fuzzy search (fuzziness AUTO, fields title^3/artist^2/album), cursor pagination (base64 offset), Redis cache TTL 10m (`search:cache:{sha256}`), fallback `[]` on timeout/ES error (Search Service)
- `GatewayAuthHandler` — trust `X-User-Id`/`X-User-Role` từ API Gateway (Search Service)
- `ElasticsearchSearchRepository` — `Elastic.Clients.Elasticsearch` v8 client, MultiMatch query, offset-based pagination (Search Service)
- `RedisSearchCache` — TTL 600s, `StackExchange.Redis`, non-fatal on Redis failure (Search Service)
- `infra/seed/elasticsearch_seed.sh` — tạo index mapping + bulk-index 10 songs (Sơn Tùng M-TP x2, Chillies x2, Ngọt x4, Vũ. x2) (Infrastructure)
- Tests: 9 unit SearchService + 11 unit SearchController = **20/20 xanh** (Search Service)

---

## [Week 3–4] — 2026-05-05

> **Milestone:** Music + Streaming + Recommendation — Listener có thể nghe nhạc end-to-end.
> Creator upload → Music Service → Streaming Service cấp pre-signed URL → Listener nghe.
> Checkpoint W4: chờ verify end-to-end.

### Added

**Music Service**
- `POST /api/v1/music/songs` — upload audio (validate MIME magic bytes, max 50MB, S3-first atomicity, Exponential Backoff retry 3x, Kafka `New_Release` event sau khi commit DB) (Music Service)
- `GET /api/v1/music/songs/{songId}` — metadata lookup, Redis cache TTL 30m, key `song:meta:{songId}`, GatewayAuth (Music Service)
- `GET /internal/songs/{songId}/storage-key` — internal endpoint cho Streaming Service (Music Service)
- `GET /internal/songs/batch?ids=...` — batch metadata fetch cho Recommendation Service (Music Service)
- `GatewayAuthHandler` — trust `X-User-Id`/`X-User-Role` headers từ API Gateway (Music Service)
- `ISongCache` + `RedisSongCache` — cache abstraction tách Application khỏi Infrastructure (Music Service)
- EF Core migration `InitialCreate` — 5 tables: `artists`, `genres`, `albums`, `songs`, `song_genres` (music_db) (Music Service)
- `IdempotencyFilterAttribute` — Redis SET NX, TTL 24h, block duplicate upload (Music Service)
- Tests: 7 unit (mock S3/Kafka/DB) + 8 integration (native postgres music_db) = **15/15 xanh** (Music Service)

**Streaming Service**
- `GET /api/v1/streaming/{songId}/url` — gọi Music Service internal (timeout 150ms), generate pre-signed URL expiry chính xác 900s (AC3.1.3), GatewayAuth (Streaming Service)
- `GET /api/v1/streaming/{songId}/chunk` — HTTP Range Request, 206 Partial Content, S3 proxy via `ByteRange` (AC3.1.2), GatewayAuth (Streaming Service)
- `S3StoragePresigner` — pre-sign URL + byte-range fetch từ MinIO/S3 (Streaming Service)
- `MusicServiceClient` — typed HttpClient gọi `/internal/songs/{songId}/storage-key` (Streaming Service)
- Tests: 7 unit (mock-based) + 8 integration (WebApplicationFactory + mock DI) = **15/15 xanh** (Streaming Service)

**Recommendation Service**
- `GET /api/v1/recommendations` — fallback chain: cache HIT → Rule Engine (300ms timeout) → Top 50 Trending (AC2.1.1, AC2.1.4, AC2.1.5), GatewayAuth (Recommendation Service)
- `POST /api/v1/recommendations/feedback` — async 202, fire-and-forget weight update (Recommendation Service)
- Rule Engine — pure Python, formula: `base + context_bonus(+0.4) + preference_bonus - skip_penalty`, CONTEXT_GENRE_MAP 4 contexts, `TIMEOUT_MS=300` (Recommendation Service)
- `RedisRepository` — genre weights Hash, recommendation cache (TTL 1h), trending Sorted Set (read-only), idempotency SET NX (TTL 24h), onboarding prefs (Recommendation Service)
- Kafka consumer `Song_Played` — duration >= 80% → +0.3 genre weight, cache invalidate (AC2.2.1) (Recommendation Service)
- Kafka consumer `Song_Skipped` — duration < 30% → -0.2 genre weight, cache invalidate (AC2.2.2) (Recommendation Service)
- Kafka consumer `User_Preferences_Updated` — seed onboarding genre prefs (Recommendation Service)
- Idempotency SET NX trước mỗi Kafka event, DLQ sau 3 retries Exp Backoff 1s→2s→4s (AC2.2.3) (Recommendation Service)
- Tests: 15 unit rule engine + 9 handlers + 7 service + 11 integration = **42/42 xanh**, 0 warnings (Recommendation Service)

**Infrastructure**
- Seed script `infra/seed/s3_seed.sh` — bucket `smartmusic-audio` + upload test MP3 lên MinIO (Infrastructure)
- Seed script `infra/seed/redis_seed.sh` — 50 trending songs trong `rec:trending:global` Sorted Set, TTL 1h (Infrastructure)

### Fixed

- Music Service: `ApiResponse<T>` — fix error shape thành `{ code, message }`, thêm `meta.apiVersion/requestId/timestamp` đúng contract (Music Service)
- Music Service: `POST /music/songs` — fix trả 201 thay vì 200 (Music Service)
- Music Service: `IStorageService.BucketName` property — Application layer không inject `IConfiguration` (Music Service)
- Recommendation Service: xóa UTF-8 BOM khỏi `pyproject.toml`; đổi `build-backend` sang `setuptools.build_meta` (Recommendation Service)

### Changed

- API Design V2: cập nhật mã lỗi 503 cho S3, chuẩn hóa response batch endpoint (Documentation)

---

## [Week 2] — 2026-05-05

> **Milestone:** Auth + User + API Gateway — login flow end-to-end hoạt động.
> Auth Service cấp JWT, User Service quản lý identity + preferences, API Gateway route + validate.

### Added

- Auth Service: `POST /api/v1/auth/login` — JWT access token + HTTP-only refresh cookie, brute-force lock sau 5 lần fail (Auth Service)
- Auth Service: `POST /api/v1/auth/refresh` — Refresh Token Rotation với reuse detection, revoke all sessions khi phát hiện tái sử dụng (Auth Service)
- Auth Service: `POST /api/v1/auth/logout` — revoke refresh token + blacklist access token JTI trong Redis (Auth Service)
- Auth Service: EF Core migration `InitialCreate` — tables `refresh_tokens`, `token_blacklist` (auth_db PostgreSQL) (Auth Service)
- User Service: `GET /api/v1/users/me` — profile từ PostgreSQL, Redis cache TTL 15m (User Service)
- User Service: `POST /api/v1/users/me/preferences` — lưu preferences + publish Kafka `User_Preferences_Updated` (User Service)
- User Service: gRPC server `GetUserProfile` + `VerifyCredentials` (User Service)
- User Service: Internal `GET /internal/users/{id}/preferences` cho Recommendation Service (User Service)
- User Service: EF Core migration `InitialCreate` — tables `users`, `user_preferences` (user_db PostgreSQL) (User Service)
- API Gateway: YARP routing 9 routes → 9 downstream services (API Gateway)
- API Gateway: `JwtValidationMiddleware` — validate HS256, check Redis blacklist `token:blacklist:{jti}`, skip login/refresh/health (API Gateway)
- API Gateway: `RateLimitingMiddleware` — Redis Sliding Window, login 10/min IP+SHA256(username), general 100/min IP (API Gateway)
- API Gateway: `CircuitBreakerMiddleware` — downstream timeout 2000ms → 503, swallow client disconnect gracefully (API Gateway)
- API Gateway: `CorrelationIdMiddleware` — generate/propagate `X-Correlation-Id` (API Gateway)

### Fixed

- User Service `DbInitializer`: thêm `if (db.Database.IsRelational())` trước `MigrateAsync()` — fix lỗi InMemory provider trong integration tests (User Service)
- Auth Service `user.proto`: thêm RPC `VerifyCredentials(username, password)` — Auth Service không connect trực tiếp vào `user_db` (Auth Service)
- API Gateway: Redis blacklist key đổi thành `token:blacklist:{jti}` (khớp với key Auth Service writes) (API Gateway)

---

## [Day 5] — 2026-05-03

> **Milestone:** Project scaffold — tất cả services build thành công, `GET /health` → 200.
> Checkpoint: 21 containers Up, 0 exited; 10 services `GET /health` → 200.

### Added

- Boilerplate 9 C# services theo Clean Architecture (Api/Application/Infrastructure/Domain): api-gateway, auth-service, user-service, music-service, streaming-service, listening-party-service, analytics-service, notification-service, search-service
- `GET /health` → 200 cho toàn bộ 9 C# services và Recommendation Service
- `CorrelationIdMiddleware` cài sẵn trên mọi C# service
- Boilerplate Recommendation Service (Python FastAPI) — `uvicorn` chạy được
- Boilerplate Frontend SPA (React + TypeScript + Vite) — `npm run dev` hiển thị "Smart Music Platform"
- `docker-compose up --build` — 21 containers healthy, 0 exited

### Fixed

- Pin `Microsoft.EntityFrameworkCore Version="8.0.*"` — mặc định `Version="*"` resolve 10.x không tương thích net8.0
- Pin `Microsoft.AspNetCore.Mvc.Testing Version="8.0.*"` — cùng lý do
- Pin `FluentAssertions` và `Moq` về version cụ thể trong tất cả test projects
- Thêm `ASPNETCORE_HTTP_PORTS=80` vào docker-compose — .NET 8 đổi default port từ 80 → 8080
- Sửa build context từ `./services/X` → `../services/X` trong docker-compose (relative từ `infra/`)
- Xóa `UseHttpsRedirection` khỏi pipeline — không cần trong container

### Changed

- YARP config yêu cầu placeholder `ReverseProxy: { Routes: {}, Clusters: {} }` trong `appsettings.json`
