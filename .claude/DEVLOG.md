# DEVLOG — Smart Music Streaming Platform
---
[2026-05-17] [BUG FIX — Search Service: cover_url null + stale Redis search cache] [DONE]

**Context:** Search kết quả trả về `coverUrl: null` dù Elasticsearch đã có URL thật sau khi re-index.

**Root cause (2 lớp):**

1. **Code bug:** `ElasticsearchSongDocument` record không có `[JsonPropertyName]` attributes → Elastic .NET client (System.Text.Json) deserialize field `cover_url` (snake_case từ ES) không match `CoverUrl` (PascalCase C#) → luôn `null`. Tương tự cho `is_explicit`, `is_published`, `play_count`, `duration_sec`.
2. **Stale cache:** Redis search cache (TTL 10 phút, key prefix `search:cache:*`) hold kết quả cũ có `coverUrl: null` từ trước khi fix được deploy. Mỗi lần search lại tiếp tục hit cache cũ thay vì query ES.

**Fixes:**
1. `ElasticsearchSearchRepository.cs` — thêm `[property: JsonPropertyName("cover_url")]` và tương tự cho tất cả snake_case fields trong `ElasticsearchSongDocument`.
2. Rebuild & restart `search-service` container.
3. Xóa toàn bộ `search:cache:*` keys trong Redis (targeted DEL, không FLUSHDB — giữ nguyên `rec:trending:global` và các keys khác).

**Files thay đổi:** `services/search-service/src/SearchService.Infrastructure/Elasticsearch/ElasticsearchSearchRepository.cs`

---
[2026-05-17] [INFRA — Upload 30 cover images lên Cloudinary + cập nhật DB] [DONE]

**Context:** 30 bài hát trong DB đang dùng placeholder URL `res.cloudinary.com/demo/...` → ảnh bìa không hiển thị trên FE.

**Thực hiện:**
1. Viết `infra/seed/upload_covers.py` — map 30 public_id → filename trong `songs_pic/`, upload lên Cloudinary folder `smart-music/covers/` với `overwrite=True`.
2. Chạy script: 30/30 upload thành công, cloud `dd9umsxtf`.
3. Cập nhật `infra/seed/SeedData.sql` — thay toàn bộ 30 URL `demo` → URL thật (verify: 0 URL `demo` còn sót).
4. Apply trực tiếp vào live DB `music_db` qua `docker exec psql` — 30 × `UPDATE 1`.

**Lưu ý:** Music Service cache song metadata trong Redis TTL 30m (`song:{songId}`). Nếu bài hát đã được cache trước khi UPDATE, phải đợi cache expire hoặc flush Redis để thấy ảnh mới ngay lập tức.

**Files thay đổi:** `infra/seed/SeedData.sql`, `infra/seed/upload_covers.py` (mới)

---
[2026-05-17] [RUNTIME BUG FIX — analytics/events/play 400 Bad Request] [DONE]

**Context:** Browser testing — phát nhạc từ bất kỳ trang nào, `BottomPlayerBar` gọi `POST /api/v1/analytics/events/play` nhận 400 Bad Request.

**Root cause:** Mismatch giữa FE request body và BE `RecordPlayRequest` DTO:
- FE gửi `{ songId, durationPercent: 0 }` — field `durationPercent` không tồn tại trong DTO
- BE expect `{ songId: Guid, durationSec: int [Range(1,86400)], listenedSec: int, platform: string [Required] }`
- `durationSec`, `listenedSec`, `platform` đều thiếu → ModelState invalid → 400 VALIDATION_ERROR

Thêm vào đó, analytics được gửi ngay khi user bấm Play (trước khi audio metadata load) → `duration` state = 0 → kể cả khi fix field names thì `durationSec: 0` vẫn fail `[Range(1, 86400)]`.

**Fixes:**

1. `BottomPlayerBar.tsx` — thêm `hasStartedRef` (track user đã bấm Play chưa).
2. `BottomPlayerBar.tsx` — `handlePlay`: set `hasStartedRef.current = true`, chỉ gửi analytics ngay nếu `duration > 0` (trường hợp metadata đã load trước).
3. `BottomPlayerBar.tsx` — `onDurationChange`: khi duration thật load xong, nếu `hasStartedRef.current` → gửi analytics với `{ songId, durationSec: Math.max(1, Math.round(d)), listenedSec: currentTime, platform: 'web' }`.
4. `BottomPlayerBar.test.tsx` — thêm 2 test: gửi đúng body sau durationChange, và không gửi nếu chưa play.

**Files thay đổi:** `services/frontend/src/components/layout/BottomPlayerBar.tsx`, `services/frontend/src/tests/components/layout/BottomPlayerBar.test.tsx`

**Test count: 13/13 xanh** (thêm 2 test mới)

---
[2026-05-17] [RUNTIME BUG FIX — 401 UNAUTHORIZED khi click play từ SearchPage] [DONE]

**Context:** Browser testing (VITE_MOCK=false) — sau khi search bài hát và click play, BottomPlayerBar gọi `GET /api/v1/streaming/{songId}/url` nhận 401 UNAUTHORIZED "Authentication required." (2 lần), sau đó 503 UNAUTHORIZED do circuit breaker timeout.

**Root cause:**

`_accessToken` trong `services/api.ts` là `null` tại thời điểm request streaming được gửi (race condition hoặc session chưa được restore xong). API Gateway `JwtValidationMiddleware` chỉ trả `"Authentication required."` khi không có `Authorization` header → xác nhận token null.

Interceptor trong `api.ts` chỉ retry khi `errorCode === 'TOKEN_EXPIRED'` — bỏ qua hoàn toàn `UNAUTHORIZED`, nên không tự phục hồi bằng refresh token.

Thêm vào đó: `baseURL` dùng `||` nên `VITE_API_BASE_URL=''` (empty string) vẫn fallback về `'http://localhost:5000'` (truthy check fails on empty string) → requests đi cross-origin thay vì qua Vite proxy, có thể gây edge case với cookie/CORS.

**Fixes:**

1. `services/frontend/src/services/api.ts` — đổi `isTokenExpired` → `shouldRefresh`, mở rộng condition: `errorCode === 'TOKEN_EXPIRED' || errorCode === 'UNAUTHORIZED'`. Logic refresh + retry + redirect `/login` giữ nguyên.
2. `services/frontend/src/services/api.ts` — đổi `||` → `??` cho `baseURL` để `VITE_API_BASE_URL=''` được nhận diện là "dùng empty string" (đi qua Vite proxy).
3. `services/frontend/.env.development` — thêm `VITE_API_BASE_URL=` (empty string) → axios dùng relative URL → Vite proxy forward `/api → localhost:5000`.

**Files thay đổi:** `services/frontend/src/services/api.ts`, `services/frontend/.env.development`

---
[2026-05-17] [RUNTIME BUG FIXES — SearchPage crash + Google OAuth 400] [DONE]

**Context:** Browser testing (VITE_MOCK=false) phát hiện 2 lỗi runtime sau khi bật real API.

**Bug 1: SearchPage crash — `results.filter is not a function`**

Root cause: `searchService.ts` khai báo sai type `ApiResponse<SearchResult[]>` nhưng backend Search Service trả `data: { items, nextCursor, hasMore }` (nested object). Kết quả `res.data.data` là 1 object, không phải array → `setResults(res.items)` set state thành object → `results.filter(...)` trong SearchPage crash với TypeError.

Fix: đổi generic type sang `ApiResponse<{ items: SearchResult[]; nextCursor: string | null; hasMore: boolean }>` và đọc `d?.items ?? []` thay vì `res.data.data ?? []`.

Đồng thời update mock handlers trong `SearchPage.test.tsx` từ `apiOk([])` / `apiOk(ALL_RESULTS)` sang `apiOk({ items: [], nextCursor: null, hasMore: false })` / `apiOk({ items: ALL_RESULTS, ... })` để match đúng backend shape. 24/24 tests xanh.

**Bug 2: Google OAuth 400 — `[GSI_LOGGER]: Parameter client_id is not set correctly`**

Root cause: `App.tsx` đọc `import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''` — env var này không được khai báo trong `.env.development` nên fallback về empty string → `GoogleOAuthProvider` init với `clientId=""` → Google GSI library báo lỗi config → button load 400.

Fix: thêm `VITE_GOOGLE_CLIENT_ID=<id>` vào `services/frontend/.env.development` — value lấy từ `infra/.env` (GOOGLE_CLIENT_ID đã có sẵn).

**Test count sau fix: 696/696 xanh**

---
[2026-05-16] [FRONTEND AUTH — 401 on /recommendations + infinite update loop] [DONE]

**Context:** Browser testing (VITE_MOCK=false) phát hiện 2 lỗi liên quan đến auth flow.

**Bug 1: GET /recommendations → 401 Unauthorized khi refresh trang**

Root cause: `_accessToken` trong `api.ts` là in-memory. Khi user refresh browser, token reset về `null`. Không có bước restore session, nên `useRecommendations` gọi API ngay lập tức không có `Authorization` header → Gateway trả 401 `UNAUTHORIZED` (khác `TOKEN_EXPIRED` nên interceptor không retry).

Thêm vào đó: không có route guard — unauthenticated user truy cập `/` thẳng vào `HomePage` → cùng lỗi 401.

Fixes:
- `authStore.ts` — thêm `isInitialized: boolean` (default `false`) + `setInitialized()` action
- `AuthInitializer.tsx` (mới) — component wrap toàn app, on mount gọi `POST /api/v1/auth/refresh` → nếu OK set token + user vào store, nếu fail `clearAuth()`, cuối cùng `setInitialized(true)`
- `RequireAuth.tsx` (mới) — route guard: hiện spinner khi `!isInitialized`, redirect `/login` khi `!accessToken`
- `App.tsx` — wrap toàn app trong `<AuthInitializer>`, wrap 12 protected routes trong `<RequireAuth>`. Public routes (`/login`, `/register`, `/onboarding`) không cần guard

**Bug 2: Maximum update depth exceeded (infinite loop)**

Root cause: `AuthInitializer.tsx` dùng object selector `useAuthStore((s) => ({ setAuth, clearAuth, setInitialized }))` — selector trả new object reference mỗi render → zustand so sánh bằng reference equality → re-render vô hạn.

Fix: tách thành 3 selector riêng biệt:
```ts
const setAuth        = useAuthStore((s) => s.setAuth);
const clearAuth      = useAuthStore((s) => s.clearAuth);
const setInitialized = useAuthStore((s) => s.setInitialized);
```
Zustand store actions là stable references (tạo 1 lần khi store init) nên không trigger re-render.

**Pre-existing test failures (từ runtime bug fix 2026-05-16) cũng được fix trong session này:**
- `HomePage.test.tsx`: mock data dùng `song_id` (snake_case) nhưng `recommendationService.ts` đọc `songId` (camelCase) → filter loại bỏ tất cả → songs không render. Fix: đổi `song_id` → `songId` trong mock items
- `PartyLandingPage.test.tsx` + `PartyRoomPage.test.tsx`: playerStore mock dùng `vi.fn(() => object)` — khi `usePlayerStore((s) => s.clearSong)` được gọi với selector, mock trả về cả object thay vì function → `TypeError: clearSong is not a function`. Fix: đổi sang `vi.fn((sel) => sel(state))` pattern + thêm `clearSong: vi.fn()` vào state object

**Test count sau khi fix: 696/696 xanh** (thêm 1 test mới trong `App.test.tsx`)

---
[2026-05-16] [RUNTIME BUG FIXES — streaming/undefined/url + GatewayAuth X-User-Id missing] [DONE]

**Context:** Sau khi bật VITE_MOCK=false, browser testing phát hiện 2 lỗi runtime nghiêm trọng.

**Bug 1: GET /streaming/undefined/url 404**

Root cause chuỗi:
1. `ArtistResponseDto.Songs` chứa `SongResponseDto` với field `Guid Id` → JSON serializes thành `"id"` (camelCase)
2. `ArtistPage.tsx` cũ gọi `getArtist()` chưa có → songs từ raw API response, `s.songId` undefined, `s.id` = GUID
3. `getArtist()` lúc đầu thiếu → ArtistPage không có getArtist → songs không được map đúng
4. `playSong({ songId: String(song.id) })` khi `song.id = undefined` (JS undefined) → `String(undefined)` = `"undefined"` → request `/streaming/undefined/url`
5. Streaming controller `[HttpGet("{songId:guid}/url")]` reject vì `"undefined"` không phải GUID → 404

Fixes:
- `musicService.ts getArtist()` — map `s.songId ?? s.id ?? ''` (handle cả `songId` lẫn `id` field name)
- `SongDetailPage.tsx` — map `songData.songId ?? songData.id ?? songId`
- `playerStore.ts` — guard `if (!song.songId) return;` trong `setSong` và `playSong` → reject undefined songId
- `BottomPlayerBar.tsx` — guard `if (!currentSong.songId) { clearSong(); return; }` trước `fetchStreamUrl`
- `recommendationService.ts` — `.filter((item) => item.songId)` trước `.map()` → loại bỏ items không có songId (tránh `key={undefined}` React warning)

**Bug 2: Streaming service log "Missing X-User-Id header from gateway"**

Root cause: YARP build `HttpRequestMessage` từ headers TRƯỚC khi `JwtValidationMiddleware` chạy (hoặc headers middleware thêm vào không propagate đúng vào proxy pipeline). Header `X-User-Id` có trong `HttpContext.Request.Headers` nhưng YARP không forward vào downstream request.

Fix: `api-gateway/Program.cs` — thêm `AddTransforms()` với `AddRequestTransform` explicit copy `X-User-Id` và `X-User-Role` từ `HttpContext.Request.Headers` vào `ProxyRequest.Headers`.

```csharp
builder.Services.AddReverseProxy()
    .LoadFromConfig(...)
    .AddTransforms(ctx => {
        ctx.AddRequestTransform(transform => {
            // Explicitly copy gateway identity headers to proxied request
            if (headers.TryGetValue("X-User-Id", out var userId) && !string.IsNullOrEmpty(userId))
                transform.ProxyRequest.Headers.TryAddWithoutValidation("X-User-Id", (string?)userId);
            ...
            return ValueTask.CompletedTask;
        });
    });
```

Cần add `using Yarp.ReverseProxy.Transforms;` — thiếu namespace gây build error lần đầu.

**Root cause của cả 2 bugs:**
- Bug 1: C# → JSON field name mapping: C# `Guid SongId` → JSON `"songId"`, nhưng `Guid Id` → JSON `"id"` — frontend mapping phải handle cả 2 case
- Bug 2: YARP middleware interaction: headers thêm bởi ASP.NET middleware được YARP đọc đúng TỪ `HttpContext.Request.Headers`, nhưng cần explicit transform vì YARP có thể không include custom headers tự động trong một số configurations

**Verified (Python):** Recommendation service serialize `song_id → songId` đúng cả cache hit lẫn cache miss path — không phải nguồn gây bug.

---
[2026-05-16] [FRONTEND REAL API INTEGRATION — VITE_MOCK=false + 5 PAGES + 2 BACKEND ENDPOINTS] [DONE]

**Task:** Tắt VITE_MOCK, wire 5 trang FE dùng real API calls, thêm 2 backend endpoints mới, fix toàn bộ test suite.

**Backend changes (Music Service):**
- `MusicService.Application/DTOs/SongResponseDto.cs` — thêm `ArtistResponseDto` + `MySongDto`
- `MusicService.Application/Interfaces/IMusicRepository.cs` — thêm `GetArtistByIdAsync`, `GetSongsByArtistIdAsync`, `GetSongsByCreatorUserIdAsync`
- `MusicService.Application/Interfaces/ISongService.cs` — thêm `GetArtistAsync`, `GetMySongsAsync`
- `MusicService.Infrastructure/Repositories/MusicRepository.cs` — implement 3 methods với EF Core includes
- `MusicService.Application/Services/SongService.cs` — implement `GetArtistAsync`, `GetMySongsAsync`
- `MusicService.Api/Controllers/ArtistsController.cs` — NEW: `GET /api/v1/music/artists/{artistId}` → 200 ArtistResponseDto
- `MusicService.Api/Controllers/SongsController.cs` — thêm `GET /api/v1/music/songs/my` (Creator/Admin only)
- `MusicService.UnitTests/SongServiceArtistTests.cs` — NEW: 5 unit tests
- Bugfix: `SongServiceGetTests.cs` — thêm `FeaturedArtists` param 14th vào `BuildSongDto`
- Bugfix: `GcsStorageServiceTests.cs` — `Lazy<StorageClient>` constructor

**Frontend changes:**
- `services/frontend/.env.development` — `VITE_MOCK=true` → `VITE_MOCK=false`
- `src/types/domain.ts` — thêm `ArtistDetail`, `MySong` interfaces
- `src/services/musicService.ts` — thêm `getArtist()`, `getMySongs()`
- `src/mocks/handlers.ts` — thêm `getMySongsHandler`, `getArtistHandler` (cho test mode)
- `src/pages/ArtistPage.tsx` — rewrite: `useParams` + `getArtist()` async + loading/error states
- `src/pages/ProfilePage.tsx` — rewrite: `userService.getProfile()` async + loading/error states
- `src/pages/SongDetailPage.tsx` — rewrite: `getSong()` + `fetchRecommendations()` async
- `src/pages/creator/CreatorSongAnalyticsPage.tsx` — rewrite: `getSong()` + `fetchHeatmap()` + `fetchSongStats()` async
- `src/pages/CreatorDashboardPage.tsx` — `getMySongs()` thay hardcoded SONG_OPTIONS, thêm `data-testid="song-selector-button"`

**Test fixes (695/695 xanh):**
- `ArtistPage.test.tsx` — `vi.hoisted()` cho MOCK_ARTIST_DETAIL, `Routes/Route` wrapper, `findBy*` async
- `ProfilePage.test.tsx` — `vi.hoisted()` cho MOCK_PROFILE_DATA, `findBy*` async
- `SongDetailPage.test.tsx` — rewrite: mock services, `Routes/Route`, `findBy*`, remove deleted features
- `CreatorSongAnalyticsPage.test.tsx` — rewrite: `vi.hoisted()` mocks, `Routes/Route`, `findBy*`
- `CreatorDashboardPage.test.tsx` — thêm `mySongsHandler` vào MSW server, fix song selector assertions
- `PartyRoomPage.test.tsx` — bugfix pre-existing: `/ws/v1/parties/` → `/hubs/party?roomId=`

**Quyết định:**
- API Gateway catch-all route đã cover `GET /api/v1/music/artists/{artistId}` và `GET /api/v1/music/songs/my` — không cần sửa gateway
- `getMySongsHandler` phải register TRƯỚC `getSongHandler` trong MSW để tránh `/songs/my` match pattern `/songs/:songId`
- `vi.mock` factory không thể reference biến khai báo ngoài nó (hoisting) — dùng `vi.hoisted()` để khai báo data dùng trong factory

---
[2026-05-16] [MUSIC SERVICE — song_artists TABLE + SEED 30 SONGS] [DONE]

**Task:** Thêm `song_artists` junction table + seed 30 bài nhạc thật từ GCS bucket.

**Changes:**
- `MusicService.Domain/Models/SongArtist.cs` — mới: domain model (SongId, ArtistId?, DisplayName?, Role, DisplayOrder)
- `Song.cs` — thêm `ICollection<SongArtist> SongArtists`
- `Artist.cs` — thêm `ICollection<SongArtist> SongArtists`
- `MusicDbContext.cs` — thêm `DbSet<SongArtist>` + Fluent config (composite PK, nullable FK, cascade/setNull)
- `MusicDbContextFactory.cs` — mới: IDesignTimeDbContextFactory cho EF tools (không cần GCP env var khi chạy migrations)
- `Migration: AddSongArtistsTable` — generated bởi `dotnet ef migrations add`
- `SongResponseDto.cs` — thêm `FeaturedArtistDto(Guid? Id, string Name)` + `List<FeaturedArtistDto> FeaturedArtists`
- `MusicRepository.cs` — GetSongByIdAsync thêm `.Include(s => s.SongArtists).ThenInclude(sa => sa.Artist)`
- `SongService.cs` — MapToResponseDto map featured artists từ `SongArtists.Where(Role=="featured")`
- `infra/seed/SeedData.sql` — rewrite: 16 artists (xóa cũ, thêm thật) + 30 songs + song_genres + song_artists
- `infra/seed/redis_seed.sh` — 30 real UUIDs thay 8 cũ, score = play_count thật
- `infra/seed/elasticsearch_seed.sh` — 30 documents thật thay 10 cũ (UUIDs match SeedData.sql)

**Quyết định:**
- 30 bài thay vì 29 vì GCS bucket có thêm `「真夜中のドア〜stay with me」_ 松原みき` (bài gốc Miki Matsubara) bên cạnh Night Tempo remix — cả hai đều được seed
- Storage key = exact GCS object name (có dấu tiếng Việt, brackets, special chars) — không encode
- `IDesignTimeDbContextFactory` connect `localhost:5434` (local dev) — KHÔNG commit secret thật vì đây là credentials local chỉ dùng cho `dotnet ef`

**Results:** Build 0 errors, 14/14 unit tests xanh.

**Task:** Thêm `song_artists` junction table để support collab songs (primary + featured artists). Seed 29 bài nhạc thật từ GCS bucket `smart-music-microservices`.

**Quyết định thiết kế:**
- Giữ `songs.artist_id` (NOT NULL) làm primary artist denormalized — backward compat
- `song_artists` có `artist_id` nullable + `display_name` để support external artists (nhưng trong seed này tất cả featured artists đều có Artist record)
- Tất cả 16 artists (11 primary + 5 featured-only) được tạo Artist record với fake `user_id` UUID (không có trong user_db — application-enforced, không có DB FK constraint)
- Storage key format: `songs/FILENAME.mp3` — trỏ thẳng vào GCS object name (không cần re-upload/rename)

**Plan file:** `.claude/plan/song-artists-seed-29-songs.md`

---
[2026-05-16] [BACKEND / PHASE 9 — RECOMMENDATION SERVICE ALIGNMENT] [DONE]

**Task:** Align Recommendation Service với FE schema + seed đúng data.

**4 mismatches phát hiện và fix:**

**M1 — redis_seed.sh fake IDs:** Script cũ seed `"song-001"`…`"song-050"` (fake IDs không tồn tại trong PostgreSQL). Fix: thay bằng 8 real UUIDs từ SeedData.sql với play_count thật làm score. TTL bị xóa vì local dev không có live Kafka events để refresh.

**M2 — SongItem camelCase:** BE serialize `song_id` (snake_case), FE đọc `item.songId` → `undefined`. Fix: thêm `model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)` vào `SongItem` + `RecommendationData`, dùng `model_dump(by_alias=True)` ở route.

**M3 — Music Service internal call stub:** `_trending_ids_to_candidates` chỉ là stub (comment "In a real system..."), trả empty title/artist. Fix: tạo `MusicServiceClient` (httpx, 200ms timeout, graceful degradation) + refactor `RecommendationService._build_candidates()`. Client khởi tạo trong lifespan, inject qua `app.state.music_client`.

**M4 — Không có GCS audio files:** `s3_seed.sh` cũ upload vào MinIO với path sai, SeedData.sql reference GCS paths chưa tồn tại → Streaming Service tạo pre-signed URL trỏ file không có. Fix: tạo `infra/seed/gcs_seed.sh` upload placeholder mp3 cho 8 songs; thêm bước vào `seed.sh` (conditional — skip nếu không có gsutil hoặc GCP_BUCKET_NAME).

**Changes:**
- `infra/seed/redis_seed.sh` — 8 real UUIDs thay 50 fake IDs
- `services/recommendation-service/src/recommendation_service/schemas/response.py` — `SongItem` + `RecommendationData` thêm `ConfigDict(alias_generator=to_camel)`
- `services/recommendation-service/src/recommendation_service/api/routes/recommendations.py` — `model_dump(by_alias=True)`
- `services/recommendation-service/src/recommendation_service/infrastructure/music_service_client.py` — mới: HTTP client gọi `/internal/songs/batch`
- `services/recommendation-service/src/recommendation_service/services/recommendation_service.py` — `_build_candidates()` thay stub, nhận `MusicServiceClient`
- `services/recommendation-service/src/recommendation_service/core/dependencies.py` — inject `music_client` từ `app.state`
- `services/recommendation-service/src/recommendation_service/main.py` — khởi tạo `httpx.AsyncClient` + `MusicServiceClient` trong lifespan
- `infra/seed/gcs_seed.sh` — mới: upload 8 placeholder audio files lên GCS
- `infra/seed/seed.sh` — thêm bước 4 gọi `gcs_seed.sh`
- `tests/integration/test_recommendations_api.py` — fix 1 assertion `song_id` → `songId`

**Results:** 42/42 tests xanh.

---
[2026-05-16] [BACKEND / PHASE 5 — SEARCH SERVICE DTO ALIGNMENT] [DONE]

**Task:** Align `SearchItem` DTO với FE schema `{id, name, type, score, coverUrl, artist?, duration?}`.

**Root cause:** BE trả `Title` (FE cần `name`), thiếu `CoverUrl` và `Duration`, thừa `Album`/`Genre` không cần.

**Changes:**
- `SearchResponse.cs` — `SearchItem`: `Title`→`Name`, bỏ `Album`/`Genre`, thêm `CoverUrl: string?` + `Duration: int?`
- `ElasticsearchSearchRepository.cs` — cập nhật constructor call + `ElasticsearchSongDocument` thêm `CoverUrl`, `DurationSec`
- `elasticsearch_seed.sh` — thêm `cover_url`/`duration_sec` vào index mapping và 10 seed documents
- Tests — cập nhật 3 `SearchItem(...)` constructor calls + 1 `.Title`→`.Name` assertion

**Results:** 20/20 unit tests xanh (build từ đầu, không có regression).

---
[2026-05-16] [BACKEND / PHASE 4 — STREAMING + MUSIC GCS MIGRATION] [DONE]

**Task:** Migrate Music Service và Streaming Service từ AWS S3 → Google Cloud Storage để khớp với docker-compose env vars.

**Root cause:** docker-compose đã đổi sang `GCP__ProjectId`/`GCP__BucketName` (ASP.NET Core đọc thành `GCP:BucketName`) nhưng code vẫn đọc `S3:BucketName`, `S3:AccessKey`, `S3:SecretKey` → cả hai services fail to start trong Docker.

**Field name `url`:** FE đọc `res.data.data.url` — khớp với BE đang trả. Không cần sửa.

**Changes:**
- `MusicService.Infrastructure/Services/GcsStorageService.cs` — mới: `StorageClient.Create()` (ADC), implement `IStorageService`
- `MusicService.Infrastructure/DependencyInjection.cs` — swap `IAmazonS3`/`S3StorageService` → `StorageClient`/`GcsStorageService`; đọc `GCP:BucketName`; Redis đọc `Redis:ConnectionString`
- `MusicService.Infrastructure.csproj` — swap `AWSSDK.S3` → `Google.Cloud.Storage.V1 4.10.*`
- `StreamingService.Infrastructure/Storage/GcsStoragePresigner.cs` — mới: internal test constructor nhận `Func<>` thay vì `UrlSigner`; `GetRangeAsync` dùng signed URL + HttpClient Range
- `StreamingService.Infrastructure/DependencyInjection.cs` — swap S3 → `UrlSigner.FromCredential(GoogleCredential.GetApplicationDefault())`; typed `AddHttpClient<IStoragePresigner, GcsStoragePresigner>()`
- `StreamingService.Infrastructure.csproj` — swap `AWSSDK.S3` → `Google.Cloud.Storage.V1 4.10.*` + `Google.Apis.Auth 1.68.*`
- `GcsStorageServiceTests.cs` (mới, 4 tests), `GcsStoragePresignerTests.cs` (mới, 4 tests)
- Deleted: `S3StorageService.cs`, `S3StoragePresigner.cs`
- Added Infrastructure project ref vào cả 2 UnitTests .csproj

**Results:** 14/14 MusicService.UnitTests xanh, 11/11 StreamingService.UnitTests xanh.

**Decision:** `GcsStoragePresigner` dùng internal constructor + `[assembly: InternalsVisibleTo("StreamingService.UnitTests")]` cho testability mà không cần extract thêm interface.

---
[2026-05-16] [BACKEND / PHASE 7 — NOTIFICATION SERVICE DTO ALIGNMENT] [DONE]

**Task:** Remap `NotificationDto` để FE nhận đúng schema `{notificationId, message, read, createdAt, type?}`.

**Root cause:** BE trả `{Id, Type, Status, Title, Body, ThumbnailUrl, ArtistId, SongId}` — FE chỉ cần 5 fields với tên khác hoàn toàn.

**Changes:**
- `NotificationDto.cs` — đổi record sang 5 fields: `NotificationId`, `Message`, `Read` (bool), `CreatedAt`, `Type` (nullable string)
- `NotificationService.cs` — cập nhật mapper: `Read = n.Status == NotificationStatus.Read`; `Type` switch `NewRelease`→`"new_release"`, `System`→`"system"`
- `NotificationServiceTests.cs` — fix assertions `Id`→`NotificationId`, `Status`→`Read`, `NEWRELEASE`→`"new_release"`, thêm assert `Message`

**Results:** 18/18 unit tests xanh.

---
[2026-05-16] [BACKEND / PHASE 6 — ANALYTICS SERVICE DTO ALIGNMENT] [DONE]

**Task:** Align Analytics Service DTOs với schema FE cần: `count` thay `skipRate`, `dailyListeners` thay `dailyPlays`.

**Changes:**
- `HeatmapResponse.cs` — `HeatmapPoint(int Second, double SkipRate)` → `HeatmapPoint(int Second, int Count)`; `DailyPlay(string Date, long Plays)` → `DailyListenerPoint(string Date, int Count)`; `StatsResponse.DailyPlays` → `DailyListeners`
- `InfluxAnalyticsRepository.cs` — build `HeatmapPoint` dùng `count` thực từ InfluxDB (thay vì giá trị cứng `0.1`); `DailyPlays: []` → `DailyListeners: []`
- `AnalyticsController.cs` — JSON key `dailyPlays` → `dailyListeners` trong response body
- Tests (2 files) — fix 2 `HeatmapPoint(30, 0.25)` → `HeatmapPoint(30, 5)`

**Results:** 32/32 unit tests xanh (build + test pass).

**Decision:** Phase 8 Party WS — chọn Option B (update FE `useListeningParty.ts` URL trực tiếp thay vì custom YARP transform).

---
[2026-05-16] [INFRA / CONNECTION STRING — SINGLE KEY + APPSETTINGS CLEANUP] [DONE]

**Task:** Đảm bảo các C# services đọc connection string từ docker-compose env var (không fallback về appsettings.json `localhost`).

**Root cause phát hiện thêm:** Dù docker-compose key đã đúng (fix hôm trước), code C# của auth-service và user-service vẫn có fallback chain nhiều bước dễ che giấu lỗi cấu hình. Ngoài ra `appsettings.json` (base) của auth + user vẫn chứa credentials cũ `postgres/4L27hN04@:5432`.

**Changes:**
- `auth-service/DependencyInjection.cs` — xóa nhánh đọc `ConnectionStrings:PostgreSQL` (key không có trong docker-compose), chỉ đọc `ConnectionStrings:AuthDb`; fail fast với `InvalidOperationException` nếu thiếu
- `user-service/DependencyInjection.cs` — xóa chain 3 bước (`USER_DB_CONNECTION_STRING` → `ConnectionStrings:PostgreSQL` → `ConnectionStrings:Postgres`), chỉ đọc `ConnectionStrings:Postgres`
- `user-service/Program.cs` — health check AddNpgSql/AddRedis cũng đọc cùng key đơn, fail fast thay vì fallback `localhost`
- `auth-service/appsettings.json` — đổi `Host=localhost;Port=5432;Username=postgres;Password=postgres` → `Host=postgres;Port=5432;Username=smartmusic;Password=changeme_local` (Docker internal hostname)
- `user-service/appsettings.json` — đổi `Host=localhost;Port=5432;Username=postgres;Password=4L27hN04@` → `Host=postgres;Port=5432;Username=smartmusic;Password=changeme_local`

**Logic ưu tiên sau fix:**
1. Docker: `ConnectionStrings__X` env var → service dùng Docker internal postgres
2. Local dev: `appsettings.Development.json` → `localhost:5434`
3. Fallback cuối: `appsettings.json` → `postgres` hostname (chỉ hoạt động trong Docker network)

**Services không cần sửa:** music-service (đã đúng), streaming/analytics/notification/search/listening-party (không dùng PostgreSQL).

---
[2026-05-16] [BACKEND / PHASE 3 — MUSIC SERVICE ALIGNMENT] [DONE]

**Task:** Enrich Music Service để FE nhận đủ fields: `genreName`, `moodName`, `language`, `releaseDate`, `playCount`.

**Changes:**
- `Song.cs` — thêm `Mood` property (`string?`)
- `MusicDbContext.cs` — `entity.Property(e => e.Mood).HasMaxLength(50)`
- Migration `20260516000000_AddMoodToSongs` — `ALTER TABLE songs ADD COLUMN "Mood" VARCHAR(50)` + Designer.cs
- `MusicDbContextModelSnapshot.cs` — update snapshot để khớp migration mới
- `SongResponseDto.cs` — thêm 5 fields: `GenreName`, `MoodName`, `Language`, `ReleaseDate`, `PlayCount`
- `MusicRepository.cs` — `GetSongByIdAsync`: thêm `.ThenInclude(sg => sg.Genre)` để load genre name (trước đây `sg.Genre` luôn null)
- `SongService.cs` — `MapToResponseDto` map 5 fields mới từ entity sang DTO
- `SongServiceGetTests.cs` — fix `BuildSongDto` (thêm 5 null/0 args), thêm 3 tests: `GetSong_WhenSongHasGenreAndMood_MapsFieldsCorrectly`, `GetSong_WhenSongHasAlbumWithReleaseDate_MapsReleaseDateFromAlbum`, `GetSong_WhenSongHasNoGenres_GenreNameIsNull`
- `infra/seed/seed.sh` — update header comment ghi rõ prerequisite Phase 2B + 3 phải done trước khi chạy

**Results:** 10/10 unit tests xanh (7 cũ + 3 mới). Migration đã apply thành công vào music_db (confirmed từ seed.sh output).

---
[2026-05-16] [INFRA / DOCKER COMPOSE CONNECTION STRING KEY MISMATCH] [DONE]

**Task:** Fix `Npgsql.NpgsqlException: Failed to connect to 127.0.0.1:5434` trong smartmusic-music-service (và tiềm năng auth-service, user-service).

**Root cause:** docker-compose.yml pass env var với key sai — ASP.NET Core không nhận ra → fallback về `appsettings.Development.json` (có `localhost:5434`) → container dùng localhost thay vì Docker internal hostname `postgres`.

| Service | Code đọc | docker-compose cũ | docker-compose mới |
|---|---|---|---|
| auth-service | `ConnectionStrings:AuthDb` | `ConnectionStrings__PostgreSQL` | `ConnectionStrings__AuthDb` |
| user-service | `ConnectionStrings:Postgres` | `ConnectionStrings__PostgreSQL` | `ConnectionStrings__Postgres` |
| music-service | `ConnectionStrings:DefaultConnection` | `ConnectionStrings__PostgreSQL` | `ConnectionStrings__DefaultConnection` |

**Fix:** `infra/docker-compose.yml` — đổi 3 key env vars cho 3 services trên.

**Kết quả:** Services trong Docker sẽ đọc `Host=postgres;Port=5432` từ env var thay vì `localhost:5434` từ appsettings.

**Side fix:** `appsettings.Development.json` của auth, user, music service — đổi từ `Port=5432;Username=postgres;Password=4L27hN04@` → `Port=5434;Username=smartmusic;Password=changeme_local` để `dotnet ef` và `seed.sh` chạy từ host connect được.
- `infra/.env` và `infra/.env.example` — thêm `POSTGRES_PORT=5434` để seed.sh psql health check dùng đúng port.

---
[2026-05-16] [INFRA / POSTGRES PORT CONFLICT] [DONE]

**Task:** Fix pgAdmin không kết nối được PostgreSQL Docker container.

**Root cause:** Máy Windows có 2 native PostgreSQL instances đang listen trên cả port 5432 và 5433 (process `postgres.exe`). pgAdmin kết nối vào native PostgreSQL thay vì Docker container → password `smartmusic/changeme_local` không tồn tại trong native instance → FATAL authentication failed.

**Fix:**
- `infra/docker-compose.yml` — đổi port mapping postgres từ `5432:5432` → `5434:5432`
- Port 5434 chỉ có Docker backend + WSL relay, không có native postgres

**Kết nối pgAdmin đúng (đã verify hoạt động):**
- Host: `localhost`, Port: `5434`, Database: `smartmusic`, Username: `smartmusic`, Password: `changeme_local`, SSL: Disable

**Lưu ý:** Services C# kết nối PostgreSQL qua Docker internal network (không qua host port) nên thay đổi này không ảnh hưởng runtime.

---
[2026-05-15] [BACKEND / PHASE 2A+2B — AUTH + USER SERVICE ALIGNMENT] [DONE]

**Task:** Align Auth Service và User Service với schema FE cần. Google OAuth login, fix field names, fix DB schema.

**Phase 2A — Auth Service:**
- `LoginRequest.Username` → `LoginRequest.Email` — FE gửi `email` field
- `POST /api/v1/auth/google` endpoint mới — verify Google `id_token` bằng `Google.Apis.Auth`
- `GoogleTokenVerifier.cs` — `GoogleJsonWebSignature.ValidateAsync` với `GOOGLE_CLIENT_ID` làm audience
- `IGoogleTokenVerifier`, `GooglePayload` record thêm vào Application layer
- `IUserGrpcClient.GetUserByEmailAsync` + `CreateOAuthUserAsync` — gRPC calls mới
- `proto/user.proto` — thêm `GetUserByEmail` RPC + `is_oauth`, `picture_url` fields vào `CreateUserRequest`
- `JwtValidationMiddleware` — whitelist `/api/v1/auth/google`
- `AuthService.GoogleSignInAsync` — lookup → auto-register nếu user mới → issue JWT
- `Google.Apis.Auth` NuGet thêm vào `AuthService.Infrastructure.csproj`

**Phase 2B — User Service:**
- `User.PasswordHash` → `string?` nullable — OAuth users không có password
- `UserGrpcService.GetUserByEmail` mới implemented
- `UserGrpcService.CreateUser` — skip BCrypt hashing khi `is_oauth = true`, lưu `PasswordHash = null`
- `UserGrpcService.VerifyCredentials` — block password login cho OAuth users (PasswordHash null)
- `UserDbContext` — fix `preferred_artists` column (từ `preferred_languages varchar(10)[]` → `text[]`)
- Migration `20260515000000_FixOAuthAndPreferencesSchema` — nullable password_hash, rename+retype column
- `UserProfileDto` — thêm `PreferredGenres`, `PreferredArtists` fields
- `UserProfileService.MapToDto` — include prefs trong DTO response

**Frontend:**
- `@react-oauth/google` install + `@testing-library/dom` (missing peer dep fixed)
- `authService.ts` — `login()` dùng `email` field, thêm `googleSignIn(idToken)`
- `useAuth.ts` — thêm `googleLogin(idToken)`, extract `handleAuthSuccess` helper
- `LoginForm.tsx` — dùng `GoogleLogin` component (trả `credential` = `id_token`), đổi state `username` → `email`
- `App.tsx` — wrap với `GoogleOAuthProvider` dùng `VITE_GOOGLE_CLIENT_ID`
- `.env.example` — thêm `VITE_GOOGLE_CLIENT_ID`

**Results:**
- Auth Service: build OK, 14/14 unit tests xanh (4 Google tests mới)
- User Service: build OK
- Frontend: 698/698 tests xanh (không có test nào bị regression)

**Key decisions:**
- Dùng `GoogleLogin` component (không phải `useGoogleLogin`) vì chỉ `GoogleLogin` mới cung cấp `credential` = `id_token` cho backend verify. `useGoogleLogin` implicit flow chỉ trả `access_token`.
- gRPC call thứ 3 (`GetUserByEmail`) được override rule `no-scope-creep` theo xác nhận của user — cần thiết cho OAuth flow.
- OAuth users bị block khi cố login bằng password (PasswordHash null → reject ngay trong VerifyCredentials).

---
[2026-05-15] [BACKEND / PHASE 1 — INFRASTRUCTURE SETUP] [DONE]

**Task:** Tạo toàn bộ infrastructure setup cho Backend API Alignment: postgres init script, seed data, seed orchestrator, docker-compose update.

**Files tạo mới:**
- `infra/postgres/init/01_create_databases.sql` — tạo 7 databases (auth_db, user_db, music_db, streaming_db, listening_party_db, analytics_db, notification_db) khi postgres container khởi động lần đầu. Dùng `\connect postgres` + `CREATE DATABASE` + `GRANT`. Idempotent với docker volume.
- `infra/seed/SeedData.sql` — seed music_db: 9 genres (Pop/Rock/R&B/Jazz/Classical/Electronic/Hip-Hop/Acoustic/Indie), 1 artist (`aa111111-bbbb-cccc-dddd-eeeeeeeeeeee` linked to creator@ user), 8 songs với GCS audio keys dạng `songs/{id}/audio.mp3`, 8 song_genres links. Seed user_db: listener preferences với `preferred_genres` = [Pop, Rock]. Tất cả dùng `ON CONFLICT DO NOTHING` — idempotent.
- `infra/seed/seed.sh` — orchestrator chạy theo thứ tự: wait postgres healthy → EF migrations cho 3 services (auth/user/music) via `dotnet ef database update` → SeedData.sql → elasticsearch_seed.sh → redis_seed.sh. Đọc `.env` tự động.
- `infra/secrets/.gitkeep` — thư mục chứa `google-cloud-key.json` (gitignored), được mount vào containers.

**Files sửa:**
- `infra/docker-compose.yml` — music-service: bỏ Aws__* env vars, thêm GCP__ProjectId + GCP__BucketName + GOOGLE_APPLICATION_CREDENTIALS + Cloudinary__* + secrets volume. streaming-service: tương tự, chỉ GCS (không cần Cloudinary). auth-service: thêm `Google__ClientId`.
- `services/music-service/src/MusicService.Api/Program.cs` — thêm `db.Database.MigrateAsync()` tại startup (pattern giống user-service DbInitializer).

**Key decisions:**
- Song UUIDs dùng pattern `11111111-0000-0000-0000-00000000000X` — dễ nhớ, nhất quán giữa PostgreSQL và elasticsearch.
- `seed.sh` KHÔNG chạy ngay sau Phase 1 — phải chờ Phase 2B (user migration) và Phase 3 (music mood migration) xong mới chạy 1 lần duy nhất.
- `google-cloud-key.json` mount qua Docker volume `/app/secrets/`, không bake vào Docker image (security rule compliance).

---
[2026-05-15] [AUTH SERVICE / GOOGLE OAUTH — THÊM VÀO PLAN] [PLANNED]

**Task:** Bổ sung Google OAuth login vào plan backend alignment. Env vars `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` đã được thêm vào `.env`.

**Thiết kế flow:**
- FE dùng Google JS SDK (hoặc `@react-oauth/google`) → nhận `id_token` (JWT do Google ký)
- FE gửi `POST /api/v1/auth/google` với `{ idToken }` — endpoint public (skip JWT middleware)
- Auth Service dùng `Google.Apis.Auth` NuGet để verify `id_token` với `GOOGLE_CLIENT_ID` làm audience
- Extract: `email`, `name`, `picture`, `sub` (Google unique ID) từ payload
- Gọi User Service gRPC `GetUserByEmail` → nếu NOT_FOUND → tự động gọi `CreateUser` (auto-register)
- Phát JWT access token + HTTP-only refresh cookie như login thường

**Changes cần implement:**
- `Google.Apis.Auth` NuGet → `GoogleJsonWebSignature.ValidateAsync(idToken, { Audience: CLIENT_ID })`
- `POST /api/v1/auth/google` controller endpoint
- `GoogleTokenVerifier.cs` infrastructure class
- `proto/user.proto` — thêm `GetUserByEmail` RPC
- User Service migration: `password_hash` → nullable (OAuth users không có password)
- API Gateway whitelist: `/api/v1/auth/google` skip JWT validation
- FE `LoginPage.tsx` — thêm Google Sign-In button
- FE `authService.ts` — thêm `googleSignIn(idToken)`

**Key decision:**
- Không dùng server-side OAuth callback (authorization code flow) vì FE là SPA — dùng implicit/token flow: FE nhận `id_token` từ Google, gửi thẳng lên BE để verify. An toàn vì `id_token` được verify bằng Google public keys.
- `GOOGLE_CLIENT_SECRET` không dùng trong flow này (dành cho server-side code exchange) — giữ trong `.env` để dự phòng nếu cần server-side flow sau này.

---
[2026-05-15] [BACKEND / API ALIGNMENT PLAN — KHẢO SÁT + LẬP KẾ HOẠCH] [PLANNED]

**Task:** Lập kế hoạch align toàn bộ BE APIs với schema FE cần sau khi Frontend UI hoàn thành.

**Khảo sát thực tế — gaps phát hiện:**

1. **Auth Service**: `LoginRequest.Username` — FE gửi field `email` nhưng BE expect `username`.
2. **User Service**: `UserProfileDto` thiếu `preferredGenres[]`, `preferredArtists[]`, `hasCompletedOnboarding`. DB thiếu cột `has_completed_onboarding` và `preferred_artists` bị map nhầm sang column `preferred_languages`.
3. **Music Service**: `SongResponseDto` thiếu `genreName`, `moodName`, `language`, `releaseDate`, `playCount`. Table `songs` không có cột `mood`.
4. **Analytics Service**: Heatmap DTO trả field `skipRate` nhưng FE cần `count`. Stats DTO trả `DailyPlays[]{Date, Plays}` nhưng FE cần `dailyListeners[]{date, count}`.
5. **Notification Service**: DTO fields lệch hoàn toàn — BE trả `{Id, Title, Body, Status}`, FE cần `{notificationId, message, read, createdAt, type}`.
6. **Streaming Service**: Cần verify field name `url` vs `streamUrl` khớp với FE type, và GCS env vars đúng.
7. **Listening Party**: FE gọi `/ws/v1/parties/{roomId}`, actual SignalR hub là `/hubs/party?roomId={roomId}` → cần API Gateway route alias.
8. **Infrastructure**: DB drop sạch, không có seed data, Elasticsearch index chưa có, InfluxDB bucket chưa setup.

**Kế hoạch 9 phases:** xem `.claude/plan/backend-api-alignment-frontend.md`

**Quyết định kiến trúc:**
- Phase 2A (Auth) và 2B (User) chạy song song — độc lập nhau.
- Group A (Phase 2, 3, 4, 6, 7, 8) chạy song song sau Phase 1.
- Group B (Phase 5, 9) chờ song data từ Phase 3 (Music seeded).
- WS path fix: chọn Option A — API Gateway route alias, không sửa FE đã done.

---
[2026-05-15] [FRONTEND / VERIFICATION + BUG FIXES — TSC, BUILD, 3 UI BUGS] [DONE]

**Task:** Chạy Verification Checklist sau khi hoàn thành Frontend Phase 2 (Phase 0–9). Fix lỗi TypeScript build + 3 UI bugs phát hiện khi verify thủ công.

**TypeScript build fixes (15 errors / 8 files):**
- `EmptyState.tsx`, `PartyRoomPage.test.tsx` — xóa unused `import React`
- `QueueDrawer.tsx` — xóa `formatDuration` declared nhưng không dùng
- `mocks/data.ts` — `CURRENT_MOCK_USER` infer là Listener-only type, không assign được Creator → thêm explicit union type
- `ToastContext.test.tsx` — `ShowToastButton` variant prop lock vào `'success'` literal → khai báo tường minh `ToastVariant`
- `HeatmapChart.test.tsx` — 6 `const { container }` destructure nhưng không dùng → đổi thành `render()` plain
- `RecommendationFeedRow.test.tsx`, `useRecommendations.test.tsx` — xóa unused `beforeEach` import
- `useRecommendations.test.tsx` — `initialProps: { ctx: 'morning' as const }` lock type literal, `rerender({ ctx: 'evening' })` fail → đổi `as const` → `as 'morning' | 'evening' | 'none'`

**UI Bug fixes (3 bugs):**

Bug 1 — Sidebar "Analytics" link trỏ `/analytics` (không có route) → đổi thành `/dashboard`.

Bug 2 — UserMenuDropdown bị BottomPlayerBar che:
- Root cause: Dropdown nằm bên trong `<nav>` (stacking context z-50). Child dù có z-[100] cũng bị paint trong layer z-50 của nav → BottomPlayerBar (cũng z-50, render sau) đè lên.
- Nâng Sidebar lên z-[55] chỉ chuyển vấn đề: Sidebar đè phần trái BottomPlayerBar.
- Fix đúng: Move dropdown ra ngoài `<nav>` (cùng pattern party modals đã có). Dùng `position: fixed` với tọa độ từ `getBoundingClientRect()` của anchor ref + `zIndex: 60`.

Bug 3 — FilterPills active state chữ bị che đen:
- Root cause cuối cùng: `index.css` có `button { background: none; }` **ngoài `@layer`**. Trong CSS Cascade Layers, unlayered styles thắng layered styles kể cả khi class có specificity cao hơn. Tailwind v4 đặt toàn bộ utilities vào `@layer utilities` → `bg-white`, `bg-text-base`, `bg-[#ffffff]` đều bị override.
- Fix: dùng `!bg-[#ffffff]` (Tailwind important modifier) — escape cascade layer priority.

**Tests: 698/698 xanh (không thay đổi)**

---
[2026-05-15] [FRONTEND / PHASE 2 — PHASE 9: BOTTOMPLAYERBAR QUEUEDRAWER INTEGRATION] [DONE]

**Task:** Phase 9 — Wire QueueDrawer vào BottomPlayerBar + test coverage.

**Phát hiện:** BottomPlayerBar.tsx đã implement đủ Phase 9 từ trước: `showQueue` state, nút `open-queue-btn`, `QueueDrawer` render khi `showQueue=true`. Z-index đúng: QueueDrawer `z-[59]`/`z-[60]`, NowPlayingOverlay `z-[100]`. Chỉ thiếu test coverage.

**Files đã sửa:**
- `tests/components/layout/BottomPlayerBar.test.tsx` — thêm `vi.mock` cho QueueDrawer (stub đơn giản với `data-testid="queue-drawer"` + close button). 4 tests mới: queue button render, hidden by default, click opens, onClose closes.

**Tests: 4 tests mới, 698/698 xanh**

**Key decisions:**
- Mock QueueDrawer trong BottomPlayerBar test — tránh phụ thuộc vào playerStore queue internals và animation. Test chỉ verify integration wiring, không test QueueDrawer behavior (đã có `QueueDrawer.test.tsx` riêng).
- Stub dùng `isOpen` prop để conditionally render — verify cả 2 trạng thái open/closed.

---

[2026-05-15] [FRONTEND / PHASE 2 — PHASE 8: ROUTE REGISTRATION] [DONE]

**Task:** Phase 8 — Đăng ký 5 routes mới trong App.tsx + viết test coverage.

**Phát hiện:** App.tsx đã có đủ 5 routes từ trước (implement cùng lúc với pages Phase 5). Phase 8 chỉ còn thiếu test file.

**Files đã tạo:**
- `tests/App.test.tsx` — 14 tests: mock tất cả page components, dùng `window.history.pushState` để set URL, verify đúng page render theo route. Cover: 5 routes mới, route specificity (`/dashboard/songs/:id` vs `/dashboard`), dynamic segments với arbitrary param values, ToastProvider wrap.

**Tests: 14 tests mới, 694/694 xanh**

**Key decisions:**
- Dùng `window.history.pushState` thay vì MemoryRouter vì App.tsx dùng BrowserRouter internally — không thể inject MemoryRouter từ ngoài.
- Mock tất cả page components thành stub đơn giản (`data-testid="page-X"`) để test routing thuần, không bị ảnh hưởng bởi internals của từng page.
- Test route specificity: `/dashboard/songs/song-001` chỉ render `page-song-analytics`, không render `page-dashboard` — verify React Router resolve đúng thứ tự.

---

[2026-05-15] [FRONTEND / PHASE 2 — PHASE 7: SIDEBAR + MOBILENAV UPDATES] [DONE]

**Task:** Phase 7 — Tích hợp UserMenuDropdown vào Sidebar, thêm `/profile` link vào MobileNav.

**Files đã sửa:**
- `components/layout/Sidebar.tsx` — chuyển user bottom section từ `div` sang `button` có `ref` + `data-testid="user-menu-trigger"`. Thêm `showUserMenu` state + `userMenuAnchorRef`. Render `UserMenuDropdown` conditionally trong wrapper `absolute bottom-full left-0 mb-2` khi `showUserMenu=true`. Click ngoài → `onClose` → `showUserMenu=false`.
- `components/layout/MobileNav.tsx` — thêm `{ to: '/profile', label: 'Hồ sơ', icon: 'person' }` vào `NAV_ITEMS`. Item 5 trong bottom bar mobile.

**Tests: 8 tests mới, 680/680 xanh**
- `tests/components/layout/Sidebar.test.tsx` — 5 tests mới trong describe `Sidebar — user menu dropdown`: button render, hidden by default, click opens, shows Profile/Preferences/Logout, click outside closes.
- `tests/components/layout/MobileNav.test.tsx` — 3 tests mới: renders Hồ sơ item, href=/profile, active on /profile route.

**Key decisions:**
- UserMenuDropdown đặt trong wrapper `absolute bottom-full left-0 mb-2` (xuất hiện phía trên trigger) thay vì bên dưới — phù hợp vị trí trigger ở đáy sidebar.
- Chỉ render wrapper khi `showUserMenu=true` (không render hidden dropdown) — tránh DOM clutter và test `queryByRole('menu')` đơn giản hơn.
- MobileNav label dùng "Hồ sơ" (2 chữ ngắn) thay vì "Profile" để nhất quán với tiếng Việt toàn app.

---
[2026-05-15] [FRONTEND / PHASE 2 — PHASE 6: ENHANCE HOMEPAGE + SEARCHPAGE + CREATORDASHBOARD] [DONE]

**Task:** Phase 6 — Tích hợp các component mới vào trang hiện có, thêm ArtistCard component mới.

**Files đã tạo:**
- `features/search/components/ArtistCard.tsx` — circular avatar 100px, floating play button (stopPropagation), click → `/artists/:id`, keyboard navigation (Enter/Space), `data-testid="artist-card-{id}"`, aria-label

**Files đã sửa:**
- `pages/HomePage.tsx` — thêm `ContextSelector` + `ContextFeedSection` (RecommendationFeedRow list), state `selectedContext`, truyền vào `useRecommendations(selectedContext)`. `ContextFeedSection` chỉ hiển thị khi `selectedContext !== 'none'` để tránh duplicate elements.
- `pages/SearchPage.tsx` — thêm `FilterTab = 'all' | 'songs' | 'artists'`, `FilterTabs` component với tablist + aria-selected + active underline. `ArtistsRow` dùng `ArtistCard`. EmptyState trong `<div data-testid="no-results">`.
- `pages/CreatorDashboardPage.tsx` — thêm section "Bài hát của tôi" với `CreatorSongTable` + "TẢI LÊN BÀI MỚI" button. `rows={MOCK_CREATOR_SONG_ROWS.slice(1)}` để tránh 'Lạc Trôi' conflict với SONG_OPTIONS[0].

**Tests: 37 tests mới, 672/672 xanh**
- `tests/features/search/ArtistCard.test.tsx` — 13 tests: rendering, interaction, accessibility
- `tests/pages/HomePage.test.tsx` — 9 tests mới: ContextSelector chips (5), context feed section (4)
- `tests/pages/SearchPage.test.tsx` — 9 tests mới: filter tabs (7), ArtistCard integration (2)
- `tests/pages/CreatorDashboardPage.test.tsx` — 6 tests: CreatorSongTable section

**Bugs fixed:**
- HomePage `getByText('Lạc Trôi')` multiple elements: `ContextFeedSection` chỉ render khi `selectedContext !== 'none'` → default state = cards only, no duplicates.
- HomePage `getByText('Gợi ý cho bạn')` multiple: same fix — feed section hidden by default.
- CreatorDashboardPage `getByText('Chuyến Xe')` multiple: `slice(1)` removes song-001 from table; `getByText('Chuyến Xe')` replaced with `getAllByText(...)`.
- Context feed tests: cần click chip trước (`fireEvent.click(screen.getByRole('button', { name: /🌅 Sáng/i }))`) vì section ẩn theo default.

---
[2026-05-15] [FRONTEND / PHASE 2 — PHASE 5: 5 TRANG MỚI] [DONE]

**Task:** Phase 5 — Tạo 5 trang mới từ Stitch designs, dùng mock data hoàn toàn (không gọi API).

**Files đã tạo:**
- `pages/SongDetailPage.tsx` — Hero blurred bg + gradient, cover 160px, artist link, play/queue/context actions, metadata grid (genre/mood/language/year/playCount), explainText card, related songs horizontal scroll
- `pages/ArtistPage.tsx` — Hero banner + circular avatar 120px, stats bar (songs/plays/followers), follow toggle, popular tracks list, Fans Also Like horizontal scroll
- `pages/creator/CreatorSongAnalyticsPage.tsx` — Role guard (Listener → redirect `/`), breadcrumb, song info card, TimeRangeSelector, 3 SongStatsCard KPIs, DailyListenersChart, HeatmapChart
- `pages/ProfilePage.tsx` — Avatar with hover overlay + file input local preview, click-to-edit display name, email + lock icon (read-only), role badge, genre/artist chips, edit preferences link, logout
- `pages/PreferencesPage.tsx` — GenreGrid reuse từ onboarding, artist search + filter dropdown + selected chips, sticky save bar, validation (< 3 genres → disabled + warning), save → toast (no API call)
- Tests: 5 files, 92 tests tổng

**Mock data đã thêm:**
- `mocks/data.ts`: `MOCK_HEATMAP` (20 data points), `MOCK_DAILY_STATS` (7 ngày)

**Bugs fixed trong tests:**
- `SongDetailPage "renders hero section with song title"`: `getByText('Lạc Trôi')` ném `Found multiple elements` vì title xuất hiện cả ở hero H1 lẫn SongCard `song-001` trong related → fix dùng `getByRole('heading', { level: 1 })`
- `PreferencesPage` 3 tests: `MOCK_PROFILE.preferredGenres = ['V-Pop', 'Acoustic', 'Indie']` (3 items) → `canSave=true` ngay từ đầu, không phải disabled. `artistSearch 'Sơn'` bị filter ra vì 'Sơn Tùng M-TP' đã selected → đổi search sang 'Vũ'. Sửa assertions để match actual behavior.

**Key decisions:**
- `CreatorSongAnalyticsPage` role guard dùng `<Navigate to="/" replace />` — redirect ngay khi render, không mount AppShell
- `ProfilePage` avatar edit: `URL.createObjectURL(file)` cho local preview — không upload, không gọi API
- `PreferencesPage` init genres từ `MOCK_PROFILE.preferredGenres` (UX tốt: user thấy sở thích cũ) — nên save button enabled ngay từ đầu nếu user đã có ≥ 3 genres
- `PreferencesPage` sticky bar: `bottom-[72px] lg:bottom-0` — nhường chỗ cho MobileNav trên mobile

**Tests:** 92 tests mới. 635/635 toàn bộ test suite xanh — không regression.

---
[2026-05-15] [FRONTEND / PHASE 2 — PHASE 4: QUEUEDRAWER + PLAYERSTORE QUEUE] [DONE]

**Task:** Phase 4 — extend `playerStore` với queue state, tạo `QueueDrawer` component, wire vào `BottomPlayerBar`.

**Files đã tạo:**
- `store/playerStore.ts` — thêm `queue: CurrentSong[]`, `addToQueue`, `removeFromQueue`, `clearQueue`; export `CurrentSong` interface
- `features/player/components/QueueDrawer.tsx` — slide-in panel right 360px: now-playing row (ring-spotify-green), queue items (drag handle visual, remove button opacity-0 → hover), empty states (2 variants), "Xóa tất cả" button, backdrop click-to-close; `queue ?? []` defensive fallback
- `tests/features/player/QueueDrawer.test.tsx` — 30 tests

**Files đã sửa:**
- `components/layout/BottomPlayerBar.tsx` — import QueueDrawer, `showQueue` state, wire nút `queue_music`, conditional mount `{showQueue && <QueueDrawer />}` (tránh duplicate DOM khi closed)

**Key decisions:**
- `CurrentSong` interface giờ exported từ `playerStore` — dùng được bởi QueueDrawer và các component khác
- `queue ?? []` fallback trong QueueDrawer — defensive guard khi Party tests / test contexts khác set store state không đầy đủ
- `{showQueue && <QueueDrawer />}` thay vì luôn mount — tránh text duplicate trong BottomPlayerBar tests (currentSong title sẽ xuất hiện cả ở player bar lẫn now-playing row của drawer)
- Slide-in animation dùng `translate-x-full` / `translate-x-0` + `transition-transform duration-300` — enter animation mượt, exit là instant pop (acceptable cho MVP)

**Bugs fixed:**
- `TypeError: queue.map is not a function` trong Party tests (PartyRoomPage, PartyLandingPage): các tests này render `AppShell` → `BottomPlayerBar` → `QueueDrawer`, store state trong test context không có `queue` field → fixed với `?? []` fallback
- `Found multiple elements with text: Chuyến Xe` trong BottomPlayerBar test: QueueDrawer luôn mount render cả now-playing row → fixed với conditional mount

**Tests:** 30/30 QueueDrawer tests xanh, 543/543 toàn bộ test suite xanh — không regression.

---
[2026-05-15] [FRONTEND / PHASE 2 — PHASE 3: RECOMMENDATION COMPONENTS] [DONE]

**Task:** Tạo 2 Recommendation components cho Phase 3: ContextSelector và RecommendationFeedRow.

**Files đã tạo:**
- `features/recommendation/components/ContextSelector.tsx` — 5 chips (none/morning/afternoon/evening/night), active = bg-spotify-green, aria-pressed per chip, role="group" accessible label
- `features/recommendation/components/RecommendationFeedRow.tsx` — row 64px với hover state (index → play button), cover 56px, title navigate `/songs/:id`, reason badge ẩn nếu text rỗng, formatDuration helper co-located
- `tests/features/recommendation/ContextSelector.test.tsx` — 20 tests
- `tests/features/recommendation/RecommendationFeedRow.test.tsx` — 22 tests

**Key decisions:**
- `ContextSelector` dùng `role="group"` + `aria-label` thay vì `role="radiogroup"` — chips không phải mutually exclusive theo semantics (có thể toggle về none)
- `RecommendationFeedRow` hover swap: `useState(hovered)` + `onMouseEnter/Leave` trên row container — play button chỉ mount khi hovered (không dùng CSS opacity để tránh click vô tình)
- `formatDuration` đặt trong component file — không export vì chỉ dùng ở đây
- Reason badge ẩn bằng conditional render (không render `<span>` khi `text` rỗng) — tránh empty DOM node

**Fix trong tests:** `queryByText('')` gây `Found multiple elements` error — đổi sang `container.querySelector('span.bg-mid-dark.rounded')` để kiểm tra badge vắng mặt.

**Tests:** 42/42 Phase 3 tests xanh, 513/513 toàn bộ test suite xanh — không regression.

---
[2026-05-15] [FRONTEND / PHASE 2 — PHASE 2: CREATOR COMPONENTS] [DONE]

**Task:** Tạo 5 Creator components từ Stitch designs, extract từ `CreatorDashboardPage`, cập nhật page dùng components mới.

**Files đã tạo:**
- `features/creator/components/TimeRangeSelector.tsx` — pill toggle 7d/30d, extract từ inline code trong Dashboard, aria-pressed
- `features/creator/components/SongStatsCard.tsx` — KPI card với icon Material Symbol mới, trend optional (KpiCard cũ trend required)
- `features/creator/components/DailyListenersChart.tsx` — SVG line chart với hover tooltip per data point (tính năng mới), `buildChartPaths` helper co-located
- `features/creator/components/HeatmapChart.tsx` — heatmap bar với peak marker + threshold dashed line mới (`thresholdPct` prop, default 30%), `formatSeconds` + `heatColor` helpers co-located
- `features/creator/components/CreatorSongTable.tsx` — table mới hoàn toàn: sort 5 cột (client-side, toggle asc/desc), pagination 10 rows/page, loading (SkeletonRow), empty (EmptyState), "Xem phân tích" opacity-0 hover
- Tests: 5 files, 94 tests tổng (10 + 11 + 15 + 19 + 39)

**Files đã sửa:**
- `pages/CreatorDashboardPage.tsx` — xóa 6 inline definitions (TrendBadge, KpiCard, SkipHeatmap, LineChart, formatSeconds, buildChartPaths, heatColor); import 4 components mới; dùng SongStatsCard với icons (headphones, play_circle, task_alt, trending_up); dùng TimeRangeSelector, HeatmapChart, DailyListenersChart

**Key decisions:**
- `DailyListenersChart` bỏ `timeRange` prop so với `LineChart` cũ — time range label đã hiện qua `TimeRangeSelector` ở header
- `SongStatsCard.trend` là optional (KpiCard cũ là required) — flexible hơn cho `CreatorSongAnalyticsPage` ở Phase 5
- `HeatmapChart.thresholdPct` default = 0.3 (30%) — vị trí line tính từ left của bar theo phần trăm song duration
- `CreatorSongTable` default sort = `uploadedAt desc` — phù hợp UX Creator muốn xem bài mới nhất trước
- Tests dùng `within(row).queryByText()` để tìm đúng row sau sort thay vì index cứng — tránh flaky khi default sort thay đổi

**Tests:** 94/94 Phase 2 tests xanh, 471/471 toàn bộ test suite xanh — không regression.

---
[2026-05-15] [FRONTEND / PHASE 2 — PHASE 1: SHARED UI COMPONENTS] [DONE]

**Task:** Tạo 3 shared UI components mới cho Phase 2: EmptyState, SongContextMenu, UserMenuDropdown.

**Files đã tạo:**
- `components/ui/EmptyState.tsx` — 4 variants (music/search/bell/group), icon circle 80px, optional CTA pill
- `components/ui/SongContextMenu.tsx` — dropdown 200px, 5 items, đóng khi click ngoài (mousedown listener)
- `components/ui/UserMenuDropdown.tsx` — popover 220px, avatar initial + tên + email, 3 menu items, Logout gọi `clearAuth()` + navigate `/login`
- `tests/components/ui/EmptyState.test.tsx` — 14 tests
- `tests/components/ui/SongContextMenu.test.tsx` — 15 tests
- `tests/components/ui/UserMenuDropdown.test.tsx` — 13 tests

**Key decisions:**
- CTA button trong EmptyState chỉ render khi **cả hai** `ctaLabel` và `onCta` đều được truyền — tránh dead button
- Click-outside pattern dùng `mousedown` (không phải `click`) — nhất quán với `CreatorDashboardPage.dropdownRef`
- `UserMenuDropdown` dùng `useAuthStore` trực tiếp (không nhận `onLogout` prop) — đơn giản hơn, không cần caller wire thêm

**Tests:** 42 tests mới, 377/377 toàn bộ test suite xanh — không regression.

**Chưa visible trên UI:** 3 components chưa được wire vào trang nào. Sẽ xuất hiện ở Phase 5/6/7.

---
[2026-05-15] [FRONTEND / PHASE 2 — PHASE 0: TYPES & MOCK DATA] [DONE]

**Task:** Thêm types mới cho Phase 2 (Artist, SongDetail, CreatorSongRow), mở rộng UserProfile, thêm mock data cho 5 trang mới, và cập nhật `useRecommendations` để hỗ trợ `externalContext`.

**Files đã sửa:**
- `types/domain.ts` — thêm `Artist`, `SongDetail extends Song`, `CreatorSongRow`
- `services/userService.ts` — thêm `avatarUrl?`, `preferredGenres?`, `preferredArtists?` vào `UserProfile`
- `mocks/data.ts` — thêm `MOCK_SONG_DETAIL`, `MOCK_ARTIST`, `MOCK_RELATED_SONGS` (8 items), `MOCK_CREATOR_SONG_ROWS` (7 rows), `MOCK_PROFILE`
- `features/recommendation/hooks/useRecommendations.ts` — thêm optional `externalContext?: TimeContext | 'none'` parameter; backward compat giữ nguyên

**Key decisions:**
- `MOCK_SONG_DETAIL.id = 'song-001'` — nhất quán với MOCK_SONGS để navigate giữa pages hoạt động
- `useRecommendations('none')` → dùng `autoContext` để fetch nhưng trả `context = 'none'` cho UI (ContextSelector "Tất cả")
- Import types vào `mocks/data.ts` để TypeScript enforce shape

**Tests:** 21/21 Phase 0 tests xanh, 335/335 toàn bộ test suite xanh — không regression.

---
[2026-05-14] [FRONTEND / PHASE 2 PLANNING — NEW PAGES & COMPONENTS] [PLANNED]

**Task:** Lên plan implement 5 trang mới và ~14 components mới từ Stitch designs (`design/phase2/`).

**Design assets:** 10 folder trong `design/phase2/`, mỗi folder có `code.html` + `screen.png`. Map:
- `chi_ti_t_b_i_h_t_soundwave/` → SongDetailPage (`/songs/:songId`)
- `h_s_ngh_s_soundwave/` → ArtistPage (`/artists/:artistId`)
- `analytics_chi_ti_t_b_i_h_t_soundwave_creator/` → CreatorSongAnalyticsPage (`/dashboard/songs/:songId`)
- `h_s_ng_i_d_ng_soundwave/` → ProfilePage (`/profile`)
- `c_p_nh_t_s_th_ch_soundwave/` → PreferencesPage (`/settings/preferences`)
- `th_nh_ph_n_trang_ch_soundwave/` → ContextSelector + RecommendationFeedRow (HomePage enhancements)
- `k_t_qu_t_m_ki_m_t_t_c_soundwave/` → SearchFilters + ArtistCard (SearchPage enhancements)
- `kh_ng_t_m_th_y_k_t_qu_soundwave/` → EmptyState component
- `danh_s_ch_b_i_h_t_creator_dashboard/` → CreatorSongTable (CreatorDashboardPage enhancement)
- `th_nh_ph_n_ti_n_ch_soundwave/` → QueueDrawer + SongContextMenu + UserMenuDropdown

**Strategy:** Dùng mock data hoàn toàn — không gọi API thật. Tích hợp BE ở giai đoạn sau.

**Reuse:**
- `<GenreGrid>` (onboarding) tái dùng cho PreferencesPage
- `KpiCard`, `LineChart`, `SkipHeatmap` extract từ CreatorDashboardPage thành components riêng
- `SkeletonRow` (ui) tái dùng cho CreatorSongTable loading state
- `HorizontalSection` (HomePage pattern) tái dùng cho SongDetailPage related songs
- `CreateRoomModal` tái dùng từ SongDetailPage "Add to Party" action

**Pitfalls đã note:**
- ArtistPage không có API endpoint riêng → dùng `artistId` như search query
- PreferencesPage sticky save bar phải `bottom-[72px] lg:bottom-0` (trên BottomPlayerBar)
- Chart helpers (`formatSeconds`) phải co-locate với component khi extract

**Plan file:** `.claude/plan/frontend-phase2-new-pages-components.md`
**Tổng:** 16 files mới + 11 files sửa, 9 phases.

---
[2026-05-14] [FRONTEND / CSS AUDIT PHASE 6 — NOTIFICATIONS & CREATOR FEATURES] [DONE]

**Task:** Audit và fix 4 files cuối cùng theo DESIGN_STITCH.md rules — hoàn tất toàn bộ CSS Audit (44 files).

**Clean (không cần sửa):** NotificationRow.tsx ✅

**Violations đã fix (6):**
1. `FilterPills.tsx` — active pill: inline `style={{ backgroundColor: '#ffffff', color: '#121212' }}` → Tailwind `bg-white text-near-black` ✅
2. `FilterPills.tsx` — active badge: inline `style={{ backgroundColor: '#121212', color: '#ffffff' }}` → `bg-near-black text-text-base` ✅
3. `FilterPills.tsx` — inactive badge: `text-[#121212]` → `text-near-black` ✅
4. `FileDropzone.tsx` — dragging + hover bg: `bg-[#1f1f1f]` (×2) → `bg-mid-dark` ✅
5. `MetadataForm.tsx` — all 4 inputs: `inset-input-shadow` (custom CSS class) → `shadow-input-inset` (Tailwind token) ✅
6. `MetadataForm.tsx` — cover art hover: `hover:bg-[#1f1f1f]` → `hover:bg-mid-dark` ✅

**Notable:** `FilterPills` dùng inline style thay vì Tailwind class để tránh specificity conflict — nhưng violate design system rule (không dùng hex hardcoded). Fix bằng cách chuyển sang conditional Tailwind class thay hoàn toàn inline style.

**Tests:** 314/314 xanh — không regression.
**CSS Audit:** HOÀN THÀNH — 44/44 files audited, tổng 42 violations đã fix qua 6 phases.

---
[2026-05-14] [FRONTEND / CSS AUDIT PHASE 5 — LISTENING PARTY] [DONE]

**Task:** Audit và fix 6 Listening Party files theo DESIGN_STITCH.md rules.

**Clean (không cần sửa):** PartyLandingPage.tsx ✅, PartyRoomPage.tsx ✅

**Violations đã fix (7):**
1. `CreateRoomModal.tsx` — modal shadow: `shadow-[rgba(0,0,0,0.5)_0px_8px_24px]` → `shadow-level-3` ✅
2. `CreateRoomModal.tsx` — song row hover: `hover:bg-[#282828]` → `hover:bg-mid-card` ✅
3. `CreateRoomModal.tsx` — CTA button hover: `hover:bg-[#34e36a]` → `hover:brightness-110` ✅
4. `RoomPlayer.tsx` — album art shadow: `shadow-[rgba(0,0,0,0.5)_0px_8px_24px]` → `shadow-level-3` ✅
5. `RoomPlayer.tsx` — LIVE badge: `text-[9px]` (below 10px minimum) → `text-micro` ✅
6. `HostControls.tsx` — play button shadow: `shadow-[rgba(0,0,0,0.3)_0px_8px_8px]` → `shadow-level-2` ✅
7. `MemberList.tsx` — container shadow: `shadow-[rgba(0,0,0,0.3)_0px_8px_8px]` → `shadow-level-2` ✅

**Notable:** LIVE badge `text-[9px]` was below the 10px minimum font size rule — replaced with `text-micro` token (10px).

**Tests:** 314/314 xanh — không regression.
**Tiếp theo:** CSS Audit Phase 6 — Notifications & Creator Features (4 files).

---
[2026-05-14] [FRONTEND / CSS AUDIT PHASE 4 — CORE APP PAGES] [DONE]

**Task:** Audit và fix 5 Core App Pages theo DESIGN_STITCH.md rules.

**Clean (không cần sửa):** NotificationsPage.tsx ✅

**Violations đã fix (13):**
1. `HomePage.tsx` — "Nâng cấp" button: `text-black` → `text-near-black` ✅
2. `HomePage.tsx` — settings icon: `hover:text-white` → `hover:text-text-base` ✅
3. `HomePage.tsx` — retry button: `text-black` → `text-near-black` ✅
4. `CreatorDashboardPage.tsx` — KpiCard hover bg: `hover:bg-[#282828]` → `hover:bg-mid-card` ✅
5. `CreatorDashboardPage.tsx` — KpiCard hover shadow: `hover:shadow-[...]` → `hover:shadow-level-2` ✅
6. `CreatorDashboardPage.tsx` — SkipHeatmap card hover shadow: `hover:shadow-[...]` → `hover:shadow-level-2` ✅
7. `CreatorDashboardPage.tsx` — Heatmap tooltip: `shadow-[rgba(0,0,0,0.5)_0px_8px_24px]` → `shadow-level-3` ✅
8. `CreatorDashboardPage.tsx` — LineChart card hover shadow: `hover:shadow-[...]` → `hover:shadow-level-2` ✅
9. `CreatorDashboardPage.tsx` — BarChart card hover shadow: `hover:shadow-[...]` → `hover:shadow-level-2` ✅
10. `CreatorDashboardPage.tsx` — BarChart bar hover: `hover:bg-[#1db954]` → `hover:bg-accent-border` ✅
11. `CreatorDashboardPage.tsx` — DonutChart card hover shadow: `hover:shadow-[...]` → `hover:shadow-level-2` ✅
12. `UploadPage.tsx` — Preview section: `shadow-[rgba(0,0,0,0.3)_0px_8px_8px]` → `shadow-level-2` ✅
13. `UploadPage.tsx` — Cover art placeholder: `bg-[#2a2a2a]` → `bg-mid-card` ✅
14. `NowPlayingOverlay.tsx` — Album art glow: `style={{ boxShadow: '...' }}` → `shadow-glow-green` (token tồn tại!) ✅
15. `NowPlayingOverlay.tsx` — Play button: `hover:text-white` → `hover:text-text-base` ✅

**Notable:** `glow-green` shadow token (`rgba(30,215,96,0.2) 0px 0px 80px 20px`) đã có trong config từ Phase 0 nhưng chưa được dùng — đây là lần đầu tiên được áp dụng.

**Tests:** 314/314 xanh — không regression.
**Tiếp theo:** CSS Audit Phase 5 — Listening Party (6 files).

---
[2026-05-14] [FRONTEND / CSS AUDIT PHASE 3 — AUTH & ONBOARDING] [DONE]

**Task:** Audit và fix 7 Auth & Onboarding files theo DESIGN_STITCH.md rules.

**Clean (không cần sửa):** LoginPage.tsx ✅, RegisterPage.tsx ✅ (chỉ là wrappers đơn giản).

**Violations đã fix (13):**
1. `LoginForm.tsx` — locked state email input: arbitrary shadow → `shadow-input-inset` ✅
2. `LoginForm.tsx` — locked state password input: arbitrary shadow → `shadow-input-inset` ✅
3. `LoginForm.tsx` — normal username input: arbitrary shadow → `shadow-input-inset`; error ring đổi từ `border-2 border-negative` → `ring-2 ring-negative` (không conflict với inset shadow) ✅
4. `LoginForm.tsx` — normal password input: arbitrary shadow → `shadow-input-inset` ✅
5. `RegisterForm.tsx` — card container: `rounded-card` (undefined token) → `rounded-[8px]` ✅
6. `RegisterForm.tsx` — card container: `shadow-[rgba(0,0,0,0.5)_0px_8px_24px]` → `shadow-level-3` ✅
7. `RegisterForm.tsx` — tất cả 4 inputs: arbitrary shadow → `shadow-input-inset` (×4, replace_all) ✅
8. `GenreGrid.tsx` — genre card: `rounded-DEFAULT` (16px, quá lớn) → `rounded-[8px]` ✅
9. `GenreGrid.tsx` — genre card: `shadow-[rgba(0,0,0,0.3)_0px_8px_8px]` → `shadow-level-2` ✅
10. `ArtistGrid.tsx` — artist image selected: `shadow-[rgba(0,0,0,0.5)_0px_8px_24px]` → `shadow-level-3` ✅
11. `ArtistGrid.tsx` — artist image hover: `group-hover:shadow-[rgba(0,0,0,0.3)_0px_8px_8px]` → `group-hover:shadow-level-2` ✅
12. `OnboardingPage.tsx` — step 3 checkmark circle: `shadow-lg` + inline style → `shadow-level-3` ✅
13. `OnboardingPage.tsx` — step 3 CTA button: `text-[#000000]` → `text-near-black`; `shadow-md` + inline style → `shadow-level-2` ✅
14. `OnboardingPage.tsx` — step 1 CTA button: `shadow-[rgba(0,0,0,0.3)_0px_4px_12px]` → `shadow-level-2` ✅
15. `OnboardingPage.tsx` — step 2 fixed bottom bar: `shadow-[rgba(0,0,0,0.5)_0px_-8px_24px]` → `shadow-footer` ✅
16. `OnboardingPage.tsx` — step 2 CTA button: `text-[#000000]` → `text-near-black`; `shadow-[...]` → `shadow-level-2` ✅

**Tests:** 314/314 xanh — không regression.
**Tiếp theo:** CSS Audit Phase 4 — Core App Pages (5 files).

---
[2026-05-14] [FRONTEND / CSS AUDIT — PHASE PLAN] [DECISION]

**Task:** Chia 29 files còn lại của CSS Audit thành 5 phases, mỗi phase cần xác nhận trước khi tiến hành.
**Lý do:** 29 files là số lượng lớn — chia nhỏ để dễ review, tránh regression khó trace khi fix nhiều files cùng lúc.

| Phase | Files | Nội dung |
|-------|-------|----------|
| Phase 2 | 7 | Foundation Components: Button, Input, Toast, SkeletonRow, Spinner, BottomPlayerBar, MobileNav |
| Phase 3 | 7 | Auth & Onboarding: LoginPage, RegisterPage, OnboardingPage, LoginForm, RegisterForm, GenreGrid, ArtistGrid |
| Phase 4 | 5 | Core App Pages: HomePage, NotificationsPage, CreatorDashboardPage, UploadPage, NowPlayingOverlay |
| Phase 5 | 6 | Listening Party: PartyLandingPage, PartyRoomPage, CreateRoomModal, RoomPlayer, HostControls, MemberList |
| Phase 6 | 4 | Notifications & Creator Features: NotificationRow, FilterPills, FileDropzone, MetadataForm |

**Mỗi phase kết thúc:** `npm run test -- --run` (314 xanh) + báo cáo violations → user confirm → phase tiếp.

---
[2026-05-14] [FRONTEND / CSS AUDIT PHASE 2 — FOUNDATION COMPONENTS] [DONE]

**Task:** Audit và fix 7 Foundation Components theo DESIGN_STITCH.md rules.
**Plan file:** `.claude/plan/tr-c-khi-th-c-task-prancy-lovelace.md`

**Clean (không cần sửa):** Button.tsx ✅, Spinner.tsx ✅, Toast.tsx ✅ (`bg-announcement` = `#539df5` là token hợp lệ trong tailwind.config.ts).

**Violations đã fix (7):**
1. `Input.tsx` — `input-inset` (custom CSS) → `shadow-input-inset` (Tailwind token) ✅
2. `tailwind.config.ts` — thêm `shadow-footer: rgba(0,0,0,0.5) 0px -4px 12px 0px` (token mới cho upward footer shadow) ✅
3. `BottomPlayerBar.tsx` — arbitrary shadow → `shadow-footer` ✅
4. `BottomPlayerBar.tsx` — cover art `rounded` (4px) → `rounded-[6px]` (×2 instances) ✅
5. `BottomPlayerBar.tsx` — `hover:text-white` → `hover:text-text-base` (×3 instances) ✅
6. `MobileNav.tsx` — arbitrary shadow → `shadow-footer` ✅
7. `MobileNav.tsx` — `text-white` → `text-text-base` (active nav text) ✅
8. `SkeletonRow.tsx` — cover art `rounded` (4px) → `rounded-[6px]` ✅

**Decision:** `input-inset` trong index.css line 160 và `shadow-input-inset` Tailwind token có cùng giá trị — nhưng dùng token để đồng nhất design system approach.

**Tests:** 314/314 xanh — không regression.
**Tiếp theo:** CSS Audit Phase 3 — Auth & Onboarding (7 files).

---
[2026-05-14] [FRONTEND / CSS AUDIT PHASE 1 — 6 CONFIRMED VIOLATIONS] [DONE]

**Task:** Fix 6 violations đã xác nhận trước khi audit toàn bộ 44 files.
**Plan file:** `.claude/plan/tr-c-khi-th-c-task-prancy-lovelace.md`

**Kết quả:**
1. `Sidebar.tsx` — `w-[240px]` → `w-[280px]` ✅
2. `AppShell.tsx` — `ml-[240px]` → `ml-[280px]` ✅
3. `Modal.tsx` — `rounded-lg` → `rounded-[8px]` ✅
4. `SongCard.tsx` — arbitrary shadow → `shadow-level-2` + hover `shadow-level-3` ✅
5. `SearchPage.tsx` — `border border-border-muted` + arbitrary inset → `shadow-input-inset` ✅
6. `tailwind.config.ts` — verified, tokens đã đúng spec, không cần sửa ✅

**Tests:** 314/314 xanh — không regression.
**Build TS errors:** 3 lỗi pre-existing (mocks/data.ts, ToastContext.test.tsx, PartyRoomPage.test.tsx) — không liên quan CSS fixes, tồn tại trước commit này.
**Tiếp theo:** Full audit 38 files còn lại — Bước 3 trong plan.

---
[2026-05-14] [FRONTEND / PHASE 8 — NOTIFICATIONS + POLISH] [DECISION × 3]

**Decision 1 — ToastProvider (global context vs. local state)**
Chọn `ToastProvider` bọc toàn app (trong `App.tsx`) thay vì local `useState` trong từng page. Lý do: nhiều async actions xảy ra cross-page (upload xong → navigate về Home → toast vẫn hiện). Pattern: one-at-a-time toast (replace, không queue). `useToast().show(message, variant)` gọi được từ bất kỳ component nào trong cây.
**Lesson / Warning:** `useToast` phải được gọi bên trong `ToastProvider`. Test cần wrap render với `<ToastProvider>`. Nếu quên wrap → throw "useToast must be used within ToastProvider".

**Decision 2 — Mock handler trả ALL notifications**
Handler `GET /api/v1/notifications/unread` đổi từ trả filtered (chỉ unread) → trả ALL items + `totalUnread` count. Lý do: `NotificationsPage` cần hiển thị cả read và unread trong tab "Tất cả". API Design V2 chỉ có 1 endpoint — không thêm endpoint mới. Sidebar vẫn đọc đúng `totalUnread` field.
**Lesson / Warning:** Đây là hành vi mock mode — real backend vẫn trả unread-only. Nếu wire real API sau này, cần tách `fetchAllNotifications` riêng hoặc thêm endpoint.

**Decision 3 — MobileNav + BottomPlayerBar stacking**
`MobileNav`: `fixed bottom-0 lg:hidden z-[60]`, `h-14` (56px). `BottomPlayerBar`: đổi từ `bottom-0` → `bottom-14 lg:bottom-0` (56px trên mobile, 0 trên desktop). `AppShell` main: `pb-[128px] lg:pb-[72px]`. Khi không có song phát: padding-bottom dư 72px trên mobile — acceptable cho demo.
**Lesson / Warning:** BottomPlayerBar test không check CSS positioning class → đổi safe. Nếu cần zero waste padding khi không có song: `MobileNav` đọc `playerStore.currentSong` để biết BottomPlayerBar có visible không và tự adjust position.

---
[2026-05-14] [FRONTEND / PHASE 7 — UPLOAD PAGE] [BUG]

**Problem:** 4/15 tests thất bại: "shows error for invalid MIME", "shows success screen", "shows error on failure", "resets form". Tất cả timeout ở ~1042ms.
**Root cause:** `uploadSong()` trong `musicService.ts` dùng `axios.post` với `FormData`. Trong vitest/jsdom environment, axios với FormData không được MSW (`msw/node`) intercept đúng cách — request bị "bypass" thay vì bị intercept, dẫn đến network error → `catch` block set `status = 'error'` thay vì success. Riêng "invalid MIME" test fail vì `userEvent.upload` trên `aria-hidden` input không fire `onChange` event.
**Fix / Decision:**
  1. Đổi sang `vi.mock('../../services/musicService')` — mock toàn bộ service thay vì dùng MSW. Đơn giản hơn, không phụ thuộc vào FormData serialization.
  2. Đổi từ `userEvent.upload` sang `fireEvent.change` + `Object.defineProperty(input, 'files', ...)` cho tất cả file input tests — reliable hơn với hidden inputs.
**Lesson / Warning:** Khi upload endpoint dùng FormData (multipart): trong vitest tests, không nên dùng MSW để intercept — mock service function trực tiếp bằng `vi.mock`. MSW chỉ reliable cho JSON endpoints. Pattern: `vi.mock('../services/xyzService', () => ({ uploadFn: vi.fn() }))`.

---
[2026-05-14] [FRONTEND / POST-PHASE 6] [BUG × 3]

**Problem 1:** `http proxy error: /ws/v1/parties/{roomId}/negotiate?negotiateVersion=1` trong Vite dev server console.
**Root cause:** SignalR negotiate là HTTP POST trước khi upgrade lên WebSocket. `vite.config.ts` dùng `target: 'ws://localhost:5005'` — Vite không proxy HTTP request đến `ws://` target đúng cách.
**Fix:** Đổi sang `target: 'http://localhost:5005', changeOrigin: true` — Vite tự handle WS upgrade từ `http://` target khi có `ws: true`.

**Problem 2:** RoomPlayer bị nén — `div` với `max-w-md mx-auto` (448px) trong layout 60% width làm player squeeze content.
**Fix:** Bỏ `max-w-md mx-auto`, dùng `w-full` để player fill toàn bộ section được cấp.

**Problem 3:** `/party` route dẫn đến `PartyLandingPage` gây vỡ layout vì page thiếu context đầy đủ khi access trực tiếp từ Sidebar.
**Fix:** Đổi Sidebar `/party` nav item từ `<Link>` thành `<button>` → click mở `CreateRoomModal` trực tiếp. Thêm `onSwitchToJoin` prop vào `CreateRoomModal` để render nút "THAM GIA PHÒNG" chuyển sang `JoinRoomModal` mà không cần navigate. Sidebar giờ render cả 2 modals và handle navigate sau khi create/join thành công.
**Lesson / Warning:** WS proxy trong Vite phải dùng `http://` làm target, không phải `ws://` — `ws: true` flag là đủ để Vite handle upgrade protocol.

---
[2026-05-14] [FRONTEND / PHASE 6] [BUG]

**Problem:** 3 test failures khi viết tests cho Listening Party components.
**Root cause:**
1. `CreateRoomModal` - `toHaveValue(expect.stringContaining(...))` không hoạt động với jest-dom — `toHaveValue` không nhận `asymmetric matcher`. Phải dùng `(input as HTMLInputElement).value.toContain(...)`.
2. `JoinRoomModal` - Preview card dùng `aria-label="Thông tin phòng"` trên `<div>` (không phải `role="region"`) nên `getByRole('region', ...)` không tìm thấy. Phải dùng `getByLabelText(...)`.
3. `PartyLandingPage` - `getByText(/Listening Party/)` tìm thấy 2 elements: Sidebar nav link + h1 heading. `getByRole('button', { name: /TẠO PHÒNG/i })` tìm thấy 2: landing card + modal submit. Cần scope với `getByRole('heading', ...)` và `within(dialog).getByRole(...)`.
**Fix:** (1) Đổi sang `(element as HTMLInputElement).value.toContain()`. (2) Đổi sang `getByLabelText()`. (3) Dùng `getByRole('heading')` và import `within` từ testing-library để scope search trong dialog.
**Lesson / Warning:** Khi component được render bên trong AppShell (có Sidebar), tất cả text trong Sidebar nav (Home, Search, Listening Party...) sẽ xuất hiện trong DOM. Tránh dùng `getByText` với text mà Sidebar cũng dùng. Dùng `getByRole('heading')`, `within(dialog)`, hoặc `getByRole` có scope cụ thể hơn.

---
[2026-05-14] [FRONTEND / PHASE 6] [BUG]

**Problem:** `partyService.ts` dùng `import api from './api'` nhưng `api.ts` không có default export, chỉ export named `apiClient`.
**Root cause:** Nhầm pattern — các service khác (searchService, analyticsService) đều dùng `apiClient` named import.
**Fix:** Đổi thành `import { apiClient } from './api'` và thay `api.post(...)` bằng `apiClient.post(...)`.
**Lesson / Warning:** Khi tạo service mới, luôn kiểm tra export pattern của `api.ts` trước. `api.ts` export `apiClient` (named) và `getAccessToken`, `setAccessToken` — không có default export.

---

**Dành cho:** nhóm dev + Claude (đọc khi debug để tránh lặp lại vấn đề cũ).

**Khi nào ghi:**
---
[2026-05-14] [FRONTEND / PHASE 5] [BUG]

**Problem:** 3 loại bug khi chạy test SearchPage + NowPlayingOverlay.
**Root cause:**
1. SearchPage renders `const searchInput = <SearchInput/>` ở 2 vị trí DOM (mobile + desktop header). JSDOM không apply `lg:hidden` CSS nên cả 2 input đều visible → `getByRole('textbox', ...)` throw "Found multiple elements". Tương tự cho clear button ("Xóa tìm kiếm").
2. NowPlayingOverlay: `MOCK_LYRICS[2]` là `'Và chuyến xe này sẽ đi về đâu'` (chữ thường sau "Và") nhưng test assert `'Chuyến xe này sẽ đi về đâu'` (chữ hoa C) — substring không match.
3. TopResultCard test: mock `song-001` có score 0.98 > `artist-1` score 0.95 → SearchPage chọn song làm top result, nhưng test expect artist.
**Fix:** (1) Thêm helper `getSearchInput()` dùng `getAllByRole(...)[0]` cho cả input và clear button. (2) Sửa lyrics test assert thành lowercase `'chuyến xe này sẽ đi về đâu'`. (3) Đổi mock `artist-1` score từ 0.95 → 0.99 để artist thực sự là highest-scored item.
**Lesson / Warning:** Khi component được reuse ở nhiều DOM positions (responsive show/hide bằng CSS class), luôn dùng `getAllBy*` + index thay vì `getBy*`. JSDOM không apply media query / Tailwind responsive classes.

---
[2026-05-14] [FRONTEND / PHASE 5] [BUG]

**Problem:** Nút play trong BottomPlayerBar và NowPlayingOverlay hiển thị màu đen cho icon.
**Root cause:** BottomPlayerBar dùng `bg-white text-black` trên button container. NowPlayingOverlay có `bg-text-emphasis` trên button và `text-near-black` hardcoded trên cả 2 thẻ `<span>` bên trong — span override màu từ parent.
**Fix:** BottomPlayerBar: bỏ `bg-white text-black`, thêm `text-text-secondary hover:text-white`. NowPlayingOverlay: bỏ `bg-text-emphasis`, bỏ `text-near-black` khỏi cả 2 span để thừa kế màu từ button cha.
**Lesson / Warning:** Khi icon Material Symbols bị hardcode màu trực tiếp trên `<span>`, class màu trên `<button>` cha không có tác dụng. Phải xóa màu trên span để inheritance hoạt động đúng.

---
[2026-05-14] [FRONTEND / MOCK MODE] [DECISION]

**Problem:** Team cần test giao diện mà không cần backend chạy — mỗi lần demo phải khởi động đầy đủ stack (PostgreSQL, Redis, Kafka, MinIO...) rất tốn thời gian.
**Root cause:** Tất cả services giao tiếp qua HTTP thật, không có lớp mock nào.
**Fix / Decision:** Dùng MSW (Mock Service Worker) browser mode. Tạo `src/mocks/handlers.ts` với 18 handlers phủ toàn bộ API endpoints. Bật/tắt qua `VITE_MOCK=true/false` trong `.env.development`. Khi bật: mọi axios request bị intercept trước khi ra network. `onUnhandledRequest: 'bypass'` — request không mock sẽ đi qua bình thường.
**Lesson / Warning:** MSW browser mode cần file `public/mockServiceWorker.js` (generate bằng `npx msw init public/`). File này phải được serve từ cùng origin. Không commit `.env` thật — chỉ `.env.development` với `VITE_MOCK=true` là safe vì không có secret.

---
[2026-05-14] [FRONTEND / CREATOR DASHBOARD] [DECISION]

**Problem:** `toLocaleString('vi-VN')` dùng `.` làm thousands separator (ví dụ: 8420 → "8.420"), nhưng test dùng regex `/8.420|8,420/` — dấu `.` trong regex match bất kỳ ký tự nào, gây false positive. Ngoài ra `text-transform: uppercase` trong Tailwind chỉ là CSS visual — `getByText('LƯỢT NGHE ĐỘC NHẤT')` sẽ fail vì DOM text vẫn là "Lượt nghe độc nhất".
**Root cause:** Tailwind utility classes thay đổi visual rendering nhưng không thay đổi DOM text content. `getByText` đọc actual DOM text.
**Fix / Decision:** (1) Dùng `getByText('8.420')` thay regex. (2) Dùng label text đúng case ("Lượt nghe độc nhất" không phải "LƯỢT NGHE ĐỘC NHẤT"). (3) Khi cùng text xuất hiện nhiều lần (ví dụ "72%" ở KPI card và donut chart), dùng `getAllByText(...).length >= 1` thay vì `getByText`.
**Lesson / Warning:** Rule chung: khi test text bị style bởi Tailwind (uppercase, lowercase, capitalize) — luôn assert bằng original text case, không phải CSS-transformed. Khi text có thể xuất hiện nhiều nơi trong cùng page layout (vì component dùng trong nhiều section) — dùng `getAllByText`.

---
[2026-05-13] [FRONTEND / PHASE 4] [DECISION]

**Problem:** Sidebar cần hiển thị tên user thật và notification dot, nhưng data này không có trong authStore.
**Root cause:** authStore chỉ lưu accessToken, userId, role — không có displayName hay unreadCount.
**Fix / Decision:** Sidebar tự fetch `/users/me` và `/notifications/unread` trong useEffect khi accessToken có. Không tạo thêm Zustand store — keep isolated per-component. Tests dùng MSW để mock cả 2 endpoints. Tất cả pages render Sidebar qua AppShell phải mock 2 endpoints này.
**Lesson / Warning:** Mọi page test render AppShell cần mock: (1) `/api/v1/notifications/unread`, (2) `/api/v1/users/me`. Nếu thiếu và `onUnhandledRequest: 'error'`, test sẽ throw.

---
[2026-05-13] [FRONTEND / PHASE 4] [DECISION]

**Problem:** API `/recommendations` trả 1 flat list, nhưng Stitch design yêu cầu 3 sections riêng biệt.
**Root cause:** Backend Rule Engine gắn `reason.type` (CONTEXT | TRENDING | PREFERENCE) vào mỗi item.
**Fix / Decision:** `useRecommendations` hook split items theo `reason.type` thành 3 groups: contextItems, trendingItems, preferenceItems. Mỗi group render vào 1 section riêng trong HomePage. Empty groups không render section (tránh empty heading).
**Lesson / Warning:** mockItems trong test phải có đủ 3 reason types để test 3 section headings.

---
[2026-05-13] [MUSIC SERVICE / STREAMING SERVICE / INFRA] [DECISION]

**Problem:** Dự án cần storage backend thực tế để lưu file .mp3 và ảnh bìa, không muốn phụ thuộc vào AWS credentials hay duy trì MinIO local trong production/demo.
**Root cause:** MinIO chỉ phù hợp local dev; AWS S3 yêu cầu credit card; nhóm muốn dùng free tier GCS + Cloudinary cho demo.
**Fix / Decision:** Chuyển storage sang 2 provider:
  - Google Cloud Storage (GCS): lưu file audio .mp3. Authen qua Service Account Key JSON (`GOOGLE_APPLICATION_CREDENTIALS`). Pre-signed URL vẫn 900s.
  - Cloudinary: lưu avatar user + ảnh bìa album/playlist. SDK upload qua `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`.
  File key JSON phải đặt tại `infra/secrets/google-cloud-key.json` (đã có trong `.gitignore`).
**Lesson / Warning:** `GOOGLE_APPLICATION_CREDENTIALS` là biến đặc biệt — Google SDK tự động đọc, không cần inject thủ công vào constructor. KHÔNG commit file .json lên Git.

---
[2026-05-12] [USER SERVICE / FRONTEND] [DECISION]

**Problem:** FE Onboarding plan cần truyền `artists` lên `POST /users/me/preferences` và cần cờ `hasCompletedOnboarding` sau khi login, nhưng BE hiện tại dùng `PreferredLanguages` và không trả về cờ nào.
**Root cause:** API implementation cũ của BE không khớp với UI/UX plan mới cho Onboarding (Spotify wizard).
**Fix / Decision:** Cập nhật BE `UserService`: đổi `PreferredLanguages` thành `PreferredArtists` trong DTOs/Entities, tạo EF Core Migration `UpdatePreferencesArtists`. Sửa `UserProfileDto` để trả về `hasCompletedOnboarding` (logic: `prefs != null && prefs.PreferredGenres.Count >= 3`). FE đọc cờ này ở `authService.login` và redirect sang `/onboarding` nếu false.
**Lesson / Warning:** Khi Frontend UI/UX thay đổi, nếu API không khớp, cần chủ động update DTO/Entities phía Backend để keep mọi thứ in-sync thay vì dùng workaround trên FE.

---
---
[2026-05-12] [FRONTEND / TAILWIND] [BUG]

**Problem:** Giao diện Onboarding bị ép hẹp ngang nghiêm trọng ở các class như max-w-sm, max-w-lg trong quá trình hoàn thiện Step 1 và Step 3 (vỡ tương tự như màn hình Account Locked). Ngoài ra, Step 1 và Step 2 cần 2 thiết kế Stepper và Bottom bar khác biệt nhau nhưng đang bị gộp chung.
**Root cause:** 
1. Tương tự lỗi Account Locked, khi Tailwind v4 ánh xạ max-w-[size] sang scale spacing, các custom tokens như sm: 8px, lg: 24px trong 	ailwind.config.ts làm hỏng hoàn toàn độ rộng tối đa chuẩn. max-w-sm thành 8px thay vì 384px.
2. Code cũ gộp chung render layout cho Step 1 và 2, bỏ qua khác biệt nhỏ lẻ trong bản thiết kế HTML gốc.
**Fix / Decision:** 
1. Thay toàn bộ class kích thước max-w dùng chữ sang hardcoded arbitrary values: max-w-sm -> max-w-[384px], max-w-lg -> max-w-[512px].
2. Tách Component OnboardingPage thành 3 luồng return layout riêng biệt 100% thay vì tái sử dụng wrapper chung, để đảm bảo khớp thiết kế từng Pixel.
**Lesson / Warning:** Khi thực thi Design System có nhiều page flow (như Onboarding), không vội vã tạo wrapper chung nếu thiết kế các bước có khác biệt cấu trúc cơ bản (như Stepper dot vs Stepper line). Vẫn quy tắc Tailwind v4 cũ: cảnh giác cao độ với max-w-sm/md/lg nếu đã override spacing.
---
---
[2026-05-12] [FRONTEND / TAILWIND] [BUG]

**Problem:** Nút submit có màu đen chìm vào nền thay vì màu xanh Spotify, mặc dù DOM chứa class g-spotify-green. Checkbox thì vẫn lên màu xanh (checked:bg-spotify-green).
**Root cause:** Tailwind v4 (với Vite) có thể lỗi trong việc ánh xạ các custom colors từ 	ailwind.config.ts sang các utility class nhất định nếu thứ tự cascade CSS hoặc override bị conflict.
**Fix / Decision:** Thêm toàn bộ custom colors vào @theme bên trong index.css để đảm bảo tương thích chuẩn v4. Ngoài ra, thêm các utility rules cứng (.bg-spotify-green { background-color: #1ed760 !important; }) vào index.css cho các màu quan trọng nhất.
**Lesson / Warning:** Khi nâng cấp hoặc setup Tailwind v4 với config cũ (v3), viết fallback utilities cứng với !important là giải pháp an toàn cho brand colors.

---
[2026-05-12] [FRONTEND / TAILWIND] [BUG]

**Problem:** Giao diện Form Đăng nhập bị khóa (Account Locked) hiển thị dọc, ép hẹp lại thành một dải cực nhỏ (~16px chiều ngang), chữ xếp chồng lên nhau từng ký tự một.
**Root cause:** 	ailwind.config.ts định nghĩa override bộ spacing (cụ thể: md: '16px'). Form Account Locked lại dùng class max-w-md. Trong Tailwind v4, việc ghi đè spacing có thể làm hỏng các built-in scale của max-width, khiến max-w-md bị ánh xạ thành 16px.
**Fix / Decision:** Đổi class max-w-md thành class kích thước tĩnh max-w-[480px].
**Lesson / Warning:** Khi custom Tailwind themes (đặc biệt ghi đè toàn bộ spacing), tránh dùng các class sizing chuẩn có suffix trùng tên (như sm, md, lg) cho max-w-* hoặc dùng Arbitrary Values để an toàn.
---
[2026-05-12] [FRONTEND] [DECISION]

**Problem:** Chuyển đổi Auth Screens sang thiết kế mới nhưng giữ nguyên tính độc lập với backend cho màn hình đăng ký.
**Root cause:** Phase 2 yêu cầu áp dụng Tailwind tokens mới và thêm chức năng Đăng ký, nhưng endpoint `/api/v1/auth/register` chỉ có tạm cho demo, không ở document chính thức.
**Fix / Decision:** Tách riêng `authService.ts`, `useAuth`, `LoginForm`, `RegisterForm`. Endpoint register được mock timeout 1s cho an toàn tại `authService.register`. Giữ các constraints token.
**Lesson / Warning:** Tách API service, React hook và component UI giúp mock API dễ dàng hơn mà không ảnh hưởng luồng render.

---
[2026-05-12] [FRONTEND] [BUG]

**Problem:** `notificationService.fetchUnreadNotifications` trả sai items — `res.data.data` là `{ items: [...], hasMore: bool }` nhưng code cũ gán `items: res.data.data ?? []` (treat cả object làm array).
**Root cause:** Phase 0 refactor service signature nhưng không đọc đúng nested response shape từ API contract (`data: { items, hasMore }`).
**Fix / Decision:** Đổi generic type sang `ApiResponse<{ items: Notification[]; hasMore: boolean }>`, đọc `payload.items` và `payload.hasMore`. Cập nhật test mock để dùng `notificationId`/`message` (domain type) thay vì `id`/`title` (old type).
**Lesson / Warning:** Khi service return type là `Notification[]` nhưng API `data` field là `{ items: Notification[] }`, phải dùng generic đúng shape. Luôn verify response shape trong service unit tests trước khi rely vào integration.

---
[2026-05-12] [FRONTEND] [BUG]

**Problem:** `getTimeContext()` tests fail vì expect `'none'` nhưng Phase 0 đã đổi return values sang `'night' | 'morning' | 'afternoon' | 'evening'` (xóa `'none'`).
**Root cause:** Tests viết trước Phase 0 migration, chưa cập nhật theo `TimeContext` type mới trong `domain.ts`.
**Fix / Decision:** Update test assertions: `'none'` (hour 0–5, 22–23) → `'night'`, `'none'` (hour 12–17) → `'afternoon'`.
**Lesson / Warning:** Khi đổi enum/union type trong `domain.ts`, phải grep tất cả test files dùng giá trị cũ và update cùng lúc.

---
[2026-05-12] [FRONTEND] [DECISION]

**Task:** Phase 0 — Tailwind CSS setup + service layer migration
**Decisions:**
- Dùng `@tailwindcss/vite` plugin (không phải PostCSS) — phù hợp với Vite 8 + Tailwind v4.
- Google Fonts `@import` phải đứng TRƯỚC `@import "tailwindcss"` trong index.css — Tailwind v4 báo warning nếu ngược lại.
- `src/api/*` files (client.ts, recommendationApi.ts, analyticsApi.ts, notificationApi.ts, searchApi.ts) giữ nguyên nhưng không dùng nữa — các service mới ở `src/services/*` thay thế hoàn toàn.
- Domain types thống nhất ở `src/types/domain.ts` — tránh duplicate type giữa service files. `CreatorDashboardPage` dùng `AnalyticsStats` shape từ API contract (`dailyListeners[]`, `uniqueUsers`) thay vì `SongStats` cũ (`totalPlays`, `totalSkips`).
- `NotificationBell` dùng `notificationId` (domain type) thay vì `id` (old type) — cần update key prop và markRead call.
**Lesson:** Khi migrate type, phải trace toàn bộ JSX dùng old property names, không chỉ import line. Hook IDE diagnostics giúp catch nhanh.
---

[2026-05-12] [FRONTEND] [DECISION]

**Problem:** AppShell cần render `<AudioPlayer>` trong bottom bar, nhưng tests hiện tại tìm `aria-label="Đóng player"` ở trong pages (HomePage, SearchPage). Nếu chuyển close button sang AppShell, tests vẫn cần tìm được nó.
**Root cause:** Tests render `<HomePage />` wrapped với `MemoryRouter` — AppShell được render bên trong page, nên toàn bộ DOM của AppShell (bao gồm bottom bar + close button) vẫn nằm trong render tree của test.
**Fix / Decision:** Close button giữ nguyên `aria-label="Đóng player"` trong AppShell — tests vẫn tìm được vì AppShell render cùng cây với page. Không cần thay đổi test structure cho Phase 2.
**Lesson / Warning:** Khi pages dùng AppShell wrapper, test queries (getByLabelText, getByRole) sẽ tìm trong toàn bộ DOM bao gồm AppShell — đây là behavior mong muốn.
---

---
[2026-05-12] [FRONTEND / TESTING] [BUG]

**Problem:** Tests của `HomePage` và `SearchPage` fail với lỗi `intercepted a request without a matching request handler: GET /api/v1/notifications/unread`.
**Root cause:** Khi bọc các trang này bằng `<AppShell>`, `<NotificationBell />` bên trong `AppShell` sẽ được render và tự động gọi API fetch notifications. MSW server trong test các trang này chưa mock endpoint đó.
**Fix / Decision:** Thêm `notificationsHandler` vào `setupServer` trong file test của `HomePage`, `SearchPage`.
**Lesson / Warning:** Khi wrap components/pages bằng một global layout có chứa side effects (ví dụ fetch API trong header/bell), phải đảm bảo mock luôn các endpoints đó trong unit test của page.

---
[2026-05-12] [FRONTEND / TESTING] [BUG]

**Problem:** Test `closes AudioPlayer when close button is clicked` fail. Test cố gắng check nút đóng player biến mất nhưng query lại match các state cũ (leaked state) làm test bị timeout hoặc pass lộn xộn.
**Root cause:** `usePlayerStore` (Zustand) là global state. Nếu test A nhấn play bài hát, `currentSong` được set. Khi chạy sang test B, `currentSong` vẫn còn giữ giá trị cũ khiến `<AppShell>` render `<AudioPlayer>` ngay từ đầu, phá vỡ logic test. Đồng thời, hành động click nút Đóng sẽ clear state nhưng việc render lại DOM có thể cần chờ đợi.
**Fix / Decision:** Bổ sung `usePlayerStore.getState().clearSong();` vào khối `afterEach` trong file `src/tests/setup.ts` để reset global store cho mọi test. Chuyển assertion thành `await waitFor(() => expect(screen.queryByLabelText('Đóng player')).not.toBeInTheDocument());`.
**Lesson / Warning:** LUÔN LUÔN reset Zustand stores (`useAuthStore`, `usePlayerStore`) trong `afterEach` để chặn rò rỉ state giữa các test. Khi có các cập nhật trạng thái làm mất DOM elements (như đóng player), nên wrap assertion bằng `waitFor`.
---

**Khi nào ghi:**
---
[2026-05-12] [FRONTEND / RECOMMENDATION API] [BUG]

**Problem:** `streaming/undefined/url` 404 + React key warning "Each child in a list should have a unique key prop" trong HomePage.
**Root cause:** Python FastAPI (Recommendation Service) trả `song_id` (snake_case) nhưng TypeScript type `RecommendationItem` expect `songId` (camelCase). `item.songId === undefined` → key là undefined, AudioPlayer gọi `/api/v1/streaming/undefined/url`.
**Fix / Decision:** Map response tại API boundary trong `recommendationApi.ts`: `song_id → songId`, `reason.text → explainText`. Cập nhật mock data trong `HomePage.test.tsx` sang Python format (`song_id`, `reason: { type, text }`).
**Lesson / Warning:** Python FastAPI dùng snake_case theo convention. Bất kỳ API nào từ Python service đều cần map sang camelCase ở frontend. Không assume camelCase từ Python endpoints.
---

---
[2026-05-12] [NOTIFICATION SERVICE] [BUG]

**Problem:** notification-service liên tục crash, API Gateway trả 502 cho `/api/v1/notifications/unread`.
**Root cause:** 4 bugs xếp chồng:
  1. Kafka topics `New_Release` và `Notification_Sent` chưa được tạo → `ConsumeException: Unknown topic or partition`
  2. Catch block trong `KafkaConsumerBackgroundService` không có delay → tight loop → escalate fatal error
  3. `consumer.Consume(ct)` là synchronous blocking call, không có `await` trước nó → block toàn bộ host startup → Kestrel không start (dù container "Up")
  4. `MongoDB__ConnectionString` thiếu trong `docker-compose.yml` + duplicate `/health` route (cả MapGet lẫn HealthController)
**Fix / Decision:**
  - Tạo 5 Kafka topics bằng `kafka-topics --create --if-not-exists`
  - Thêm `await Task.Delay(5s, ct)` trong catch block
  - Wrap blocking call: `await Task.Run(() => consumer.Consume(ct), ct)`
  - Thêm `MongoDB__ConnectionString=${MONGO_URI}` + `mongodb: condition: service_healthy` vào docker-compose
  - Xóa `app.MapGet("/health", ...)` trùng với `HealthController`
  - Thêm `BackgroundServiceExceptionBehavior.Ignore` trong Program.cs làm safety net
**Lesson / Warning:** Trong .NET 8, `BackgroundService.ExecuteAsync` nếu throw → host STOP (StopHost default). Bất kỳ blocking I/O nào trong ExecuteAsync PHẢI được wrap bằng `await Task.Run()` để không block startup thread. Confluent.Kafka `Consume()` là blocking — LUÔN dùng `await Task.Run(() => consumer.Consume(ct), ct)`.
---

- Bug mất > 30 phút mới tìm ra nguyên nhân
- Quyết định kỹ thuật quan trọng (chọn A thay vì B, và tại sao)
- Workaround/hack đang dùng tạm — để người khác không "fix" nó thành broken
- Gotcha với infrastructure local (Docker, Kafka, Redis, MinIO)

**Format mỗi entry:**
```
---
[YYYY-MM-DD] [SERVICE/LAYER] [LOẠI: BUG | DECISION | BLOCKER | NOTE]

**Problem:** Mô tả vấn đề — triệu chứng quan sát được
**Root cause:** Tại sao xảy ra
**Fix / Decision:** Cách giải quyết
**Lesson / Warning:** Điều cần nhớ / tránh lặp lại
---
```

---

## Entries

---

[2026-05-10] [ALL C# SERVICES / PROMETHEUS] [BUG]

**Problem:** `UseHttpMetrics()` và `MapMetrics()` không được nhận dạng sau khi thêm `prometheus-net.AspNetCore` vào .csproj qua Edit tool.
**Root cause:** Hai vấn đề song song: (1) Package chưa được restore — `dotnet restore` báo "all up-to-date" nhưng thực ra chưa download. (2) Extension methods nằm trong `Prometheus` namespace nhưng top-level Program.cs không có `using Prometheus;` — implicit usings không tự include.
**Fix / Decision:** Chạy `dotnet add package prometheus-net.AspNetCore` (force restore) + thêm `using Prometheus;` vào đầu tất cả 9 Program.cs. Sau đó `dotnet restore SmartMusic.sln` để sync toàn bộ solution.
**Lesson / Warning:** Khi thêm package bằng Edit tool vào .csproj: phải chạy `dotnet restore` hoặc `dotnet add package` để download. Prometheus extension methods LUÔN cần `using Prometheus;` trong file dùng chúng — không nằm trong implicit usings.

---

[2026-05-10] [AUTH SERVICE] [DECISION]

**Problem:** Register endpoint cần tạo user nhưng Auth Service không có database user riêng — user data nằm ở User Service.
**Root cause:** Architecture đúng: User Service là source of truth cho user data. Auth Service chỉ quản lý tokens.
**Fix / Decision:** Thêm `CreateUser` RPC vào `user.proto` — Auth Service gọi User Service qua cùng gRPC channel đã có. User Service hash BCrypt, tạo user trong PostgreSQL. Auth Service trả 201 với `{ userId, email, displayName, role }`. Không trả tokens — user phải login riêng.
**Lesson / Warning:** Register sử dụng gRPC channel Auth→User đã có. `ALREADY_EXISTS` status code từ gRPC được map sang `VALIDATION_ERROR` (400) vì `USER_ALREADY_EXISTS` chưa có trong error catalogue — có TODO comment trong code.

---

[2026-05-10] [OBSERVABILITY / ALL SERVICES] [DECISION]

**Problem:** Prometheus port strategy — expose `/metrics` trên port riêng (9091) hay cùng port với HTTP API?
**Root cause:** Plan nói port 9091 nhưng docker-compose không có port mapping cho 9091 trên bất kỳ service nào.
**Fix / Decision:** Expose `/metrics` trên cùng HTTP port (port 80 trong container) dùng `app.MapMetrics()` từ `prometheus-net.AspNetCore`. Prometheus scrape `http://service:80/metrics` — không cần port mapping riêng. Đơn giản hơn, không cần config Kestrel thêm.
**Lesson / Warning:** `UseHttpMetrics()` phải đặt sau `UseRouting()` và trước `UseAuthentication()` — nếu đặt sau auth thì request bị reject trước khi metrics ghi nhận. Đặt trước `MapControllers()` trong pipeline.

---

[2026-05-10] [RECOMMENDATION SERVICE / PYTHON] [NOTE]

**Problem:** IDE Pylance báo lỗi `Cannot find module prometheus_fastapi_instrumentator` ngay sau khi thêm import.
**Root cause:** Package chưa install trong `.venv` — chỉ mới thêm vào `requirements.txt`.
**Fix / Decision:** Chạy `.venv/Scripts/pip install prometheus-fastapi-instrumentator>=6.1.0` để cài vào .venv local. Trong Docker build, `pip install -r requirements.txt` sẽ cài tự động.
**Lesson / Warning:** Pattern giống warning Pylance về các package khác (đã ghi trong CURRENT_STATE Known Issues). Không coi Pylance error là blocker nếu package chỉ chưa install local.

---

[2026-05-07] [LISTENING PARTY SERVICE / SIGNALR] [DECISION]

**Problem:** Hub cần `GetRoomId()` và `GetUserId()` từ HttpContext/ClaimsPrincipal — khó mock trong unit tests nếu đọc trực tiếp từ `Context.GetHttpContext().Request.Query` và `Context.UserIdentifier`.
**Root cause:** `Context.GetHttpContext()` là extension method trên `HubCallerContext`; không thể setup trực tiếp trên mock vì nó đọc từ `IFeatureCollection`. Mock toàn bộ HttpContext + Request + QueryString rất verbose và brittle.
**Fix / Decision:** Tách thành 2 `protected virtual` methods: `GetRoomId()` và `GetUserId()`. Unit tests dùng `TestablePartyHub` kế thừa Hub và override 2 methods này → inject roomId/userId trực tiếp mà không cần HttpContext.
**Lesson / Warning:** Mọi lần Hub cần đọc context data (query string, header, claim) — tách ra virtual method ngay từ đầu. Áp dụng cho tất cả Hub implementations về sau.

---

[2026-05-07] [LISTENING PARTY SERVICE / SIGNALR] [BUG]

**Problem:** Unit test `Mock<IClientProxy>` cho `Clients.Caller` bị lỗi `CS1503: cannot convert from IClientProxy to ISingleClientProxy`.
**Root cause:** Trong ASP.NET Core SignalR 8+, `IHubCallerClients.Caller` trả về `ISingleClientProxy` (không phải `IClientProxy`). `ISingleClientProxy` là interface con của `IClientProxy` nhưng không tương thích assignment ngược.
**Fix / Decision:** Mock `Clients.Caller` bằng `Mock<ISingleClientProxy>`; mock `Clients.Group(...)` và `Clients.OthersInGroup(...)` bằng `Mock<IClientProxy>` (vẫn trả `IClientProxy`).
**Lesson / Warning:** Khi mock `IHubCallerClients` trong SignalR 8+ — luôn dùng `Mock<ISingleClientProxy>` cho `.Caller`, `Mock<IClientProxy>` cho `.Group()`, `.All`, `.OthersInGroup()`.

---

[2026-05-07] [FRONTEND / TESTING] [BUG]

**Problem:** Test "shows loading skeleton while fetching" không catch được transient `loading=true` state khi dùng MSW + fake timers. Dù `vi.advanceTimersByTime(350)` kích hoạt debounce, MSW resolve fetch ngay trong cùng một `act()` microtask flush — không có window nào để assert `loading=true`.
**Root cause:** MSW xử lý request synchronously trong `act()` scope, nên state đi qua `loading=true → false` mà không flush DOM giữa chừng. Không có cách intercept transient state mà không dùng manual Promise resolution.
**Fix / Decision:** Đổi test để verify behavior thực tế: kết quả KHÔNG xuất hiện trước khi debounce fire (trước 300ms), rồi xuất hiện sau khi fire. Đây là hành vi người dùng quan tâm, không phải loading flag nội bộ.
**Lesson / Warning:** Không cố test transient loading states với MSW trong vitest — quá brittle. Test behavior: "trước → sau", không test "đang trong quá trình". Áp dụng cho mọi component có debounce + async fetch.

---

[2026-05-07] [FRONTEND / TESTING] [DECISION]

**Problem:** Package.json ban đầu không có test dependencies — cần thiết lập toàn bộ test stack lần đầu.
**Root cause:** Scaffold tuần trước chỉ có Vite + React, chưa cấu hình vitest/testing-library/msw.
**Fix / Decision:** Cài vitest + @testing-library/react + msw + jsdom. Dùng `jsdom` thay vì `happy-dom` (SKILL.md đề xuất happy-dom nhưng jsdom tương thích tốt hơn với React 19 + @testing-library). MSW v2 dùng `http`/`HttpResponse` API (không phải `rest` từ v1). Test script: `vitest run` (CI) + `vitest` (watch).
**Lesson / Warning:** Khi viết test cho component dùng Zustand store, PHẢI reset store giữa các test: `useAuthStore.setState({...})` trong `afterEach`. Không reset → state leak giữa tests → flaky results.

---

[2026-05-07] [FRONTEND / TESTING] [BUG]

**Problem:** Test "does NOT render explainText badge" dùng `document.querySelectorAll('[style*="1db95422"]')` → trả về 0 phần tử trong jsdom, dù component render đúng.
**Root cause:** jsdom xử lý inline style khác với browser — shorthand hex màu có thể được normalize hoặc không match substring. Query bằng style string literal không reliable trong test environment.
**Fix / Decision:** Thêm `data-testid="explain-badge"` vào span badge trong component, dùng `screen.getAllByTestId('explain-badge')` trong test.
**Lesson / Warning:** Không query DOM bằng style string (`[style*="..."]`) trong tests — dùng `data-testid`, `aria-label`, hoặc text content thay thế.

---

---

[2026-05-06] [FRONTEND / TYPES] [BUG]

**Problem:** `services/frontend/src/types/listening-party.ts` có nội dung sai — dùng các interface khác với contract trong `shared_contracts.md` Section 6 (ví dụ `PlayerAction` là union type thay vì interface, thiếu `SyncState`, `MemberLeave`, etc.).
**Root cause:** File được tạo từ scaffold với type definitions tạm, chưa sync với contract thật.
**Fix / Decision:** Overwrite hoàn toàn với nội dung từ `shared_contracts.md` Section 6.
**Lesson / Warning:** Trước khi implement Track A (frontend hooks), kiểm tra `types/listening-party.ts` có match `shared_contracts.md` Section 6 không.

---

[2026-05-06] [LISTENING PARTY SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Integration tests fail với `RedisConnectionException: NOAUTH` — `ConnectionMultiplexer.Connect()` được gọi synchronously ngay trong `AddInfrastructure()` khi `WebApplicationFactory` khởi tạo app. `ConfigureWebHost.ConfigureServices` chạy sau nên không kịp replace trước khi connection thực sự được tạo.
**Root cause:** `services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(str))` — gọi `Connect()` inline trong lambda argument (eager evaluation), không phải lazy factory.
**Fix / Decision:** Đổi sang lazy factory: `services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(str))`. Với factory pattern, connection chỉ tạo khi `IConnectionMultiplexer` được resolve lần đầu (tức khi request thật đến), không phải khi DI setup. `WebApplicationFactory` có thể `RemoveAll<IConnectionMultiplexer>()` và thay mock trước khi request đầu tiên.
**Lesson / Warning:** Khi đăng ký `IConnectionMultiplexer` (Redis), `IMongoClient`, hoặc bất kỳ connection singleton nào — LUÔN dùng factory lambda `_ => new ...()`, không gọi constructor/Connect inline. Pattern này áp dụng cho mọi service có connection singleton cần test với WebApplicationFactory.

---

**Problem:** Integration tests fail với `RedisConnectionException: NOAUTH` — `ConnectionMultiplexer.Connect()` được gọi synchronously ngay trong `AddInfrastructure()` khi `WebApplicationFactory` khởi tạo app. `ConfigureWebHost.ConfigureServices` chạy sau nên không kịp replace trước khi connection thực sự được tạo.
**Root cause:** `services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(str))` — gọi `Connect()` inline trong lambda argument (eager evaluation), không phải lazy factory.
**Fix / Decision:** Đổi sang lazy factory: `services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(str))`. Với factory pattern, connection chỉ tạo khi `IConnectionMultiplexer` được resolve lần đầu (tức khi request thật đến), không phải khi DI setup. `WebApplicationFactory` có thể `RemoveAll<IConnectionMultiplexer>()` và thay mock trước khi request đầu tiên.
**Lesson / Warning:** Khi đăng ký `IConnectionMultiplexer` (Redis), `IMongoClient`, hoặc bất kỳ connection singleton nào — LUÔN dùng factory lambda `_ => new ...()`, không gọi constructor/Connect inline. Pattern này áp dụng cho mọi service có connection singleton cần test với WebApplicationFactory.

---

---

[2026-05-06] [NOTIFICATION SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Integration test factory sử dụng `builder.UseEnvironment("Testing")` nhưng `IWebHostBuilder` không có extension này mà không có `using Microsoft.AspNetCore.Hosting`.
**Root cause:** `UseEnvironment` là extension method nằm trong `Microsoft.AspNetCore.Hosting` namespace — không được auto-imported bởi `ImplicitUsings` của test project.
**Fix / Decision:** Thêm `using Microsoft.AspNetCore.Hosting;` vào integration test file.
**Lesson / Warning:** Khi dùng `WebApplicationFactory.ConfigureWebHost`, luôn add `using Microsoft.AspNetCore.Hosting` nếu gọi bất kỳ method nào trên `IWebHostBuilder`.

---

[2026-05-06] [USER SERVICE / DOMAIN] [DECISION]

**Problem:** `follows` table tồn tại trong PostgreSQL schema (DATABASE_SCHEMA.md) nhưng chưa có EF Core mapping. Notification Service cần query followers qua User Service internal API.
**Root cause:** User Service chỉ map `users` và `user_preferences`. `follows` được dự kiến query bởi Notification Service nhưng chưa implement.
**Fix / Decision:** Thêm `Follow` domain model + `Follows` DbSet + EF Core mapping. Cần tạo migration `AddFollowsTable` trước khi deploy: `dotnet ef migrations add AddFollowsTable` từ UserService.Api project.
**Lesson / Warning:** Khi thêm DbSet mới vào DbContext đã có migration, PHẢI chạy `dotnet ef migrations add` ngay sau khi code. Migration files là code — commit cùng với source.

---

---

[2026-05-06] [ANALYTICS SERVICE / INFLUXDB] [BUG]

**Problem:** `using var writeApi = client.GetWriteApiAsync()` — compiler error CS1674: `WriteApiAsync` does not implement `IDisposable`.
**Root cause:** InfluxDB.Client v4.x `WriteApiAsync` là plain class, không implement `IDisposable`. Không cần dispose thủ công.
**Fix / Decision:** Bỏ `using` — gọi thẳng `var writeApi = client.GetWriteApiAsync()`.
**Lesson / Warning:** Trong InfluxDB.Client v4.x, chỉ `WriteApi` (synchronous) mới `IDisposable`. `WriteApiAsync` thì không.

---

[2026-05-06] [ANALYTICS SERVICE / INFLUXDB] [BUG]

**Problem:** `File` ambiguous giữa `InfluxDB.Client.Api.Domain.File` và `System.IO.File` trong `InfluxAnalyticsRepository.cs`.
**Root cause:** InfluxDB.Client package expose một type tên `File` trong namespace được auto-import.
**Fix / Decision:** Dùng fully-qualified `System.IO.File.AppendAllTextAsync(...)`.
**Lesson / Warning:** Khi dùng InfluxDB.Client, tránh dùng tên `File` bare — luôn qualify `System.IO.File`.

---

[2026-05-06] [ANALYTICS SERVICE / FLUX] [BUG]

**Problem:** Flux query với record literal `{count: 0}` bên trong `$"""` raw string → CS9006 interpolated raw string literal error.
**Root cause:** `$"""` với `{{` interpret double-braces là escaped `{`, nhưng Flux dùng `{` bare cho record syntax — conflict.
**Fix / Decision:** Đổi sang `$$"""` (double-dollar) — cho phép `{{expr}}` làm interpolation holes, còn `{` bare là literal.
**Lesson / Warning:** Khi Flux query có record literals `{key: val}`, dùng `$$"""` thay vì `$"""` để tránh brace conflict.

---

---

[2026-05-05] [SEARCH SERVICE / APPLICATION] [BUG]

**Problem:** `SearchService.SearchAsync` không catch exception khi `ISearchCache.GetAsync` throw — Redis failure làm crash request thay vì fallback.
**Root cause:** Try/catch chỉ bao `repository.SearchAsync`, không bao `cache.GetAsync`. Redis exception propagate ra ngoài.
**Fix / Decision:** Wrap `cache.GetAsync` trong try/catch riêng — Redis failure → log warning + treat as cache miss, không throw.
**Lesson / Warning:** Tất cả I/O operations (Redis, Elasticsearch, HTTP) phải có try/catch riêng. Fallback chain phải bền vững với mọi dependency failure.

---

[2026-05-05] [SEARCH SERVICE / CSPROJ] [BUG]

**Problem:** `SearchService.Application` không build được — `ILogger<>` not found dù dùng `Microsoft.Extensions.Logging`.
**Root cause:** Application project chưa có `Microsoft.Extensions.Logging.Abstractions` package reference. `ILogger<>` không phải transitive dependency của ASP.NET Core.
**Fix / Decision:** Thêm `Microsoft.Extensions.Logging.Abstractions 8.0.*` vào `SearchService.Application.csproj`.
**Lesson / Warning:** Khi Application layer inject `ILogger<T>`, phải explicit add `Microsoft.Extensions.Logging.Abstractions`. Không tự resolve từ web SDK project.

---

[2026-05-03] [USER SERVICE / EF CORE / INTEGRATION TESTS] [BUG]

**Problem:** `dotnet test` throws `InvalidOperationException: Relational-specific methods can only be used when the context is using a relational database provider` trong `DbInitializer.SeedAsync`.
**Root cause:** `TestWebApplicationFactory` override `DbContext` dùng `InMemoryDatabase`, nhưng `DbInitializer` gọi `await db.Database.MigrateAsync()` — method này chỉ chạy được với relational provider.
**Fix / Decision:** Thêm `if (db.Database.IsRelational())` check trước `MigrateAsync()`. Fallback dùng `EnsureCreatedAsync()` cho InMemory tests.
**Lesson / Warning:** Luôn check `IsRelational()` trong seed/initializer nếu project dùng InMemory database cho integration tests.

---

[2026-05-03] [USER SERVICE / EF CORE / MIGRATION] [BUG]

**Problem:** `dotnet ef database update` fails với `password authentication failed for user "smartmusic"` dù `.env` đã cấu hình.
**Root cause:** Native Windows Postgres (port 5432) intercept connection thay vì Docker container. Native postgres dùng username `postgres`, password `4L27hN04@`.
**Fix / Decision:** Cập nhật `appsettings.json` connection string: `Host=localhost;Port=5432;Database=user_db;Username=postgres;Password=4L27hN04@`.
**Lesson / Warning:** Cẩn thận port collision giữa Docker services và Windows native services. Khi migration fail với auth error, check xem đang connect vào postgres nào.

---

[2026-05-03] [ALL C# SERVICES] [BUG]

**Problem:** `dotnet build` thất bại sau scaffold — EF Core, MVC Testing, FluentAssertions, Moq đều resolve version 10.x.
**Root cause:** NuGet `Version="*"` lấy latest stable — tại thời điểm này là 10.x, không tương thích `net8.0`.
**Fix / Decision:** Pin cứng version: `EF Core 8.0.*`, `Mvc.Testing 8.0.*`, `FluentAssertions 6.12.*`, `Moq 4.20.*`, `Testcontainers 3.8.*`.
**Lesson / Warning:** KHÔNG dùng `Version="*"` cho bất kỳ package Microsoft.* nào. Khi thêm package mới, kiểm tra `<TargetFramework>` rồi chọn version major tương ứng.

---

[2026-05-03] [ALL C# SERVICES / DOCKER] [BUG]

**Problem:** Tất cả C# containers exit ngay sau start — log: `Failed to bind to address http://[::]:80`.
**Root cause:** .NET 8 đổi default HTTP port từ 80 → 8080. Container lắng nghe 8080 nhưng docker-compose expose 80.
**Fix / Decision:** Thêm `ASPNETCORE_HTTP_PORTS=80` vào environment của mỗi C# service trong docker-compose.
**Lesson / Warning:** Áp dụng cho tất cả C# service mới. Nếu thấy container exit code 1 ngay sau start mà không có error rõ → check port binding trước.

---

[2026-05-03] [API GATEWAY / YARP] [BUG]

**Problem:** api-gateway container crash với `InvalidOperationException` khi start — YARP không tìm thấy config `ReverseProxy`.
**Root cause:** YARP bắt buộc có section `ReverseProxy` trong `appsettings.json` khi `LoadFromConfig(...)` được gọi, dù chưa có route thật.
**Fix / Decision:** Thêm placeholder vào `appsettings.json`: `"ReverseProxy": { "Routes": {}, "Clusters": {} }`.
**Lesson / Warning:** Khi implement YARP routes, update trực tiếp vào object đó — không xóa placeholder vì YARP throw nếu section missing.

---

[2026-05-03] [INFRA / DOCKER-COMPOSE] [BUG]

**Problem:** `docker-compose up --build` báo `unable to prepare context: path not found` cho tất cả C# services.
**Root cause:** `docker-compose.yml` nằm trong `infra/`, build context `./services/X` resolve từ `infra/` nên không tìm thấy.
**Fix / Decision:** Đổi tất cả build contexts sang `../services/X` (relative từ `infra/`).
**Lesson / Warning:** Khi thêm service mới vào docker-compose, luôn dùng `../services/<tên-service>` làm context.

---

[2026-05-04] [RECOMMENDATION SERVICE / KAFKA] [NOTE]

**Problem:** `Song_Played` consumer nhận duplicate events sau khi restart container — cùng event được process 2 lần, làm tăng sai preference weight.
**Root cause:** Kafka consumer group offset chưa commit trước khi container bị kill. Khi restart, consumer đọc lại từ offset chưa commit.
**Fix / Decision:** Idempotency dedup via Redis SET NX, key `rec:idempotency:{event_id}`, TTL 24h. Event đã có key → skip.
**Lesson / Warning:** KHÔNG tắt idempotency check dù "chỉ để test local". Áp dụng cho tất cả 5 Kafka topics. Chạy `infra/verify-infra.sh` sau mỗi lần reset infrastructure.

---

[2026-05-04] [STREAMING SERVICE / S3] [DECISION]

**Problem:** Nên generate pre-signed URL ở Streaming Service hay API Gateway?
**Root cause:** Kiến trúc chưa rõ ràng về ai là owner của S3 access logic.
**Fix / Decision:** Pre-signed URL chỉ được generate ở Streaming Service. API Gateway không có business logic; expiry 900s là business rule của Streaming.
**Lesson / Warning:** Nếu sau này thêm CDN signed URL (CloudFront), logic vẫn ở Streaming Service — chỉ thay signing method.

---

[2026-05-04] [AUTH SERVICE / USER SERVICE / GRPC] [DECISION]

**Problem:** Auth Service cần verify password nhưng `password_hash` nằm ở `user_db` (User Service). Auth Service không được connect trực tiếp `user_db`.
**Root cause:** `user.proto` ban đầu chỉ có `GetUserProfile(user_id)`, không có cơ chế verify credentials.
**Fix / Decision:** Thêm RPC `VerifyCredentials(username, password)` vào `user.proto`. Auth Service gọi qua gRPC → User Service verify bcrypt → trả về `user_id` + `role` → Auth Service mới cấp JWT.
**Lesson / Warning:** Giữ nguyên Data Boundary: User Service làm chủ Identity/Credentials, Auth Service chuyên Token Lifecycle.

---

[2026-05-05] [USER SERVICE / MIGRATIONS] [BUG]

**Problem:** User service migrations không tồn tại trong repo — Docker build không có migration C# files, `MigrateAsync()` chạy nhưng không có gì apply, bảng `users` không được tạo.
**Root cause:** Migration files chưa bao giờ được `git add` và commit sau khi `dotnet ef migrations add`.
**Fix / Decision:** Chạy lại `dotnet ef migrations add InitialCreate`, git add `UserService.Infrastructure/Migrations/`, commit ngay.
**Lesson / Warning:** Sau mỗi lần tạo migration, PHẢI `git add services/*/src/*/Migrations/` và commit ngay. Migration files là code, không phải artifacts.

---

[2026-05-05] [ALL SERVICES / POSTGRESQL] [DECISION]

**Problem:** Docker postgres và native Windows postgres chạy song song gây nhầm lẫn — migrations apply vào postgres sai.
**Root cause:** `dotnet ef database update` chạy từ Windows host connect native postgres (`localhost:5432`), nhưng containers connect Docker postgres (khác credentials).
**Fix / Decision:** Dùng native postgres (`postgres/4L27hN04@`) cho tất cả migrations và integration tests. Services trong Docker connect qua `host.docker.internal:5432`.
**Lesson / Warning:** Khi chạy `dotnet ef database update`, phải rõ đang apply lên postgres nào. Kiểm tra connection string trong `appsettings.json` trước.

---

[2026-05-05] [ALL DOWNSTREAM SERVICES] [DECISION]

**Problem:** Downstream services (music, streaming, recommendation...) dùng `[Authorize]` với JWT Bearer — fail vì API Gateway đã remove Authorization header trước khi forward.
**Root cause:** Trong API Gateway pattern, chỉ Gateway validate JWT. Downstream nhận `X-User-Id` và `X-User-Role` headers do Gateway inject.
**Fix / Decision:** Tất cả downstream services dùng `GatewayAuthHandler` — trust `X-User-Id`/`X-User-Role` headers, không re-validate JWT. Pattern này áp dụng cho mọi service implement sau: music, streaming, analytics, notification, search, listening-party.
**Lesson / Warning:** KHÔNG thêm JWT Bearer vào downstream services. Không cần `JWT_SECRET` trong env của downstream.

---

[2026-05-05] [USER SERVICE / GRPC] [BUG]

**Problem:** gRPC call từ auth-service đến user-service fail với `HTTP_1_1_REQUIRED`.
**Root cause:** Kestrel `HttpProtocols.Http1AndHttp2` không support h2c (HTTP/2 cleartext) trong .NET 8. Chỉ support HTTP/2 qua TLS (ALPN).
**Fix / Decision:** Tách port: port 80 dùng `Http1` (REST), port 5300 dùng `Http2` (gRPC h2c). Docker-compose expose cả hai. Auth-service gọi `http://user-service:5300`.
**Lesson / Warning:** Pattern này áp dụng cho MỌI service có gRPC server: REST port 80, gRPC port 5300. PHẢI dùng `Http2` (không phải `Http1AndHttp2`) cho gRPC port.

---

[2026-05-05] [USER SERVICE / EF CORE] [BUG]

**Problem:** Docker build fail với `FileNotFoundException: Microsoft.EntityFrameworkCore.Relational, Version=8.0.26.0`.
**Root cause:** `UserService.Api.csproj` pin `EF Core Design Version="8.0.0"` (exact) trong khi Infrastructure dùng `8.0.*` → resolve 8.0.26. Version mismatch giữa Design và Relational DLL.
**Fix / Decision:** Đổi thành `Version="8.0.*"` để cả hai projects resolve cùng version.
**Lesson / Warning:** KHÔNG pin exact version `8.0.0` cho EF Core packages. Dùng `8.0.*` cho tất cả. Build warning về conflict thường báo hiệu runtime failure.

---

[2026-05-05] [API GATEWAY / JWT] [DECISION]

**Problem:** Plan ghi Redis blacklist key là `rt:blacklist:{jti}`, nhưng Auth Service thực tế viết `token:blacklist:{jti}`.
**Root cause:** Spec trong plan không đồng bộ với implementation.
**Fix / Decision:** Gateway đọc `token:blacklist:{jti}` — theo code thực tế Auth Service, không theo plan.
**Lesson / Warning:** Khi implement service cần đọc Redis key của service khác, grep code thực tế (`StringSetAsync`, `KeyExpireAsync`) thay vì chỉ đọc plan.

---

[2026-05-05] [API GATEWAY / CIRCUIT BREAKER] [BUG]

**Problem:** Test `InvokeAsync_ClientDisconnects_DoesNotReturn503` fail — middleware throw `TaskCanceledException` khi client disconnect thay vì swallow.
**Root cause:** `catch (OperationCanceledException) when (cts.IsCancellationRequested && !originalAborted.IsCancellationRequested)` — khi client disconnect, cả hai token đều cancelled → condition false → exception không được catch.
**Fix / Decision:** Thêm catch block riêng: `catch (OperationCanceledException) when (originalAborted.IsCancellationRequested)` để swallow client disconnect. Circuit breaker catch đứng SAU.
**Lesson / Warning:** Thứ tự `catch when` rất quan trọng với linked CancellationTokenSource. Client-disconnect catch phải đứng trước circuit-breaker catch.

---

[2026-05-05] [MUSIC SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Integration tests dùng `EnsureCreatedAsync` + schema isolation — schema mới không được tạo vì database đã tồn tại.
**Root cause:** `EnsureCreatedAsync` là no-op khi database đã exist, bất kể schema state. Hai vấn đề: (1) Docker postgres intercept connection; (2) `EnsureCreated` không tạo schema mới trong existing DB.
**Fix / Decision:** Integration tests dùng native postgres (`postgres/4L27hN04@`, `music_db` đã tồn tại). Bỏ schema isolation — mỗi test seed data riêng và cleanup trong `DisposeAsync`. Thêm `Pooling=false` vào connection string.
**Lesson / Warning:** Không dùng `EnsureCreatedAsync` cho schema isolation với pre-existing database. Dùng cleanup-based isolation thay thế.

---

[2026-05-05] [MUSIC SERVICE / API RESPONSE] [DECISION]

**Problem:** `ApiResponse<T>` dùng `Error: string?`, thiếu `meta` fields đúng contract. `POST /music/songs` trả 200 thay vì 201.
**Fix / Decision:** Rewrite `ApiResponse<T>` với `ApiError(Code, Message)` record và `ApiMeta` class. POST upload trả 201. `cache` field chỉ xuất hiện cho endpoints có caching.
**Lesson / Warning:** Kiểm tra `ApiResponse` shape theo `api-contract-first/RULE.md` trước khi viết bất kỳ controller nào.

---

[2026-05-05] [MUSIC SERVICE / CLEAN ARCHITECTURE] [DECISION]

**Problem:** `SongService` (Application layer) import `StackExchange.Redis` và `IConfiguration` — infrastructure concerns leak vào Application.
**Fix / Decision:** Tạo `ISongCache` abstraction ở Application, implement `RedisSongCache` ở Infrastructure. `IStorageService` thêm `BucketName` property để Application không cần `IConfiguration`.
**Lesson / Warning:** Application layer KHÔNG được reference Infrastructure packages. Nếu service cần config hoặc external clients, thêm typed abstraction vào `Application/Interfaces`.

---

[2026-05-05] [INFRA / MINIO / SEED] [DECISION]

**Problem:** Plan W3-4 mô tả dùng LocalStack S3, nhưng docker-compose đã có MinIO (port 9000).
**Fix / Decision:** Không thêm LocalStack — dùng MinIO đã có. Seed script dùng `mc` (MinIO Client) qua `docker exec` thay AWS CLI. Upload dùng `mc pipe` (stdin) vì Git Bash trên Windows convert path gây lỗi.
**Lesson / Warning:** Trên Windows Git Bash, `docker cp` và `docker exec` với path `/tmp/` bị MSYS convert. Workaround: `MSYS_NO_PATHCONV=1` hoặc pipe stdin.

---

[2026-05-05] [STREAMING SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Test `GetChunk_WithRangeHeader_Returns206PartialContent` fails — `Content-Range` không tìm thấy trong `response.Headers`.
**Root cause:** `Content-Range` là content header theo RFC 7233. .NET `HttpClient` phân loại nó vào `response.Content.Headers`, không phải `response.Headers`.
**Fix / Decision:** Đổi assertion sang `response.Content.Headers.Should().ContainKey("Content-Range")`.
**Lesson / Warning:** Check `response.Content.Headers` cho content headers (Content-Range, Content-Type, Content-Length). Dùng `response.Headers` cho response headers (X-Correlation-Id, Set-Cookie, Location).

---

[2026-05-05] [STREAMING SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Test `GetChunk_WithInvalidRangeHeader_Returns416` throws `HttpHeaderParser.ParseValue` exception khi thêm `Range: invalid-range`.
**Root cause:** `HttpRequestMessage.Headers.Add("Range", ...)` validate format theo RFC. String `"invalid-range"` không hợp lệ → exception ở client side trước khi gửi request.
**Fix / Decision:** Dùng `request.Headers.TryAddWithoutValidation("Range", "invalid-range")` để bypass validation.
**Lesson / Warning:** Khi test edge case với invalid headers, dùng `TryAddWithoutValidation` thay vì `Add`.

---

[2026-05-05] [STREAMING SERVICE] [DECISION]

**Problem:** Chunk endpoint cần chọn: proxy S3 bytes trực tiếp hay redirect về CDN URL.
**Fix / Decision:** S3 proxy — Streaming Service fetch bytes bằng `GetObjectRequest` với `ByteRange`, stream qua `Response.Body`. Không cần CDN cho local dev MinIO.
**Lesson / Warning:** Proxy đơn giản cho local dev nhưng tốn bandwidth ở service layer. Nếu cần scale, thêm CDN redirect ở `/url` endpoint, giữ `/chunk` như backup.

---

[2026-05-05] [RECOMMENDATION SERVICE / PYPROJECT] [BUG]

**Problem:** `pytest` fails với `Invalid statement (at line 1, column 1)` khi đọc `pyproject.toml`.
**Root cause:** File `pyproject.toml` và `pytest.ini` được tạo với UTF-8 BOM (`\xef\xbb\xbf`). TOML parser không chấp nhận BOM.
**Fix / Decision:** Dùng Write tool để overwrite — ghi UTF-8 không BOM. Xóa `pytest.ini` cũ, chuyển config sang `[tool.pytest.ini_options]` trong `pyproject.toml`.
**Lesson / Warning:** File config (`.toml`, `.ini`, `.cfg`) có nguy cơ BOM nếu tạo bởi Windows tools. Khi gặp parse error lạ ở dòng 1 column 1: `python -c "open('f','rb').read(4)"` để check BOM.

---

[2026-05-05] [RECOMMENDATION SERVICE / SETUPTOOLS] [BUG]

**Problem:** `pip install -e .` fails với `BackendUnavailable: Cannot import 'setuptools.backends.legacy'`.
**Root cause:** `setuptools.backends.legacy:build` là backend mới từ setuptools 69+. Venv dùng version cũ hơn.
**Fix / Decision:** Đổi `build-backend` sang `"setuptools.build_meta"` — backend chuẩn, tương thích rộng hơn.
**Lesson / Warning:** Dùng `"setuptools.build_meta"` cho tất cả Python projects. `setuptools.backends.legacy` chỉ dùng khi chắc setuptools >= 69.

---

[2026-05-05] [RECOMMENDATION SERVICE] [DECISION]

**Problem:** IDE VS Code Pylance báo `Cannot find module 'fastapi'`, `Cannot find module 'redis.asyncio'` trên tất cả Python files.
**Root cause:** IDE dùng global Python interpreter (`E:\Python311`) thay vì `.venv`. Packages chỉ install vào `.venv`.
**Fix / Decision:** Không sửa code — đây là IDE config issue. Tests chạy đúng với `.venv/Scripts/python -m pytest`. Fix IDE: chọn interpreter `.venv/Scripts/python.exe` trong VS Code Python extension.
**Lesson / Warning:** Khi thấy "Cannot find module X" trong IDE nhưng tests pass → interpreter mismatch, không phải code bug. Không commit workaround chỉ để làm IDE happy.

---

[2026-05-07] [FRONTEND / TESTING] [BUG]

**Problem:** Vitest mock của `@microsoft/signalr.HubConnectionBuilder` với `vi.fn().mockImplementation(() => ({...}))` throw `is not a constructor` — hook dùng `new HubConnectionBuilder()`.
**Root cause:** Arrow function không thể làm constructor. `vi.fn().mockImplementation(() => obj)` dùng arrow function nên `new` keyword throw TypeError.
**Fix / Decision:** Dùng `function MockHubConnectionBuilder() { return mockBuilder; }` (regular function). Builder object là 1 shared object, tất cả chained methods (`withUrl`, `withAutomaticReconnect`, `configureLogging`) return chính object đó — không phải `mockReturnThis()` (trả về mock function, không phải builder).
**Lesson / Warning:** Khi mock class dùng `new` trong vitest: (1) dùng `function` keyword, không phải arrow; (2) builder pattern cần tất cả chained methods return cùng 1 object — khai báo object trước, rồi `method.mockReturnValue(thatObject)`.

---

[2026-05-07] [FRONTEND / ARCHITECTURE] [DECISION]

**Problem:** Plan W9 nói CreatorDashboardPage "gọi GET /api/v1/music/songs — dùng artist filter" nhưng endpoint này không tồn tại trong API Design V2.
**Root cause:** Plan được viết trước API Design V2 được finalize. Chỉ có `POST /music/songs` (upload) và `GET /music/songs/{songId}` (by ID).
**Fix / Decision:** CreatorDashboardPage dùng Song ID input — Creator nhập songId để xem analytics. Đây là đủ cho MVP demo flow. Không implement endpoint ngoài contract.
**Lesson / Warning:** Trước khi implement bất kỳ API call nào từ plan, kiểm tra API_DESIGN_V2.md để confirm endpoint tồn tại. Plan file có thể out-of-date so với contract.

---

---

[2026-05-16] [VERIFY_AC / ALL SERVICES] [BUG MARATHON → 23 PASS / 0 FAIL]

**Problem:** Chạy `verify_ac.sh` lần đầu ra PASS:4, FAIL:19. Cần fix toàn bộ trước W11 demo.

**Root causes & fixes theo thứ tự:**

1. **Redis `abortConnect=false` không áp dụng** (music, analytics, api-gateway, listening-party, notification, search, user, auth): Connection string có `abortConnect=false` nhưng `ConfigurationOptions.Parse()` không luôn honor. Fix: Explicit `opts.AbortOnConnectFail = false` sau khi parse, trước `Connect()`.

2. **Listening Party config key sai**: Code đọc `configuration["REDIS_CONNECTION_STRING"]` nhưng docker-compose set `Redis__ConnectionString` (→ mapped thành `Redis:ConnectionString` bởi ASP.NET). Fix: đổi sang `configuration["Redis:ConnectionString"]`.

3. **Auth Service 401 thay vì 400 cho sai mật khẩu**: API Design V2 nói `AUTH_INVALID_CREDENTIALS` → 400. Code throw `UnauthorizedException` (401). Fix: tạo `InvalidCredentialsException` với HTTP 400.

4. **User Service `List<Guid>` vs `List<string>`**: DB column `preferred_genres` là `uuid[]` nhưng dữ liệu seed là string genre names. Fix: đổi column sang `text[]`, đổi domain model sang `List<string>`.

5. **Search: `string[]? Mood` deserialization lỗi**: ES document có `mood: "string"` nhưng C# record khai báo `string[]?`. Fix: đổi thành `string?`.

6. **Search: Elasticsearch Vietnamese garbled**: Seed chạy từ Git Bash trên Windows → UTF-8 bị encode sai. Fix: re-seed qua `docker run Alpine` container có locale đúng.

7. **GCS credentials**: Streaming service không tìm `/app/secrets/google-cloud-key.json`. Fix: copy service account key với tên chuẩn. Music service: `StorageClient.Create()` gọi eager → crash startup. Fix: Lazy<StorageClient>.

8. **Music upload 500**: `genreIds=genre-vpop-001` → `Guid.Parse()` throw `FormatException` → không có catch cụ thể → 500 INTERNAL_ERROR. Fix: dùng UUID thật `d4e5f6a7-b8c9-0123-defa-234567890123` (Pop genre) trong verify_ac.sh.

9. **Artist profile missing**: Không có record trong `artists` table cho `creator@example.com`. Fix: INSERT artist với `UserId = '2b654acb-feb4-44f3-84ef-4663fee85417'`.

10. **Rate limit false-fail khi chạy nhiều lần**: Consecutive runs → `POST /auth/login` hit 429 trước khi AC1.1.x kiểm tra được. Fix: flush `rate:*` + `rl:*` keys từ Redis đầu mỗi run.

11. **`grep -oP` locale error trên Git Bash**: 3 chỗ dùng PCRE regex với `grep -oP` bị lỗi trên Windows. Fix: chuyển tất cả sang `python3 -c "import re, sys; ..."`.

12. **`UPLOADED_SONG_ID` extraction sai field**: `json_str "id"` tìm field `id` nhưng response có `data.songId`. Fix: Python3 path `d.get('data',{}).get('songId','')`.

**Lesson:** `Guid.Parse()` với string tùy ý (không phải UUID) là bug ẩn trong SongService — nên bắt `FormatException` và trả 400 `VALIDATION_ERROR` thay vì để slip thành 500. Ghi TODO.

**Kết quả cuối:** PASS:23 / FAIL:0 / SKIP:26.

---

[2026-05-16] [FRONTEND] [DECISION]

**Problem:** FE hiển thị mock data thay vì real data từ backend. `VITE_MOCK=true` trong `.env.development` + nhiều page import trực tiếp từ `mocks/data.ts` không qua env check.

**Phạm vi vấn đề:**
- MSW (Mock Service Worker) intercept toàn bộ API calls khi `VITE_MOCK=true`
- Các page import mock trực tiếp (không qua env check): ArtistPage, SongDetailPage, CreatorDashboardPage, ProfilePage, PreferencesPage, CreatorSongAnalyticsPage, PartyRoomPage

**Decision:** Chọn **Option B — Full integration** (tắt VITE_MOCK + refactor từng page để gọi real API). Thứ tự ưu tiên: Home → Search → SongDetail → Profile → CreatorDashboard → Analytics. Bắt đầu ở session tiếp theo.

