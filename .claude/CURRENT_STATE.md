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
- [X] Checkpoint W9: 2-tab test — Host Play → Member sync < 500ms

### Frontend Phase 2 — New Pages & Components (Stitch designs)

- [X] Phase 0: Types (SongDetail, Artist, CreatorSongRow) + mock data vào `mocks/data.ts` — 21/21 tests xanh (2026-05-15)
- [X] Phase 1: EmptyState, SongContextMenu, UserMenuDropdown — 42 tests mới, 377/377 xanh (2026-05-15)
- [X] Phase 2: TimeRangeSelector, SongStatsCard, DailyListenersChart, HeatmapChart, CreatorSongTable — 94 tests mới, 471/471 xanh (2026-05-15)
- [X] Phase 3: ContextSelector, RecommendationFeedRow — 42 tests mới, 513/513 xanh (2026-05-15)
- [X] Phase 4: QueueDrawer + extend playerStore — 30 tests mới, 543/543 xanh (2026-05-15)
- [X] Phase 5: SongDetailPage, ArtistPage, CreatorSongAnalyticsPage, ProfilePage, PreferencesPage — 92 tests mới, 635/635 xanh (2026-05-15)
- [X] Phase 6: ArtistCard + Enhance HomePage (ContextSelector/FeedRow) + SearchPage (filter tabs + ArtistCard + EmptyState) + CreatorDashboardPage (CreatorSongTable) — 37 tests mới, 672/672 xanh (2026-05-15)
- [X] Phase 7: Sidebar + MobileNav updates — 8 tests mới, 680/680 xanh (2026-05-15)
- [X] Phase 8: Route registration (App.tsx) — 14 tests mới, 694/694 xanh (2026-05-15)
- [X] Phase 9: BottomPlayerBar QueueDrawer integration — 4 tests mới, 698/698 xanh (2026-05-15)

### Frontend Redesign — Spotify Design System (Stitch-based, full refactor)

