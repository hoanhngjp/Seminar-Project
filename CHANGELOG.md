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

**W11 CreateRoomModal — Real API + Infinite Scroll (2026-05-18)**
- `CreateRoomModal.tsx`: xóa 8 mock songs hardcoded, thay bằng `GET /api/v1/recommendations?context=<timeContext>&limit=4` khi mở modal (default list theo thời điểm trong ngày)
- `CreateRoomModal.tsx`: khi user gõ query, debounce 300ms gọi `GET /api/v1/search?q=...&type=song&limit=10` — container `max-h-[240px] overflow-y-auto`, `IntersectionObserver` trên sentinel div tự load trang tiếp theo khi cuộn
- 18/18 tests xanh (`IntersectionObserver` mock + load-more + reset to recommendations)

**W11 Frontend Real API Integration — VITE_MOCK=false + 5 Pages Wired (2026-05-16)**
- Music Service: `GET /api/v1/music/artists/{artistId}` — trả `ArtistResponseDto` (stageName, bio, totalFollowers, totalPlays, songs[])
- Music Service: `GET /api/v1/music/songs/my` — Creator/Admin only, trả danh sách bài hát của creator đang đăng nhập
- Frontend: `ArtistPage` wire thật với `getArtist()` — loading state, error state, follow toggle
- Frontend: `ProfilePage` wire thật với `userService.getProfile()` — avatar, display name, email, role, preferred genres/artists
- Frontend: `SongDetailPage` wire thật với `getSong()` + `fetchRecommendations()` — metadata grid, related songs
- Frontend: `CreatorSongAnalyticsPage` wire thật với `getSong()` + `fetchHeatmap()` + `fetchSongStats()` — KPI cards, daily chart, heatmap
- Frontend: `CreatorDashboardPage` wire thật với `getMySongs()` — song selector dropdown populated từ API (thay hardcoded options)
- `VITE_MOCK=false` trong `.env.development` — toàn bộ API calls đi thật đến backend

### Fixed

**W11 Bug Fix — Bug 8: Listening Party play/pause không trigger audio (2026-05-18)**
- `playerStore.ts`: thêm `autoPlay?: boolean` vào `CurrentSong` interface; thêm `pauseSignal: number` + `pauseSong()` action
- `BottomPlayerBar.tsx`: thêm `autoPlayRef` — consumed một lần sau khi stream URL load để auto-play; thêm `useEffect([pauseSignal])` gọi `.pause()` khi nhận lệnh pause từ bên ngoài
- `PartyRoomPage.tsx`: sync effect gọi `playSong({..., autoPlay: true})` khi play, `pauseSong()` khi pause
- 701/701 tests xanh

**W11 Bug Fix — Bug 9: Progress bar không chạy + seek không hoạt động (2026-05-18)**
- `PartyRoomPage.tsx`: thêm `setInterval` 1s tự tăng `positionSec` khi đang play → RoomPlayer progress bar chạy theo nhạc; tự reset về giá trị server khi nhận `SYNC_STATE`
- `RoomPlayer.tsx`: thêm prop `onSeek?(sec)` — Host có interactive seek bar + thumb; Member có read-only bar (không có thumb, tránh hiểu nhầm); thumb dùng React state `onMouseEnter/Leave` thay `group-hover` Tailwind (fix hover không trigger qua input)
- `playerStore.ts`: thêm `seekSignal`, `seekPosition`, `seekSong(positionSec)` — pattern giống `pauseSignal`
- `BottomPlayerBar.tsx`: thêm `preload="metadata"` trên `<audio>`; subscribe `seekSignal` để seek audio element thật; CSS restructure seek bar: `appearance-none` input, `relative z-10` track, DOM order input cuối; thumb dùng React state hover
- ⚠️ Còn pending: BottomPlayerBar progress track vẫn chưa visible (CSS conflict chưa xác định nguyên nhân)
- **W11 Bug Fix — Bug 10: SignalR disconnect (pending)**
- Bug 10: SignalR client timeout 30s vs server ping 30s → race condition qua YARP; fix plan: server `KeepAliveInterval=15s`, client `serverTimeoutInMilliseconds=60000`

**W11 Bug Fix — Bug 7: SignalR "connection was stopped during negotiation" (2026-05-18)**
- `main.tsx`: bỏ `<React.StrictMode>` wrapper — StrictMode gây effect double-invocation trong dev mode, trigger `OnDisconnectedAsync` giữa hai lần mount, xóa Redis room trước khi user kịp kết nối lần hai, dẫn đến `ROOM_CLOSED` + `navigate('/')` ngay khi vào phòng
- Root cause: StrictMode cleanup → `connection.stop()` → host disconnect → room xóa → effect re-mount → room null → user bị kick
- Chuỗi fix hoàn chỉnh (Bug 4→6→7): CircuitBreaker bypass WebSocket → `UseWebSockets()` cả api-gateway lẫn listening-party-service → CircuitBreaker bypass tất cả `/hubs/*` → bỏ StrictMode
- **Verified:** frontend rebuilt, negotiate 200 + WebSocket 101, user ở trong phòng, không bị kick — tất cả 7 bugs confirmed fixed (2026-05-18)

**W11 Bug Fix — Bug 1–6: Listening Party end-to-end integration (2026-05-17 → 2026-05-18)**
- Bug 1: `PartyRoomPage.tsx` — xóa MOCK_SONG/MOCK_MEMBERS; fetch song thật qua `getSong(currentSongId)`; cập nhật `currentSongId` khi nhận `SYNC_STATE` từ SignalR; `RoomPlayer.tsx` đổi prop `song: Song | null`
- Bug 2: `JwtValidationMiddleware.cs` — thêm fallback đọc `?access_token=` query param cho `/hubs/*` (SignalR WebSocket upgrade không set Authorization header); YARP config thêm `party-hubs-route`; `vite.config.ts` proxy target từ env var `VITE_PROXY_TARGET`
- Bug 3: `infra/docker-compose.yml` — thêm `VITE_PROXY_TARGET=http://api-gateway` cho frontend container; đổi `VITE_API_BASE_URL=` (empty — đi qua Vite proxy)
- Bug 4: `CircuitBreakerMiddleware.cs` (api-gateway) — early-return bypass `IsWebSocketRequest`; `Program.cs` (api-gateway) thêm `app.UseWebSockets()`
- Bug 5: `musicService.ts` — `getSong()` map `artist?.stageName`, `durationSec ?? duration`, `id ?? songId`; đổi return type sang `Song`
- Bug 6: `Program.cs` (listening-party-service) — thêm `app.UseWebSockets()` trước `app.UseRouting()`; `CircuitBreakerMiddleware.cs` mở rộng bypass sang tất cả `path.StartsWithSegments("/hubs")`