- [X] Phase 0: Tailwind CSS v4 + @tailwindcss/vite cài đặt thành công
- [X] Phase 0: `tailwind.config.ts` — 65 color tokens, fontSize, borderRadius, boxShadow từ Stitch
- [X] Phase 0: `index.css` — @import Google Fonts (Plus Jakarta Sans) + Tailwind directives + CSS vars
- [X] Phase 0: `src/types/api.ts` — ApiResponse<T>, ApiMeta, ApiError
- [X] Phase 0: `src/types/domain.ts` — Song, User, Party, RecommendedSong, SearchResult, Notification, v.v.
- [X] Phase 0: `src/utils/errorMessages.ts` — error code → tiếng Việt mapping
- [X] Phase 0: `src/utils/time.ts` — getTimeContext(), getGreeting()
- [X] Phase 0: `src/services/api.ts` — migrate từ api/client.ts (giữ nguyên token refresh logic)
- [X] Phase 0: `src/services/recommendationService.ts`, analyticsService.ts, notificationService.ts, searchService.ts
- [X] Phase 0: Migrate tất cả imports từ `api/*` → `services/*` + `types/domain`
- [X] Phase 0: Build pass 0 errors, 0 warnings (2026-05-12)
- [X] Phase 1: Shared UI Components (Button, Input, Modal, Toast, Spinner, SkeletonRow, AppShell, Sidebar, BottomPlayerBar) — 55/55 tests xanh (2026-05-12)
- [X] Phase 2: Auth Screens (Login + Register + error states)
- [X] Phase 3: Onboarding Flow (3-step wizard) — Hoàn thành (UI + State + Redirect)
- [X] Phase 4: App Shell + Home Page — Sidebar (user profile + notification dot + Thư viện), SongCard, useRecommendations, HomePage 3-section Stitch layout — 35/35 tests xanh (2026-05-13)
- [X] Phase 7 (partial): Creator Dashboard — rewrite theo Stitch design: 4 KPI cards, Skip Heatmap, Line Chart, Bar Chart, Donut Chart, auto-load, song selector dropdown — 15/15 tests xanh (2026-05-14)
- [X] MSW Mock Mode — `VITE_MOCK=true` intercepts tất cả API calls trong `npm run dev`: auth, recommendations, streaming, search, notifications, analytics, party (2026-05-14)
- [X] Phase 5: SearchPage + NowPlayingOverlay — 29/29 tests xanh (2026-05-14)
- [X] Phase 6: Listening Party — PartyLandingPage, PartyRoomPage, CreateRoomModal, JoinRoomModal, MemberList, HostControls, RoomPlayer, useListeningParty — 78/78 tests xanh (2026-05-14)
- [X] Phase 6 bugfix: WS proxy (ws:// → http://), RoomPlayer layout (max-w-md removed), Sidebar /party → modal flow, CreateRoomModal onSwitchToJoin — 232/232 xanh (2026-05-14)
- [X] Phase 7: Creator Screens (UploadPage) — 15/15 tests xanh (2026-05-14)
- [X] Phase 8: Notifications + Polish — NotificationsPage, NotificationRow, FilterPills, useNotifications, ToastProvider (global), MobileNav (mobile bottom nav), BottomPlayerBar mobile offset — 314/314 tests xanh (2026-05-14)

### Backend API Alignment — FE ↔ BE Integration

- [X] Phase 1: Infrastructure setup — postgres init script, SeedData.sql, seed.sh, docker-compose GCS env vars, music-service auto-migrate (2026-05-15)
- [X] Phase 2A: Auth Service — accept `email` field + Google OAuth (`POST /api/v1/auth/google`, `Google.Apis.Auth` verify, auto-register)
- [X] Phase 2B: User Service — migration (preferred_artists nullable password_hash) + update DTOs + JOIN preferences
- [X] Phase 3: Music Service — migration (mood column) + enrich SongResponseDto + GCS verify
- [X] Phase 4: Streaming Service — GCS migration (Music+Streaming S3→GCS, field `url` ✅ match) — 14/14 + 11/11 tests xanh (2026-05-16)
- [X] Phase 5: Search Service — SearchItem DTO aligned (`name`, `coverUrl`, `duration`), seed script updated — 20/20 tests xanh (2026-05-16)
- [X] Phase 6: Analytics Service — HeatmapDTO `skipRate`→`count`, StatsDTO `DailyPlays`→`DailyListeners` — 32/32 tests xanh (2026-05-16)
- [X] Phase 7: Notification Service — remap NotificationDto fields — 18/18 tests xanh (2026-05-16)
- [X] Phase 8: Listening Party — Option B: FE hub URL `/hubs/party?roomId=` + vite `/hubs` proxy + MemberJoinMessage DisplayName/AvatarUrl — 14/14 FE tests xanh, 10/10 BE tests xanh (2026-05-16)
- [X] Phase 9: Recommendation Service — seed Redis trending + verify internal Music call (2026-05-16)
- [X] song_artists junction table (EF Core migration AddSongArtistsTable) — FeaturedArtists in SongResponseDto (2026-05-16)
- [X] Seed 30 songs thật từ GCS + 16 artists + song_artists collab records (2026-05-16)

### Week 10–12 — Polish + Demo

- [X] Prometheus metrics expose trên tất cả services (prometheus-net 8.2 + fastapi-instrumentator 6.1)
- [X] Grafana dashboard: 4 panels (latency, streaming, kafka lag, CTR) — `infra/grafana/dashboards/smart-music.json`
- [X] k6 load test: tests/load/streaming_url.js — p95 < 150ms
- [X] k6 load test: tests/load/search.js — p95 < 200ms
- [X] k6 load test: tests/load/recommendation.js — p95 < 300ms
- [X] POST /api/v1/auth/register endpoint — Auth Service + User Service gRPC CreateUser
- [X] infra/seed/demo_accounts.sh — tạo listener@ + creator@ qua API
- [X] infra/verify_ac.sh — 33 ACs automated curl verification (PASS/FAIL/SKIP)
- [X] AC checklist W11: verify_ac.sh — **23 PASS / 0 FAIL / 26 SKIP** (2026-05-16)
- [X] Frontend real API integration (Option B): tắt VITE_MOCK=false + wire 5 pages + backend 2 endpoints mới — 695/695 tests xanh (2026-05-16)
- [X] Runtime bug fix: `GET /streaming/undefined/url` — guard playerStore + BottomPlayerBar + getArtist() mapping (2026-05-16)
- [X] Runtime bug fix: GatewayAuth "Missing X-User-Id" — YARP explicit `AddTransforms` copy identity headers (2026-05-16)
- [X] Runtime bug fix: 401 `/recommendations` sau page refresh — `AuthInitializer` + `RequireAuth` + `authStore.isInitialized` (2026-05-16)
- [X] Runtime bug fix: infinite update loop — `AuthInitializer` object selector → 3 selector riêng (2026-05-16)
- [X] Test fix: 696/696 xanh — `song_id`→`songId` mock, playerStore selector pattern, App.test.tsx mock authStore (2026-05-16)
- [X] Runtime bug fix: `SearchPage` crash `results.filter is not a function` — `searchService.ts` type mismatch + test mock update (2026-05-17)
- [X] Runtime bug fix: Google OAuth GSI_LOGGER 400 — thêm `VITE_GOOGLE_CLIENT_ID` vào `.env.development` (2026-05-17)
- [X] Runtime bug fix: 401 UNAUTHORIZED khi click play từ SearchPage — mở rộng interceptor handle `UNAUTHORIZED` + `TOKEN_EXPIRED`, `??` thay `||` cho baseURL, `VITE_API_BASE_URL=` để đi qua Vite proxy (2026-05-17)
- [X] Runtime bug fix: analytics/events/play 400 Bad Request — fix request body (durationSec/listenedSec/platform), đổi timing gửi sang onDurationChange + hasStartedRef (2026-05-17)
- [X] Upload 30 cover images lên Cloudinary (smart-music/covers/) + cập nhật CoverImageUrl trong SeedData.sql + UPDATE live DB music_db (2026-05-17)
- [X] Bug fix: Elasticsearch re-index 30/30 docs với URL thật (reindex_elasticsearch.py) + fix Search Service cover_url deserialization + xóa stale search cache (2026-05-17)
- [X] Bug fix: Recommendation Service — 3 bugs: env var mismatch (MUSIC_SERVICE_URL→MUSIC_SERVICE_BASE_URL), cache snake_case→camelCase, thêm coverUrl vào BatchSongDto — homepage giờ hiển thị songs thật với ảnh bìa Cloudinary (2026-05-17)
- [X] Bug fix: Recommendation Service — stale poisoned cache cho context=evening/morning/etc — thêm `has_metadata` guard trước cache write + flush 4 stale Redis keys (2026-05-18)
- [X] Feature: CreateRoomModal — thay 8 mock songs bằng real API: recommendations (4 bài theo timeContext) khi default + search infinite scroll (IntersectionObserver + cursor pagination) khi gõ query — 18/18 tests xanh (2026-05-18)
- [X] Feature 1+2: URL slug (`slugify.ts` + `songUrl()`) + tách click navigate/play trong SongCard — 726/726 tests xanh (+25 tests) (2026-05-18)
- [X] Feature 3: Nút + Queue trong SongCard + RecommendationFeedRow — 737/737 tests xanh (+11 tests) (2026-05-18)
- [X] Feature 4: NowPlayingOverlay tabs — queue tab wire real playerStore queue + related tab fetch by artist (searchContent) — 750/750 tests xanh (+13 tests) (2026-05-18)
- [X] Player Enhancements: dedup queue, skip prev/next, shuffle/repeat, click-to-play queue (QueueDrawer + NowPlayingOverlay), history-based playPrev, onEnded auto-advance — 772/772 tests xanh (+22 tests) (2026-05-18)
- [X] QueueDrawer drag-and-drop reorder (HTML5 DnD, line indicator, reorderQueue store action) + SearchPage + Queue button (SongsList + RelatedSongsGrid) — 790/790 tests xanh (+18 tests) (2026-05-18)
- [X] BottomPlayerBar hiện khi thêm vào queue (autoPlay: false) + Toast notification khi add/duplicate — 790/790 tests xanh (2026-05-18)
- [X] Bug fix: POST /api/v1/parties 400 — BE accept Name?+SongId? optional, FE đổi firstSongId→songId (2026-05-18)
- [X] Bug fix: Listening Party member names không hiển thị — empty string DisplayName fallback (`IsNullOrWhiteSpace` thay `??`), InternalUsersController fallback sang Username, authStore.displayName fallback sang username, MemberList hiện "Me" cho current user (2026-05-18)
- [X] Bug fix (Bug 7): SignalR "connection was stopped during negotiation" — bỏ React StrictMode khỏi main.tsx (2026-05-18)
- [X] Rebuild frontend container — confirmed: negotiate 200, WebSocket 101, user ở trong phòng, không bị kick (2026-05-18)
- [X] Listening Party end-to-end: tất cả 7 bugs đã fix và xác nhận (2026-05-18)
- [X] Bug 8: BottomPlayerBar không auto-play / pause khi party room sync — `autoPlay?` flag + `pauseSignal` (2026-05-18)
- [X] Bug 0: Duration 0:00 trong Recommendation Feed — pipeline fix (BatchSongDto → MusicBatchSong → SongCandidate → SongItem) + frontend map + flush Redis cache (2026-05-18)
- [X] Bug 1: BottomPlayerBar move ra App.tsx — song không còn mất khi navigate (2026-05-18)
- [X] Bug 2: `autoPlay: true` trong HomePage + SearchPage — nhạc tự phát sau khi chọn bài (2026-05-18)
- [~] Bug A (= Bug 9): BottomPlayerBar seek bar không hiển thị — đã thử flex restructure (`flex items-center` + non-absolute track), cần verify browser thật
- [X] Bug B: NowPlayingOverlay fill lag sau thumb — `isDragging` check trên transition (2026-05-18)
- [X] Bug C: RoomPlayer duration mismatch — `audioDuration` store, BottomPlayerBar write, RoomPlayer dùng `effectiveDuration` (2026-05-18)
- [X] Bug 10: SignalR disconnect sau ~30s — `KeepAliveInterval=15s`/`ClientTimeoutInterval=60s` server + `serverTimeoutInMilliseconds=60000` client (2026-05-18)
- [X] Bug 11: Pause reset positionSec về 0 — `handleSyncState` guard `sync.positionSec > 0` (2026-05-18)
- [X] Bug 12: Resume sau pause reset bài về đầu — `resumeSong()` signal thay vì `playSong()` (2026-05-18)
- [X] Party Queue Phase 1 — Backend core: `QueueItem`, `QueueFullException`, Redis queue key, `IPartyRepository`/`RedisPartyRepository` queue methods, `IPartyService`/`PartyService` queue methods, `PartyHub` (QueueAdd/Remove/Next), `PartiesController` GET queue — 28/28 tests xanh (2026-05-18)
- [X] Party Queue Phase 2 — Frontend: `songEndSignal`+`triggerSongEnd` (playerStore), `QueueItem`/`QueueUpdated` types (listening-party.ts), `usePartyWebSocket` queue state+QUEUE_UPDATED handler+`sendQueueAdd`/`sendQueueRemove`/`sendQueueNext`, `PartyQueue.tsx` (mini search debounce 300ms + queue list + remove button) — 820/820 tests xanh (+30 tests) (2026-05-18)
- [X] Party Queue Phase 3 — Integration: `PartyRoomPage` tab bar (Thành viên|Hàng chờ), wire `usePartyWebSocket`, auto-advance `songEndSignal→sendQueueNext`, `handleNext→sendQueueNext`, `handlePrev→seek 0`, `PartyQueue` enrich metadata (getSong + skeleton), `BottomPlayerBar.onEnded` thêm `triggerSongEnd()` — 832/832 xanh (+12 tests) (2026-05-18)
- [X] Party Queue Phase 4 — Polish: (1) Member pause→play: `preSyncPositionOnPlay` + `estimateCurrentPosition()`; (2) Late-join: `LastUpdatedAt` Redis + `OnConnectedAsync` adjustedPos; (3) Queue `NowPlayingRow` "Đang phát" pinned top; (4) Member close-bar re-sync via `syncTick` — 832/832 xanh (2026-05-18)
- [X] Lyrics Phase 1 — `seed_lyrics.sh` seed 21 bài LRC vào `music_db.songs.Lyrics` + flush Redis cache (2026-05-18)
- [ ] Lyrics Phase 2 — `LyricsDisplay.tsx` + wire `NowPlayingOverlay` tab "Lời bài hát"
- [ ] Lyrics Phase 3 — Party Room: button "Hàng chờ" → callback mở tab queue; tab "Hàng chờ" → "Lời bài hát" với `LyricsDisplay` + `positionSec`
- [ ] Demo script rehearsal: 14 phút, đủ tất cả tính năng
- [ ] Pre-upload demo songs cho Creator account

---

## Đang làm

- **Service/Task:** Lyrics Feature — 3 phases (LRC parse → LyricsDisplay → Party room integration)
- **File plan cần đọc:** `.claude/plan/week10_12_polish_demo.md`
- **Checkpoint gần nhất đã pass:** Party Queue Phase 4 Polish hoàn thành, 832/832 xanh (2026-05-18)
- **Ngày làm việc gần nhất:** 2026-05-18
- **Tiếp theo:**
  1. [DONE] Lyrics Phase 1 — seed_lyrics.sh + 21 bài LRC trong DB
  2. [TODO] Lyrics Phase 2 — SongResponseDto + LyricsDisplay component + wire NowPlayingOverlay
  3. [TODO] Lyrics Phase 3 — Party Room: tab đổi thành Lyrics với positionSec
  4. [TODO] Demo script rehearsal 14 phút
  5. [TODO] Pre-upload demo songs cho Creator account

**Party Queue Design Decisions:**
- Queue stored in Redis (Room JSON), max 50 items
- All members can add; adder can remove their own songs
- QueueItem = { SongId, AddedByUserId }
- Auto-advance: Host `onEnded` → `QueueNext` Hub method → server dequeue + broadcast SYNC_STATE + QUEUE_UPDATED
- No new Kafka topics — SignalR only

### CSS Audit Phase 1 — 6 Confirmed Violations (HOÀN THÀNH 2026-05-14)
| # | File | Fix | Status |
|---|------|-----|--------|
| V1 | `Sidebar.tsx` | `w-[240px]` → `w-[280px]` | ✅ |
| V2 | `AppShell.tsx` | `ml-[240px]` → `ml-[280px]` | ✅ |
| V3 | `Modal.tsx` | `rounded-lg` → `rounded-[8px]` | ✅ |
| V4 | `SongCard.tsx` | arbitrary shadow → `shadow-level-2` + hover `shadow-level-3` | ✅ |
| V5 | `SearchPage.tsx` | `border border-border-muted` + arbitrary inset → `shadow-input-inset` | ✅ |
| V6 | `tailwind.config.ts` | Tokens đã đúng spec — không cần sửa | ✅ |

### CSS Audit — 29 Files còn lại (chia 5 phases, mỗi phase cần xác nhận)

| Phase | Files | Nội dung | Status |
|-------|-------|----------|--------|
| Phase 2 | 7 | Foundation Components: `Button`, `Input`, `Toast`, `SkeletonRow`, `Spinner`, `BottomPlayerBar`, `MobileNav` | ✅ Hoàn thành (2026-05-14) |
| Phase 3 | 7 | Auth & Onboarding: `LoginPage`, `RegisterPage`, `OnboardingPage`, `LoginForm`, `RegisterForm`, `GenreGrid`, `ArtistGrid` | ✅ Hoàn thành (2026-05-14) |
| Phase 4 | 5 | Core App Pages: `HomePage`, `NotificationsPage`, `CreatorDashboardPage`, `UploadPage`, `NowPlayingOverlay` | ✅ Hoàn thành (2026-05-14) |
| Phase 5 | 6 | Listening Party: `PartyLandingPage`, `PartyRoomPage`, `CreateRoomModal`, `RoomPlayer`, `HostControls`, `MemberList` | ✅ Hoàn thành (2026-05-14) |
| Phase 6 | 4 | Notifications & Creator Features: `NotificationRow`, `FilterPills`, `FileDropzone`, `MetadataForm` | ✅ Hoàn thành (2026-05-14) |

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
| 2026-05-13 | Music / Streaming / Infra | Chuyển storage backend từ AWS S3/MinIO → Google Cloud Storage (audio .mp3) + Cloudinary (avatar, ảnh bìa). Env vars mới: `GCP_PROJECT_ID`, `GCP_BUCKET_NAME`, `GOOGLE_APPLICATION_CREDENTIALS`, `CLOUDINARY_*`. Service Account Key JSON tại `infra/secrets/google-cloud-key.json` (gitignored). |
| 2026-05-12 | User Service | Đổi `PreferredLanguages` thành `PreferredArtists` trong `UserPreferences`, và trả về `hasCompletedOnboarding` từ `GET /users/me` để FE redirect đúng. |
| 2026-05-15 | Auth Service | Google OAuth login: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` thêm vào `.env`. Flow: FE nhận Google `id_token` → `POST /api/v1/auth/google` → verify bằng `Google.Apis.Auth` → auto-register nếu user mới → phát JWT. `password_hash` trở thành nullable để support OAuth users không có password. |
| 2026-05-14 | Frontend | Vite WS proxy phải dùng `http://` target (không phải `ws://`) — `ws: true` flag đủ để handle WebSocket upgrade. |
| 2026-05-14 | Frontend | Sidebar giờ render CreateRoomModal/JoinRoomModal trực tiếp (không navigate `/party`). `/party` route + PartyLandingPage vẫn còn trong App.tsx cho backward compat với tests. |
| 2026-05-14 | Frontend | ToastProvider wrap toàn bộ app trong App.tsx — bất kỳ component nào cũng gọi `useToast().show()` cross-page. One-at-a-time toast (replace pattern). |
| 2026-05-14 | Frontend | MobileNav `fixed bottom-0 lg:hidden z-[60]`. BottomPlayerBar đổi sang `bottom-14 lg:bottom-0` để nhường chỗ cho MobileNav trên mobile. AppShell main padding: `pb-[128px] lg:pb-[72px]`. |
| 2026-05-14 | Frontend | Mock handler `GET /api/v1/notifications/unread` giờ trả ALL notifications (read + unread) + `totalUnread` count. NotificationsPage dùng toàn bộ items; Sidebar dùng `totalUnread` cho dot indicator. |
| 2026-05-16 | Infra | `docker-compose.yml` postgres port đổi từ `5432` → `5434` (host) vì native Windows PostgreSQL chiếm cả 5432 lẫn 5433. pgAdmin kết nối: `localhost:5434`. C# services không bị ảnh hưởng (dùng Docker internal network). |
| 2026-05-16 | docker-compose | Connection string env var key phải khớp với key C# đọc: `ConnectionStrings__AuthDb` (auth), `ConnectionStrings__Postgres` (user), `ConnectionStrings__DefaultConnection` (music). Dùng sai key → service fallback về appsettings.Development.json → connect localhost thay vì Docker internal host. |
| 2026-05-16 | appsettings.Development.json | Credentials cho local dev (dotnet ef, seed.sh): `Host=localhost;Port=5434;Username=smartmusic;Password=changeme_local`. Credentials này CHỈ dùng khi chạy từ host — Docker services đọc từ env var docker-compose. |
| 2026-05-16 | auth/user-service | Connection string: mỗi service chỉ đọc 1 key duy nhất — `ConnectionStrings:AuthDb` (auth), `ConnectionStrings:Postgres` (user), `ConnectionStrings:DefaultConnection` (music). Fail fast với `InvalidOperationException` nếu thiếu key. `appsettings.json` base dùng `Host=postgres` (Docker internal); `appsettings.Development.json` dùng `Host=localhost:5434` (host dev). |
| 2026-05-16 | API Gateway | YARP không tự forward headers được thêm bởi ASP.NET middleware vào proxied request. Fix: `AddTransforms(ctx => ctx.AddRequestTransform(...))` explicit copy `X-User-Id` + `X-User-Role`. Cần `using Yarp.ReverseProxy.Transforms;`. Áp dụng global cho mọi route — không cần config per-route trong `appsettings.json`. |
| 2026-05-16 | Music Service / Frontend | C# record field `Guid Id` → JSON `"id"` (camelCase). C# `Guid SongId` → JSON `"songId"`. Frontend mapping phải handle cả 2: `s.songId ?? s.id ?? ''`. Không dùng `String(song.id)` trực tiếp vì `String(undefined)` = `"undefined"` (string), không phải falsy. |

---

## Known Issues

_(Format: [service]: vấn đề — workaround: ...)_

- Recommendation Service: IDE VS Code Pylance báo "Cannot find module" — do IDE dùng global Python, không phải `.venv`. Tests chạy đúng với `.venv/Scripts/python -m pytest`.
- API Gateway: Sau khi sửa `Program.cs` thêm YARP transforms, cần `docker-compose up -d --build api-gateway` để apply. Container cũ vẫn dùng code cũ.
- Frontend: Sau khi sửa `BottomPlayerBar.tsx` / `playerStore.ts` / `recommendationService.ts`, cần restart Vite dev server (không chỉ HMR) để đảm bảo changes apply. Line numbers trong stack trace có thể lệch nếu HMR chưa reload đúng.

---

## Tham khảo nhanh

- Bug history & decisions: `.claude/DEVLOG.md`
- Lịch sử milestone: `CHANGELOG.md`
- Plan chi tiết hiện tại: `.claude/plan/frontend-phase2-new-pages-components.md`