**W11 Bug Fix — POST /api/v1/parties 400 khi tạo phòng (2026-05-18)**
- `PartiesController.cs`: bỏ validation bắt buộc `songId` — tạo phòng không cần chọn bài trước
- `PartyDtos.cs`: `CreatePartyRequest` đổi thành `Name?` + `SongId?` (cả hai optional); `CreatePartyResponse` thêm `Name`
- `Room.cs`: thêm field `Name` (default `"Listening Party"`)
- `RedisPartyRepository.cs`: lưu/đọc field `name` vào Redis hash
- `partyService.ts` + `CreateRoomModal.tsx`: đổi `firstSongId` → `songId` để khớp với BE contract

**W11 Runtime Bug Fixes — 401 khi play từ SearchPage (2026-05-17)**
- `services/api.ts`: mở rộng interceptor xử lý cả `UNAUTHORIZED` lẫn `TOKEN_EXPIRED` — attempt refresh token trước khi fail, tránh trường hợp `_accessToken` null khi streaming request được gửi
- `services/api.ts`: đổi `||` → `??` cho `baseURL` — `VITE_API_BASE_URL=''` không bị fallback về `localhost:5000`
- `frontend/.env.development`: thêm `VITE_API_BASE_URL=` (empty string) — requests đi qua Vite proxy thay vì cross-origin trực tiếp đến `localhost:5000`

**W11 Infra — Cover images Cloudinary upload (2026-05-17)**
- Upload 30 cover images lên Cloudinary (`smart-music/covers/`, cloud `dd9umsxtf`) — thay thế toàn bộ placeholder URL `cloudinary.com/demo`
- `infra/seed/SeedData.sql`: cập nhật 30 `CoverImageUrl` thành URL thật
- `infra/seed/upload_covers.py`: script upload (cloudinary SDK, mapping public_id → filename)
- Live DB `music_db`: 30 × `UPDATE` áp dụng trực tiếp

**W11 Runtime Bug Fix — analytics/events/play 400 (2026-05-17)**
- `BottomPlayerBar.tsx`: fix `POST /api/v1/analytics/events/play` 400 Bad Request — body cũ gửi `durationPercent` (field không có trong BE DTO), thiếu `durationSec`/`listenedSec`/`platform`. Fix: gửi đúng `{ songId, durationSec, listenedSec, platform: 'web' }` với `Math.max(1, Math.round(durationSec))` để pass `[Range(1, 86400)]` validation
- `BottomPlayerBar.tsx`: đổi timing gửi analytics từ "khi bấm Play" sang "khi `onDurationChange` fire VÀ user đã play" — đảm bảo `durationSec` là giá trị thật, không phải 0 hoặc fallback; thêm `hasStartedRef` để track
- `BottomPlayerBar.test.tsx`: thêm 2 test — gửi đúng body sau `durationChange` + không gửi nếu chưa bấm play (13/13 xanh)

**W11 Bug Fix — Recommendation Service empty homepage (2026-05-17)**
- `infra/docker-compose.yml`: đổi `MUSIC_SERVICE_URL` → `MUSIC_SERVICE_BASE_URL` trong block `recommendation-service` — sai tên env var khiến service fallback về `localhost:5003` (không reach được trong Docker) → Music batch fail silently → songs không có title/artist
- `recommendation_service.py`: cache serialize dùng `model_dump(by_alias=True)` — fix bug cache lưu snake_case `song_id` trong khi FE filter theo camelCase `songId` → filter hết → empty state
- `SongResponseDto.cs` + `SongService.cs`: thêm `CoverImageUrl` vào `BatchSongDto` — fix thumbnail rỗng trên homepage recommendation cards
- `music_service_client.py`: đọc `coverImageUrl` từ batch response và truyền vào `SongCandidate.thumbnail`

**W11 Bug Fix — Recommendation Service stale poisoned cache (2026-05-18)**
- `recommendation_service.py`: không cache kết quả khi Music Service trả về empty metadata (`has_metadata` guard) — ngăn cache bị poison khi Music Service tạm down, tránh tái phát trong suốt TTL window tiếp theo
- Redis: flush 4 stale `rec:cache:*` keys bị poison với `title/artist/thumbnail=""` từ trước khi fix env var `MUSIC_SERVICE_BASE_URL`
- Root cause: `context=evening` và các context khác đã được cache với data rỗng trước khi rebuild container; cache TTL 1 giờ khiến stale data tồn tại qua các request tiếp theo

**W11 Bug Fix — Search Service cover_url deserialization (2026-05-17)**
- `ElasticsearchSearchRepository.cs`: thêm `[JsonPropertyName]` cho tất cả snake_case fields trong `ElasticsearchSongDocument` (`cover_url`, `is_explicit`, `is_published`, `play_count`, `duration_sec`) — fix `coverUrl: null` trong search results dù ES có URL thật
- Stale Redis search cache (`search:cache:*`) xóa targeted sau khi deploy fix

**W11 Runtime Bug Fixes — SearchPage + Google OAuth (2026-05-17)**
- `searchService.ts`: fix type mismatch — backend trả `data: { items, nextCursor, hasMore }` nhưng FE typed là flat `SearchResult[]` → `results.filter` crash. Fix: đúng type + đọc `d?.items`
- `SearchPage.test.tsx`: update MSW mock handlers trả đúng shape backend (`{ items, nextCursor, hasMore }`)
- `frontend/.env.development`: thêm `VITE_GOOGLE_CLIENT_ID` — fix Google OAuth GSI_LOGGER 400 error khi button render

**W11 Frontend Auth Flow Fix (2026-05-16)**
- `AuthInitializer` component: restore session từ HTTP-only refresh cookie khi app mount (`POST /auth/refresh` → `GET /users/me`) — fix 401 trên mọi protected API sau khi user refresh trang
- `RequireAuth` component: route guard hiện spinner khi session chưa được khởi tạo, redirect `/login` nếu unauthenticated
- `authStore`: thêm `isInitialized` flag — phân biệt "chưa check session" vs "đã check + không có token"
- `App.tsx`: 12 protected routes wrap trong `<RequireAuth>`, 3 public routes (`/login`, `/register`, `/onboarding`) không cần guard
- Fix `AuthInitializer` infinite re-render: tách object selector thành 3 selector riêng — object selector tạo new reference mỗi render gây zustand trigger loop vô hạn

**W11 Runtime Bug Fixes — Browser Testing VITE_MOCK=false (2026-05-16)**
- API Gateway: thêm YARP `AddTransforms` explicit copy `X-User-Id` + `X-User-Role` headers vào mọi proxied request — fix "Missing X-User-Id header from gateway" trên streaming/recommendation services. Root cause: YARP pipeline cần explicit transform để forward headers được thêm bởi middleware
- Frontend `musicService.ts getArtist()`: map `s.songId ?? s.id ?? ''` — handle C# field name `Id` serialize thành `"id"` (không phải `"songId"`) trong ArtistResponseDto.Songs
- Frontend `SongDetailPage.tsx`: map `songData.songId ?? songData.id ?? songId` để normalize field name từ API
- Frontend `playerStore.ts`: guard `if (!song.songId) return` trong `setSong`/`playSong` — prevent `GET /streaming/undefined/url` 404 khi `song.id` = JS undefined
- Frontend `BottomPlayerBar.tsx`: guard `if (!currentSong.songId) { clearSong(); return }` trước `fetchStreamUrl` — auto-cleanup stale store state
- Frontend `recommendationService.ts`: `.filter((item) => item.songId)` trước map — loại bỏ items thiếu songId, fix React "unique key" warning

**W11 Demo Prep — verify_ac.sh: 23/23 automated ACs PASS (2026-05-16)**
- `verify_ac.sh` — flush Redis rate-limit keys (`rate:*`, `rl:*`) trước mỗi lần chạy, tránh 429 false-fail khi chạy nhiều lần liên tiếp
- `verify_ac.sh` — `genreIds` trong AC1.3.1 upload test đổi từ `"genre-vpop-001"` → UUID `d4e5f6a7-b8c9-0123-defa-234567890123` (Pop genre) — `Guid.Parse` không parse string tự do
- `verify_ac.sh` — `UPLOADED_SONG_ID` extraction đổi từ `json_str "id"` → Python3 path `data.songId` (đúng với response schema)
- `infra/tests/fixtures/test-audio.mp3` — tạo file fixture với valid ID3 magic bytes để AC1.3.1 pass file validation
- Auth Service — `InvalidCredentialsException` mới trả HTTP 400 (thay vì 401) cho `AUTH_INVALID_CREDENTIALS` — khớp API Design V2
- User Service — `PreferredGenres`/`PreferredArtists` đổi từ `List<Guid>` → `List<string>` (DB column `uuid[]` → `text[]`) — fix AC1.2.1/1.2.3
- Search Service — `ElasticsearchSongDocument.Mood` đổi từ `string[]?` → `string?` — fix deserialization lỗi, AC5.1.1 PASS
- Elasticsearch — re-seed 30 songs từ Docker Alpine container (fix UTF-8 garbled từ Git Bash)
- Music Service — `StorageClient` đăng ký lazy (`Lazy<StorageClient>`) — không gọi GCS credentials khi startup
- Tất cả 8 C# services — Redis `ConfigurationOptions.AbortOnConnectFail = false` set explicit (thay vì chỉ trong connection string) — fix startup failure khi Redis chưa ready
- Listening Party Service — config key đổi từ `REDIS_CONNECTION_STRING` → `Redis:ConnectionString` — khớp với ASP.NET double-underscore env var mapping
- `infra/secrets/google-cloud-key.json` — copy từ service account key với tên chuẩn, mount vào streaming-service + music-service
- Music DB — tạo artist record cho `creator@example.com` (userId `2b654acb-...`) — fix AC1.3.1 "Creator profile not found"
- `verify_ac.sh` — thay 3 `grep -oP` cuối còn lại bằng Python3 equivalents (fix locale error trên Git Bash)

### Added

**Music Service — song_artists Table + Real Song Seed (2026-05-16)**
- `song_artists` junction table: support primary + featured artist per song (SongId, ArtistId nullable, DisplayName, Role, DisplayOrder)
- 16 Artist records: Vũ., Sơn Tùng M-TP, Ngọt, TaynguyenSound, The Aaron Smith Experience, Miki Matsubara, Low G, Thắng, Dick, Tùng TeA, PC, Trang, Dear Jane, Night Tempo, Tofu, NewoulZ
- 29 bài nhạc thật seed vào `music_db` với storage_key trỏ thẳng GCS bucket `smart-music-microservices`
- `SongResponseDto` — thêm `FeaturedArtists: List<FeaturedArtistDto>` (backward compat, default empty)
- `redis_seed.sh` + `elasticsearch_seed.sh` cập nhật với 29 song UUIDs mới

**Backend — API Alignment Phase 5: Search Service DTO Fix (2026-05-16)**
- `SearchItem` — đổi `Title` → `Name`, bỏ `Album`/`Genre` (FE không dùng), thêm `CoverUrl` (string?) và `Duration` (int? seconds) để khớp FE type `{id, name, type, score, coverUrl, artist?, duration?}`
- `ElasticsearchSongDocument` — thêm `CoverUrl`, `DurationSec` để map từ ES document
- `elasticsearch_seed.sh` — thêm `cover_url` (keyword) và `duration_sec` (integer) vào index mapping và 10 seed documents
- **20/20 unit tests xanh** (2 `SearchItem` constructor calls và 1 `.Title`→`.Name` assertion cập nhật)

**Backend — API Alignment Phase 7: Notification Service DTO Fix (2026-05-16)**
- `NotificationDto` — remap hoàn toàn để khớp FE schema `{notificationId, message, read, createdAt, type?}`: `Id`→`NotificationId`, `Body`→`Message`, `Status==Read`→`Read` (bool), `Type` enum → `"new_release"`/`"system"` lowercase; bỏ `Title`, `ThumbnailUrl`, `ArtistId`, `SongId` (FE không dùng)
- `NotificationService.GetUnreadAsync` — cập nhật mapper theo DTO mới; `type` dùng switch expression chuẩn lowercase
- **18/18 unit tests xanh** (1 test assertion cập nhật: `Id`→`NotificationId`, `Status`→`Read`, `Type`→`"new_release"`)

**Backend — API Alignment Phase 6: Analytics Service DTO Fix (2026-05-16)**
- `HeatmapPoint` — đổi `SkipRate: double` → `Count: int` để khớp FE type `{second, count}`
- `DailyPlay` → `DailyListenerPoint`, field `Plays: long` → `Count: int`; `StatsResponse.DailyPlays` → `DailyListeners` để khớp FE type `dailyListeners[]{date, count}`
- `AnalyticsController.GetStats` — đổi JSON key `dailyPlays` → `dailyListeners` trong response
- `InfluxAnalyticsRepository` — `HeatmapPoint` giờ dùng `count` thực từ InfluxDB thay vì giá trị cứng `0.1`
- **32/32 unit tests xanh** (2 tests cũ cập nhật argument kiểu int)

**Backend — API Alignment Phase 3: Music Service (2026-05-16)**
- `Song.cs` — thêm `Mood` property (`string?`, max 50 chars)
- Migration `20260516000000_AddMoodToSongs` — thêm cột `mood VARCHAR(50)` vào bảng `songs`
- `SongResponseDto` — thêm 5 fields mới: `GenreName`, `MoodName`, `Language`, `ReleaseDate`, `PlayCount` để FE nhận đủ data hiển thị song card
- `MusicRepository.GetSongByIdAsync` — thêm `.ThenInclude(sg => sg.Genre)` để load tên genre thực sự (trước đây luôn null)
- 3 unit tests mới cho `MapToResponseDto`: genre/mood mapping, album release date, no-genre fallback — **10/10 xanh**

### Changed

**Infra — Fix docker-compose connection string key mismatch (2026-05-16)**
- `infra/docker-compose.yml` — đổi env var key cho 3 services để khớp với key code C# đang đọc: `ConnectionStrings__AuthDb` (auth), `ConnectionStrings__Postgres` (user), `ConnectionStrings__DefaultConnection` (music). Trước đây cả 3 đều dùng `ConnectionStrings__PostgreSQL` dẫn đến services fallback về `appsettings.Development.json` với `localhost:5434` → connection refused trong Docker
- `appsettings.Development.json` (auth, user, music) — đổi credentials từ `postgres/4L27hN04@:5432` → `smartmusic/changeme_local:5434` để `dotnet ef` và `seed.sh` từ host connect đúng vào Docker postgres
- `infra/.env` + `infra/.env.example` — thêm `POSTGRES_PORT=5434` để seed.sh psql health check dùng đúng host port
- `infra/seed/seed.sh` — update header comment ghi rõ prerequisite phases phải done trước khi chạy

**Backend — API Alignment Phase 1: Infrastructure Setup (2026-05-15)**
- `infra/postgres/init/01_create_databases.sql` — tự động tạo 7 databases khi postgres container khởi động lần đầu (auth_db, user_db, music_db, streaming_db, listening_party_db, analytics_db, notification_db)
- `infra/seed/SeedData.sql` — seed 9 genres, 1 artist, 8 songs với GCS audio keys, listener preferences cho music_db + user_db
- `infra/seed/seed.sh` — master seed script: wait postgres → EF migrations → SQL seed → Elasticsearch seed → Redis seed
- `services/music-service/src/MusicService.Api/Program.cs` — auto-migrate music_db tại startup (pattern giống user-service)

### Changed

**Backend — docker-compose GCS migration (2026-05-15)**
- `infra/docker-compose.yml` — music-service + streaming-service: thay AWS S3/MinIO env vars bằng GCS env vars (`GCP__ProjectId`, `GCP__BucketName`, `GOOGLE_APPLICATION_CREDENTIALS`) + Cloudinary env vars cho music-service; auth-service thêm `Google__ClientId`; secrets volume mount `/app/secrets/` cho cả 2 services

**Backend — API Alignment Plan + Google OAuth (2026-05-15)**
- `.claude/plan/backend-api-alignment-frontend.md` — kế hoạch 9 phases align toàn bộ BE APIs với FE schema, sau khi Frontend UI hoàn thành 698/698 tests xanh
- Khảo sát thực tế xác định 8 gaps: Auth LoginRequest field name, User DTO thiếu preferences + onboarding flag, Music DTO thiếu genreName/moodName/language/playCount, Analytics heatmap field rename, Notification DTO remap hoàn toàn, Streaming field name verify, Listening Party WS path mismatch, Infrastructure trống (seed data, Elasticsearch index, InfluxDB bucket)
- Dependency graph: Phase 1 (infra) → Group A song song (Phase 2–4, 6–8) → Group B (Phase 5, 9 cần song data)
- **Google OAuth login** tích hợp vào Phase 2A: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` → `POST /api/v1/auth/google` mới; FE gửi Google `id_token` → BE verify bằng `Google.Apis.Auth` → auto-register user mới → phát JWT; `password_hash` trở thành nullable trong `users` table; `proto/user.proto` thêm `GetUserByEmail` RPC; FE thêm Google Sign-In button trên `LoginPage`

### Fixed

**Infra — Connection string single-key + appsettings.json cleanup (2026-05-16)**
- `auth-service/DependencyInjection.cs` — xóa fallback chain, chỉ đọc `ConnectionStrings:AuthDb`; fail fast nếu thiếu
- `user-service/DependencyInjection.cs` — xóa chain 3 bước, chỉ đọc `ConnectionStrings:Postgres`; fail fast nếu thiếu
- `user-service/Program.cs` — health check dùng cùng key đơn, không fallback `localhost`
- `auth-service/appsettings.json` + `user-service/appsettings.json` — thay credentials cũ `postgres/4L27hN04@:5432` bằng Docker internal hostname `postgres:5432` với credentials mới

**Infra — PostgreSQL port conflict với native Windows PostgreSQL (2026-05-16)**
- `infra/docker-compose.yml` — đổi port mapping postgres từ `5432:5432` → `5434:5432` để tránh conflict với 2 native PostgreSQL instances đang chiếm port 5432 và 5433 trên máy Windows
- Kết nối pgAdmin: `localhost:5434`, user `smartmusic`, password `changeme_local`

**Frontend — Verification + UI bug fixes (2026-05-15)**
- `Sidebar.tsx` — "Analytics" nav link đổi từ `/analytics` (không tồn tại) → `/dashboard`
- `Sidebar.tsx` — UserMenuDropdown move ra ngoài `<nav>` stacking context; dùng `position: fixed` + `getBoundingClientRect()` + `zIndex: 60`; dropdown giờ hiển thị trên BottomPlayerBar đúng cách
- `FilterPills.tsx` — active pill active state đổi `bg-[#ffffff]` → `!bg-[#ffffff]`; root cause: `index.css` `button { background: none; }` là unlayered CSS, thắng `@layer utilities` của Tailwind v4, khiến mọi `bg-*` class trên button bị vô hiệu
- 15 TypeScript errors trong 8 files (unused imports, type mismatches, literal type inference) — build giờ pass 0 errors

### Added

**Frontend — Phase 2 Phase 9: BottomPlayerBar QueueDrawer integration (2026-05-15)**
- `BottomPlayerBar.tsx` — nút `queue_music` (`data-testid="open-queue-btn"`) toggle `showQueue` state; `QueueDrawer` render khi `showQueue=true`, đóng qua `onClose`; z-index: QueueDrawer backdrop `z-[59]` / panel `z-[60]`, NowPlayingOverlay `z-[100]`
- `tests/components/layout/BottomPlayerBar.test.tsx` — 4 tests mới: queue button render khi có song, hidden by default, click opens drawer, onClose closes drawer; QueueDrawer mocked để isolate integration
- 4 tests mới — **698/698** toàn bộ suite xanh

**Frontend — Phase 2 Phase 8: Route registration (2026-05-15)**
- `App.tsx` — đăng ký 5 routes mới: `/songs/:songId` → `SongDetailPage`, `/artists/:artistId` → `ArtistPage`, `/profile` → `ProfilePage`, `/settings/preferences` → `PreferencesPage`, `/dashboard/songs/:songId` → `CreatorSongAnalyticsPage`
- `tests/App.test.tsx` (mới) — 14 tests: smoke check existing routes, 5 routes mới render đúng page, route specificity (`/dashboard/songs/:id` không conflict với `/dashboard`), dynamic segments, ToastProvider wrap
- 14 tests mới — **694/694** toàn bộ suite xanh

**Frontend — Phase 2 Phase 7: Sidebar + MobileNav updates (2026-05-15)**
- `Sidebar.tsx` — user bottom section giờ là button toggle: click mở `UserMenuDropdown` với options Profile / Preferences / Logout; click ngoài đóng menu; dropdown xuất hiện phía trên trigger (`bottom-full`)
- `MobileNav.tsx` — thêm tab "Hồ sơ" (icon `person`, link `/profile`) làm item thứ 5 trong bottom nav mobile
- 8 tests mới — **680/680** toàn bộ suite xanh

**Frontend — Phase 2 Phase 6: Enhance HomePage + SearchPage + CreatorDashboardPage (2026-05-15)**
- `features/search/components/ArtistCard.tsx` (mới) — card nghệ sĩ tròn 100px, floating play button với stopPropagation, click/keyboard → `/artists/:id`, `aria-label` đầy đủ
- `pages/HomePage.tsx` — tích hợp `ContextSelector` (chip filter sáng/chiều/tối/khuya) + `ContextFeedSection` (danh sách `RecommendationFeedRow`); section feed chỉ hiện khi user chọn context cụ thể
- `pages/SearchPage.tsx` — thêm filter tabs (Tất cả / Bài hát / Nghệ sĩ) với tablist ARIA, ArtistsRow giờ dùng `ArtistCard`, no-results dùng `EmptyState`
- `pages/CreatorDashboardPage.tsx` — section "Bài hát của tôi" với `CreatorSongTable` + nút "TẢI LÊN BÀI MỚI" → `/upload`, "Xem phân tích" → `/dashboard/songs/:id`
- 37 tests mới — **672/672** toàn bộ suite xanh

**Frontend — Phase 2 Phase 5: 5 trang mới (2026-05-15)**
- `pages/SongDetailPage.tsx` — hero blurred background + gradient overlay, cover art 160px, artist link, actions (Play / Queue / More), metadata grid (genre/mood/language/year/playCount), explainText suggestion card, related songs horizontal scroll
- `pages/ArtistPage.tsx` — hero banner với circular avatar 120px, stats bar (bài hát/lượt nghe/followers), follow toggle (useState), popular tracks list, Fans Also Like horizontal scroll
- `pages/creator/CreatorSongAnalyticsPage.tsx` — role guard (Listener → redirect `/`), breadcrumb `Dashboard › {title}`, song info card, TimeRangeSelector, 3 KPI SongStatsCard, DailyListenersChart, HeatmapChart; dùng `MOCK_HEATMAP` + `MOCK_DAILY_STATS`
- `pages/ProfilePage.tsx` — avatar với hover overlay + local preview (URL.createObjectURL), click-to-edit display name (inline input), email read-only + lock icon, role badge, genre/artist chips, link đến PreferencesPage, logout gọi `clearAuth()` + navigate `/login`
- `pages/PreferencesPage.tsx` — GenreGrid reuse từ onboarding, artist search input + filter dropdown, selected artist chips với remove ×, sticky save bar `bottom-[72px] lg:bottom-0`, validation (< 3 genres → disabled + warning), save → toast success (không gọi API)
- `mocks/data.ts` — thêm `MOCK_HEATMAP` (20 điểm dữ liệu) và `MOCK_DAILY_STATS` (7 ngày)
- 92 tests mới — **635/635** toàn bộ suite xanh

**Frontend — Phase 2 Phase 4: QueueDrawer + playerStore Queue (2026-05-15)**
- `store/playerStore.ts` — thêm `queue: CurrentSong[]`, actions `addToQueue` / `removeFromQueue` / `clearQueue`; export `CurrentSong` interface
- `features/player/components/QueueDrawer.tsx` — drawer 360px slide-in từ phải: now-playing row (ring-spotify-green), danh sách queue với drag handle (visual) + remove button hover, empty states, "Xóa tất cả"
- `BottomPlayerBar.tsx` — wire nút queue_music → mở/đóng QueueDrawer; conditional mount tránh DOM duplicate
- 30 tests mới — 543/543 toàn bộ suite xanh

**Frontend — Phase 2 Phase 3: Recommendation Components (2026-05-15)**
- `features/recommendation/components/ContextSelector.tsx` — 5 chips lọc theo thời điểm (Tất cả / Sáng / Chiều / Tối / Khuya); active chip `bg-spotify-green text-near-black font-bold`; `aria-pressed` + `role="group"` accessible
- `features/recommendation/components/RecommendationFeedRow.tsx` — row 64px: index ↔ play icon swap on hover, cover 56px, title (navigate `/songs/:id`), reason badge, artist, duration; helper `formatDuration` co-located
- 42 tests mới (20 ContextSelector + 22 RecommendationFeedRow) — 513/513 toàn bộ suite xanh

**Frontend — Phase 2 Phase 2: Creator Components (2026-05-15)**
- `features/creator/components/TimeRangeSelector.tsx` — pill toggle 7d/30d, extract từ `CreatorDashboardPage`, aria-pressed
- `features/creator/components/SongStatsCard.tsx` — KPI card với Material Symbol icon, trend badge optional (positive/negative)
- `features/creator/components/DailyListenersChart.tsx` — SVG line chart + hover tooltip per data point; helper `buildChartPaths` co-located
- `features/creator/components/HeatmapChart.tsx` — heatmap bar với peak marker (warning) + threshold dashed line mới (`thresholdPct` prop, default 30%); helpers `formatSeconds` + `heatColor` co-located
- `features/creator/components/CreatorSongTable.tsx` — table đầy đủ: sort 5 cột client-side, pagination 10 rows/page, loading skeleton, empty state, "Xem phân tích" hover reveal
- 94 tests mới — 471/471 toàn bộ suite xanh

### Changed

**Frontend — Phase 2 Phase 2: Creator Components (2026-05-15)**
- `pages/CreatorDashboardPage.tsx` — refactor: xóa 6 inline sub-component definitions (TrendBadge, KpiCard, SkipHeatmap, LineChart + helpers); thay bằng import 4 components mới; `SongStatsCard` dùng icons Material Symbols

**Frontend — Phase 2 Phase 1: Shared UI Components (2026-05-15)**
- `components/ui/EmptyState.tsx` — component mới, 4 variants: `music` / `search` / `bell` / `group`; icon circle 80px, optional CTA pill `bg-spotify-green`
- `components/ui/SongContextMenu.tsx` — dropdown 200px, 5 items (Phát ngay, Queue, Party, Nghệ sĩ, Chia sẻ), đóng khi click ngoài
- `components/ui/UserMenuDropdown.tsx` — popover 220px, header avatar + tên + email, menu Profile / Preferences / Logout; Logout gọi `clearAuth()` + navigate `/login`
- 42 tests mới (14 + 15 + 13) — 377/377 toàn bộ suite xanh

**Frontend — Phase 2 Phase 0: Types & Mock Data (2026-05-15)**
- `types/domain.ts` — thêm 3 interface mới: `Artist`, `SongDetail extends Song`, `CreatorSongRow`
- `services/userService.ts` — `UserProfile` có thêm `avatarUrl?`, `preferredGenres?`, `preferredArtists?`
- `mocks/data.ts` — thêm `MOCK_SONG_DETAIL`, `MOCK_ARTIST`, `MOCK_RELATED_SONGS` (8 bài), `MOCK_CREATOR_SONG_ROWS` (7 hàng), `MOCK_PROFILE`
- `features/recommendation/hooks/useRecommendations.ts` — hỗ trợ optional `externalContext?: TimeContext | 'none'` (backward compat)
- `tests/phase0/` — 21 tests mới covering types, mock data shape, và hook behavior

**Frontend — Phase 2 Design Assets (2026-05-14)**
- `design/phase2/` — 10 Stitch design folders, mỗi folder có `code.html` (HTML prototype) và `screen.png` (screenshot)
- Covers 5 trang mới: SongDetailPage, ArtistPage, CreatorSongAnalyticsPage, ProfilePage, PreferencesPage
- Covers 3 trang nâng cấp: HomePage (ContextSelector + feed row), SearchPage (filters + ArtistCard), CreatorDashboardPage (song table)
- Covers shared components: EmptyState, SongContextMenu, UserMenuDropdown, QueueDrawer, analytics charts
- Implementation plan: `.claude/plan/frontend-phase2-new-pages-components.md` (9 phases, 16 files mới, 11 files sửa, mock data strategy)

### Changed

**Frontend — CSS Audit Phase Plan (2026-05-14)**
- Toàn bộ CSS audit chia thành 6 phases (Phase 1 đã xong, Phase 2–6 pending):
  - Phase 2: Foundation Components (7 files — Button, Input, Toast, SkeletonRow, Spinner, BottomPlayerBar, MobileNav)
  - Phase 3: Auth & Onboarding (7 files — LoginPage, RegisterPage, OnboardingPage, LoginForm, RegisterForm, GenreGrid, ArtistGrid)
  - Phase 4: Core App Pages (5 files — HomePage, NotificationsPage, CreatorDashboardPage, UploadPage, NowPlayingOverlay)
  - Phase 5: Listening Party (6 files — PartyLandingPage, PartyRoomPage, CreateRoomModal, RoomPlayer, HostControls, MemberList)
  - Phase 6: Notifications & Creator Features (4 files — NotificationRow, FilterPills, FileDropzone, MetadataForm)
- Mỗi phase yêu cầu xác nhận thủ công + 314/314 tests xanh trước khi tiến hành phase tiếp theo

### Fixed

**Frontend — CSS Audit Phase 6: Notifications & Creator Features (2026-05-14) — CSS Audit HOÀN THÀNH**
- `NotificationRow.tsx` — verified clean, không có violation
- `FilterPills.tsx` — active pill: inline style `#ffffff/#121212` → Tailwind `bg-white text-near-black`; active badge: inline style → `bg-near-black text-text-base`; inactive badge `text-[#121212]` → `text-near-black`
- `FileDropzone.tsx` — dragging/hover `bg-[#1f1f1f]` (×2) → `bg-mid-dark`
- `MetadataForm.tsx` — `inset-input-shadow` custom class (×4) → `shadow-input-inset` Tailwind token; cover art `hover:bg-[#1f1f1f]` → `hover:bg-mid-dark`
- **CSS Audit hoàn tất: 44/44 files, 42 violations đã fix qua 6 phases — 314/314 tests xanh**

**Frontend — CSS Audit Phase 5: Listening Party (2026-05-14)**
- `CreateRoomModal.tsx` — modal container shadow arbitrary → `shadow-level-3`; song row `hover:bg-[#282828]` → `hover:bg-mid-card`; CTA `hover:bg-[#34e36a]` → `hover:brightness-110`
- `RoomPlayer.tsx` — album art shadow arbitrary → `shadow-level-3`; LIVE badge `text-[9px]` (below 10px min) → `text-micro`
- `HostControls.tsx` — play button shadow arbitrary → `shadow-level-2`
- `MemberList.tsx` — container shadow arbitrary → `shadow-level-2`
- `PartyLandingPage.tsx`, `PartyRoomPage.tsx` — verified clean, không có violation
- **Total: 314/314 tests xanh, không regression**

**Frontend — CSS Audit Phase 2: Foundation Components (2026-05-14)**
- `tailwind.config.ts` — thêm token `shadow-footer: rgba(0,0,0,0.5) 0px -4px 12px 0px` cho upward shadow của footer/nav bar
- `Input.tsx` — `input-inset` (custom CSS class) → `shadow-input-inset` (Tailwind token) cho consistency với design system
- `BottomPlayerBar.tsx` — arbitrary `shadow-[0_-4px_12px_rgba(0,0,0,0.5)]` → `shadow-footer`; cover art `rounded` (4px) → `rounded-[6px]`; `hover:text-white` (×3) → `hover:text-text-base`
- `MobileNav.tsx` — arbitrary `shadow-[0_-4px_12px_rgba(0,0,0,0.4)]` → `shadow-footer`; active nav `text-white` → `text-text-base`
- `SkeletonRow.tsx` — cover art placeholder `rounded` (4px) → `rounded-[6px]`
- `Button.tsx`, `Spinner.tsx`, `Toast.tsx` — verified clean, không có violation
- **Total: 314/314 tests xanh, không regression**

**Frontend — CSS Audit Phase 1: 6 Confirmed Violations (2026-05-14)**
- `Sidebar.tsx` — sidebar width `w-[240px]` → `w-[280px]` per DESIGN_STITCH.md spec
- `AppShell.tsx` — main content offset `ml-[240px]` → `ml-[280px]` (đồng bộ với sidebar width)
- `Modal.tsx` — dialog border-radius `rounded-lg` (32px) → `rounded-[8px]` per spec Rule 3
- `SongCard.tsx` — shadow arbitrary `shadow-[rgba(0,0,0,0.3)_0px_4px_8px]` → `shadow-level-2`; hover → `shadow-level-3` (dùng design tokens thay arbitrary values)
- `SearchPage.tsx` — search input đổi từ `border border-border-muted` + arbitrary inset shadow → `shadow-input-inset` per Rule 7
- `tailwind.config.ts` — verified: tất cả shadow tokens (`level-1/2/3`, `input-inset`) đã đúng spec — không cần sửa
- **Total: 314/314 tests xanh, không regression**

### Added

**DESIGN_STITCH.md — Design System Documentation (2026-05-14)**
- `DESIGN_STITCH.md` — tài liệu design system đầy đủ: color palette (65 tokens), typography hierarchy (14 roles), border-radius scale, shadow/elevation levels, layout principles, responsive breakpoints, component styling rules (buttons, cards, inputs, navigation), Do's and Don'ts
- Plan CSS audit: `.claude/plan/tr-c-khi-th-c-task-prancy-lovelace.md` — kế hoạch audit toàn bộ 44 files frontend đối chiếu với DESIGN_STITCH.md, đã xác nhận 6 violations pre-audit (sidebar width, modal radius, card shadow, search input border)

### Added

**Frontend Phase 8 — Notifications + Polish (2026-05-14)**
- `src/contexts/ToastContext.tsx` — `ToastProvider` (global context) + `useToast()` hook: one-at-a-time toast, cross-page (mounted ở root trong App.tsx), `show(message, variant)` / `hide()` API
- `src/pages/NotificationsPage.tsx` — trang thông báo tại `/notifications`: header + "Đánh dấu tất cả đã đọc" button, FilterPills, danh sách NotificationRow, skeleton loading, empty state, error state, toast confirm sau mark-all-read
- `src/features/notifications/components/NotificationRow.tsx` — row item: icon (music_note/notifications theo type), message, time-ago helper, green dot khi unread, click → mark as read (optimistic update)
- `src/features/notifications/components/FilterPills.tsx` — 3 pills: "Tất cả" / "Chưa đọc" (với badge count) / "Bài hát mới", `aria-pressed` cho active state
- `src/features/notifications/hooks/useNotifications.ts` — fetch + local state management: `filter`, `filteredNotifications`, `unreadCount`, `markRead` (optimistic + rollback), `markAllRead` (optimistic + rollback)
- `src/components/layout/MobileNav.tsx` — mobile bottom nav (`fixed bottom-0 lg:hidden z-[60]`): 4 items (Home/Search/Notifications/Party), notification dot, party modal integration
- `src/types/domain.ts` — thêm `NotificationType = 'new_release' | 'system'`, optional `type?` field vào `Notification`
- App.tsx — wrap toàn app trong `<ToastProvider>`, thêm route `/notifications`
- `AppShell.tsx` — thêm `<MobileNav />`, mobile padding `pb-[128px] lg:pb-[72px]`
- `BottomPlayerBar.tsx` — đổi `bottom-0` → `bottom-14 lg:bottom-0` (nhường chỗ cho MobileNav trên mobile)
- `mocks/data.ts` — thêm `type` field cho tất cả MOCK_NOTIFICATIONS, thêm `notif-005`
- `mocks/handlers.ts` — handler `GET /notifications/unread` trả ALL items + `totalUnread` count
- Tests: 67 tests mới — ToastContext (7), NotificationRow (9), FilterPills (11), useNotifications (14), NotificationsPage (18), MobileNav (8)
- **Total: 314/314 tests xanh**

### Added

**Frontend Phase 7 — UploadPage + Creator Screens (2026-05-14)**
- `src/pages/creator/UploadPage.tsx` — trang tải nhạc lên tại `/upload`: no-sidebar layout (theo Stitch design `t_i_nh_c_l_n_soundwave_creator`), RoleGuard Creator+Admin, form tải file + metadata + preview card + success/error screen
- `src/features/creator/components/FileDropzone.tsx` — drag-and-drop dropzone với validation MIME type (mp3/wav/ogg) + size ≤50MB, hiện file name + size sau khi chọn, error alert
- `src/features/creator/components/MetadataForm.tsx` — form 2-column: Tên bài hát, Thể loại, Tâm trạng, Ngôn ngữ, Bìa album uploader, Explicit toggle
- `src/features/creator/hooks/useUpload.ts` — hook quản lý toàn bộ upload state: file validation, form state, canSubmit guard, submit async, reset after success
- `src/services/musicService.ts` — `uploadSong()` (FormData POST, Idempotency-Key header) + `getSong()`
- `src/components/RoleGuard.tsx` — wrapper component gọi `useProtectedRoute(roles)`, dùng cho `/upload` (Creator+Admin only)
- App.tsx — thêm route `/upload` (UploadPage)
- Tests: 15/15 xanh — file validation, MIME error, size error, metadata fields, preview update, success screen, error alert, reset flow
- **Total: 247/247 tests xanh**

### Fixed

**Frontend — Listening Party UX + WS proxy (2026-05-14)**
- `vite.config.ts` — Đổi WS proxy target từ `ws://localhost:5005` → `http://localhost:5005` + `changeOrigin: true` để fix SignalR negotiate HTTP error
- `RoomPlayer.tsx` — Bỏ `max-w-md mx-auto` constraint trên player wrapper, player giờ fill full width của section 60%
- `Sidebar.tsx` — Đổi nav item "Listening Party" từ `<Link to="/party">` thành button → mở `CreateRoomModal` trực tiếp không qua route `/party`; thêm `onSwitchToJoin` flow để chuyển sang `JoinRoomModal` inline
- `CreateRoomModal.tsx` — Thêm optional prop `onSwitchToJoin` + nút "THAM GIA PHÒNG" (chỉ hiện khi prop được truyền vào)

### Added

**Frontend Phase 6 — Listening Party UI (2026-05-14)**
- `src/pages/party/PartyLandingPage.tsx` — landing page tại `/party`: 2 action cards (Tạo phòng mới / Tham gia phòng), render modals overlay theo Stitch design
- `src/pages/party/PartyRoomPage.tsx` — room page tại `/party/:roomId`: 2-column layout (60% player + 40% member list), room header (tên phòng + join code + member count + rời phòng button), kết nối SignalR qua `useListeningParty`, accept party data từ `location.state`, fallback mock data khi direct URL access
- `src/features/party/components/CreateRoomModal.tsx` — modal tạo phòng theo Stitch design: room name pill input, song search với live-filter results list, "TẠO PHÒNG" green button, gọi `POST /api/v1/parties`
- `src/features/party/components/JoinRoomModal.tsx` — modal tham gia theo Stitch design: 6 individual character inputs với auto-advance focus + paste support, preview card khi đủ 6 ký tự, "THAM GIA" button, gọi `POST /api/v1/parties/{joinCode}/join`
- `src/features/party/components/MemberList.tsx` — danh sách thành viên: host với ⭐ "Chủ phòng" badge màu warning, member với "Thành viên" badge, online dot, avatar hoặc person icon placeholder, invite button
- `src/features/party/components/HostControls.tsx` — play/pause/skip controls: active cho Host, disabled cho Member + note "Chỉ Host mới điều khiển phát nhạc", queue button
- `src/features/party/components/RoomPlayer.tsx` — player area: album art 280x280 với green glow effect, song title + artist, sync indicator (host: "Đang phát trực tiếp" / member: "🔄 Đồng bộ với Host"), progress bar với "LIVE" pulsing badge, HostControls sub-component
- `src/features/party/hooks/useListeningParty.ts` — re-export từ `hooks/usePartyWebSocket` (backward compatible)
- `src/services/partyService.ts` — `createParty()` + `joinParty()` calling API Gateway
- `src/mocks/data.ts` — cập nhật `MOCK_PARTY`: thêm `name`, avatar URLs cho 3 members, `playbackPositionSec: 84`
- App.tsx — thêm routes `/party` (PartyLandingPage) và `/party/:roomId` (PartyRoomPage) thay placeholder
- Tests: CreateRoomModal (15), JoinRoomModal (10), MemberList (8), HostControls (11), RoomPlayer (8), PartyRoomPage (13), PartyLandingPage (7) = **72 tests mới**
- **Total: 232/232 tests xanh**

**Frontend Phase 5 — SearchPage + NowPlayingOverlay (2026-05-14)**
- `src/pages/SearchPage.tsx` — rewrite hoàn toàn theo Stitch design: empty state (genre browse grid 9 cards với gradient), results state (top result card + songs list với duration + artists circular row + related songs grid), 300ms debounce, clear button, dispatch playSong khi click song row
- `src/features/search/hooks/useSearch.ts` — custom hook quản lý query + debounce 300ms + kết quả; error/timeout → `[]` (per API contract)
- `src/features/player/components/NowPlayingOverlay.tsx` — fullscreen overlay được trigger từ BottomPlayerBar: album art với green glow shadow, song info, seek bar, playback controls, 3 tabs (Lời bài hát / Hàng chờ / Liên quan) với mock lyrics
- `src/features/player/components/NowPlayingOverlay.types.ts` — `CurrentSong` interface
- `src/components/layout/AppShell.tsx` — thêm optional `headerContent?: ReactNode` prop (sticky desktop search bar)
- `src/mocks/data.ts` — enrich mock search data: 5 songs với duration + coverUrl + artist, 5 artists
- `src/types/domain.ts` — thêm `duration?: number` vào `SearchResult`
- SearchPage tests (13/13 xanh): empty state, genre grid, results, top result, song rows, duration format, artists section, no results, genre hide/show, play song dispatch, clear button
- NowPlayingOverlay tests (16/16 xanh): render, dialog role, album art, play/pause toggle, disabled loading, close, seek, 3 tabs switch, lyrics content
- **Total: 154/154 tests xanh**

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
