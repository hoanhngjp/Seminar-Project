# Plan: Backend API Alignment với Frontend UI

> **Ngày tạo:** 2026-05-15  
> **Cập nhật:** 2026-05-15 — thêm Google OAuth login  
> **Trạng thái:** Approved — sẵn sàng implement

## Context

Frontend UI đã hoàn thành với mock data (698/698 tests xanh). Mục tiêu: refactor các BE service để trả về đúng schema mà FE cần, bổ sung API còn thiếu, setup toàn bộ infrastructure + seed data để test end-to-end. DB đã drop sạch, bucket GCS đã có file `.mp3` sẵn.

---

## Gaps Identified (khảo sát thực tế)

| Service | Gap |
|---|---|
| **Auth** | `LoginRequest.username` → FE gửi `email` field; thiếu Google OAuth endpoint |
| **User** | `UserProfileDto` thiếu `preferredGenres[]`, `preferredArtists[]`, `hasCompletedOnboarding`; `preferred_artists` column bị map sai sang `preferred_languages`; `has_completed_onboarding` không tồn tại trong DB |
| **Music** | `SongResponseDto` thiếu `genreName`, `moodName`, `language`, `releaseDate`, `playCount`; Songs table không có `mood` column; `releaseDate` nằm ở Albums |
| **Analytics** | Heatmap DTO trả `skipRate` nhưng FE expect `count` |
| **Notification** | `NotificationDto` field names sai: FE cần `{notificationId, message, read, createdAt, type}` nhưng BE trả `{Id, Title, Body, Status, ...}` |
| **Streaming** | Cần verify GCS pre-signed URL dùng đúng env vars + field name `url` vs `streamUrl` |
| **Listening Party** | WS path: FE gọi `/ws/v1/parties/{roomId}` nhưng actual SignalR hub là `/hubs/party?roomId={roomId}` → cần update API Gateway route |
| **Infrastructure** | DB trống, Elasticsearch chưa có index, InfluxDB chưa có bucket, Redis trống, không có seed data |

---

## Phased Implementation Plan

> Thực hiện song song theo phase. Trong mỗi phase, các service độc lập nhau có thể chạy song song.

---

### PHASE 1 — Infrastructure Setup

**Mục tiêu:** Docker Compose up, migrations, index, seed data cơ bản.

#### 1.1 Docker Compose
- File: `infra/docker-compose.yml`
- Chạy: PostgreSQL (7 DBs), Redis, MongoDB, Elasticsearch, Kafka (5 topics), InfluxDB, MinIO
- Verify bằng `infra/verify-infra.sh`

#### 1.2 EF Core Migrations — tất cả C# services
Chạy `dotnet ef database update` cho từng service:
- `auth-service` → `auth_db`
- `user-service` → `user_db` *(sau khi đã fix migration ở Phase 2)*
- `music-service` → `music_db` *(sau khi đã fix migration ở Phase 3)*
- `streaming-service` → `streaming_db` (nếu có)
- `analytics-service` → (InfluxDB — không dùng EF)
- `notification-service` → MongoDB (auto-create)
- `search-service` → Elasticsearch (auto-create index)
- `listening-party-service` → Redis (no migration)

#### 1.3 InfluxDB Setup
- Tạo org `smartmusic`, bucket `analytics_db`, retention `30d`
- Cấu hình token vào `.env`

#### 1.4 Elasticsearch Index
File cần tạo: `services/search-service/src/SearchService.Infrastructure/Elasticsearch/IndexInitializer.cs`  
Tạo index `songs` với mapping:
```json
{
  "title": "text (vi analyzer)",
  "artist": "text",
  "genre": "keyword",
  "mood": "keyword",
  "language": "keyword"
}
```

#### 1.5 Seed Data Script
File mới: `infra/seed/SeedData.sql` (PostgreSQL) + `infra/seed/seed.sh`

Seed bao gồm:
- **Genres** (9 cái khớp FE): Pop, Rock, R&B, Jazz, Classical, Electronic, Hip-Hop, Acoustic, Indie
- **Test Artist**: `creator@example.com` user → artist record với `stage_name = "Test Artist"`
- **Test Songs** (8 bài): reference GCS keys đã có trong bucket (`GCP_BUCKET_NAME`), cover image dùng placeholder hoặc Cloudinary URLs
- **User preferences**: listener có `preferred_genres` = [Pop, Rock]

---

### PHASE 2 — Auth Service + User Service

**Parallel**: Auth và User độc lập nhau.

#### 2.1 Auth Service — Accept `email` field + Google OAuth

**2.1a — Đổi field login:**

File: `services/auth-service/src/AuthService.Application/DTOs/LoginRequest.cs`
- `LoginRequest.Username` → `LoginRequest.Email`
- Logic lookup: tìm user theo `email` qua gRPC `VerifyCredentials`

**2.1b — Google OAuth endpoint (mới):**

Flow:
1. FE dùng Google JS SDK → nhận `id_token` (JWT do Google ký)
2. FE gửi `POST /api/v1/auth/google` với body `{ idToken: "..." }`
3. Auth Service verify `id_token` bằng Google public keys → extract `email`, `name`, `picture`, `sub` (Google user ID)
4. Gọi User Service gRPC `GetUserByEmail` → nếu chưa có → gọi `CreateUser` (auto-register, không cần password)
5. Phát JWT access token + refresh token như login thường

**Files cần tạo/sửa:**

```
services/auth-service/src/
├── AuthService.Api/Controllers/AuthController.cs
│   └── POST /api/v1/auth/google  (public — skip JWT middleware)
├── AuthService.Application/
│   ├── DTOs/GoogleAuthRequest.cs     { IdToken: string }
│   ├── Interfaces/IAuthService.cs    + GoogleSignInAsync(idToken)
│   └── Services/AuthService.cs       + GoogleSignInAsync impl
└── AuthService.Infrastructure/
    └── Google/GoogleTokenVerifier.cs  (dùng Google.Apis.Auth NuGet)
```

**NuGet package cần thêm:**
```xml
<PackageReference Include="Google.Apis.Auth" Version="1.68.*" />
```

**GoogleTokenVerifier logic:**
```csharp
// Verify id_token bằng Google public keys (không cần secret)
var payload = await GoogleJsonWebSignature.ValidateAsync(idToken,
    new GoogleJsonWebSignature.ValidationSettings {
        Audience = new[] { Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID") }
    });
// payload.Email, payload.Name, payload.Picture, payload.Subject
```

**User Service — gRPC mới cần thêm:**

File: `proto/user.proto` — thêm RPC:
```protobuf
rpc GetUserByEmail (GetUserByEmailRequest) returns (UserProfileResponse);
// GetUserByEmailRequest { string email = 1; }
// Nếu không tìm thấy → trả NOT_FOUND status code
```

File: `services/user-service/src/UserService.Infrastructure/Grpc/UserGrpcService.cs`
- Implement `GetUserByEmail`: query `users` table by `email`

**Xử lý OAuth user trong User Service (`CreateUser`):**
- `password_hash` phải nullable (OAuth users không có password)
- Migration: `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;`

**API Gateway — skip JWT cho `/api/v1/auth/google`:**

File: `services/api-gateway/src/ApiGateway.Api/Middleware/JwtValidationMiddleware.cs`
- Thêm `/api/v1/auth/google` vào danh sách public paths (cùng với `/login`, `/refresh`, `/register`)

**Frontend — Google Sign-In button:**

File: `services/frontend/src/pages/LoginPage.tsx`
- Thêm Google Sign-In button (dùng `@react-oauth/google` library hoặc gọi thủ công Google OAuth)
- Sau khi nhận `credential` từ Google → gọi `authService.googleSignIn(idToken)`

File: `services/frontend/src/services/authService.ts`
- Thêm `googleSignIn(idToken: string)` → `POST /api/v1/auth/google` → xử lý response như login thường

**Tests cần thêm:**
- `AuthService.UnitTests` — mock `GoogleTokenVerifier`, test happy path + invalid token + new user auto-register
- `AuthService.IntegrationTests` — mock Google validation, test full flow

**Error codes mới (dùng tạm):**
- `400 VALIDATION_ERROR` — idToken bị thiếu hoặc rỗng
- `401 UNAUTHORIZED` — Google token invalid/expired
- `500 INTERNAL_ERROR` — Google API không phản hồi

#### 2.2 User Service — DB Migration
File mới: `services/user-service/src/UserService.Infrastructure/Migrations/XXXXXX_FixPreferencesSchema.cs`

Migration thêm:
```sql
ALTER TABLE user_preferences ADD COLUMN preferred_artists UUID[];
ALTER TABLE user_preferences ADD COLUMN preferred_languages VARCHAR(10)[];  -- nếu chưa có
ALTER TABLE users ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT FALSE;
```
*(Fix lại C# model mapping: `PreferredArtists` → `preferred_artists`, tách riêng `PreferredLanguages`)*

#### 2.3 User Service — Update DTOs
File: `services/user-service/src/UserService.Application/DTOs/UserProfileDto.cs`

Thêm fields vào `UserProfileDto`:
```csharp
public List<Guid> PreferredGenres { get; set; }
public List<Guid> PreferredArtists { get; set; }
public bool HasCompletedOnboarding { get; set; }
```

File: `services/user-service/src/UserService.Infrastructure/Repositories/UserRepository.cs`  
Update query để JOIN `user_preferences` khi GET /users/me.

File: `services/user-service/src/UserService.Application/DTOs/UpdatePreferencesRequest.cs`  
Đảm bảo `PreferredArtists` lưu đúng column.

Sau khi save preferences thành công → set `has_completed_onboarding = true` trên user record.

**Tests cần update:**
- `UserService.UnitTests/UserProfileServiceTests.cs`
- `UserService.IntegrationTests/UsersControllerTests.cs`

---

### PHASE 3 — Music Service

#### 3.1 DB Migration — Add `mood` column
File mới: `services/music-service/src/MusicService.Infrastructure/Data/Migrations/XXXXXX_AddMoodToSongs.cs`

```sql
ALTER TABLE songs ADD COLUMN mood VARCHAR(50);
```

#### 3.2 Update SongResponseDto
File: `services/music-service/src/MusicService.Application/DTOs/SongResponseDto.cs`

Thêm fields:
```csharp
public string? GenreName { get; set; }     // từ JOIN song_genres → genres
public string? MoodName { get; set; }       // từ songs.mood
public string? Language { get; set; }       // từ songs.language
public DateOnly? ReleaseDate { get; set; }  // từ albums.release_date (nếu có album)
public long PlayCount { get; set; }         // từ songs.play_count
// explainText: null cho Music Service (chỉ Recommendation Service có)
```

#### 3.3 Update Repository Query
File: `services/music-service/src/MusicService.Infrastructure/Repositories/MusicRepository.cs`

Update `GetByIdAsync` để LEFT JOIN:
```csharp
.Include(s => s.SongGenres).ThenInclude(sg => sg.Genre)
.Include(s => s.Album)
```
Map `GenreName = song.SongGenres.FirstOrDefault()?.Genre?.Name`

#### 3.4 Upload — GCS Integration
File: `services/music-service/src/MusicService.Infrastructure/GCS/GcsStorageService.cs`

Verify:
- Dùng `GOOGLE_APPLICATION_CREDENTIALS` env var (service account JSON path)
- Upload audio → `gs://{GCP_BUCKET_NAME}/songs/{songId}/audio.mp3`
- Upload cover image → Cloudinary dùng `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Trả về `coverUrl` từ Cloudinary secure URL

**Tests:**
- `MusicService.UnitTests/SongServiceTests.cs` — mock GCS + Cloudinary

---

### PHASE 4 — Streaming Service

#### 4.1 Verify GCS Pre-signed URL
File: `services/streaming-service/src/StreamingService.Infrastructure/GCS/GcsStreamingService.cs`

Kiểm tra:
- Env: `GCP_PROJECT_ID`, `GCP_BUCKET_NAME`, `GOOGLE_APPLICATION_CREDENTIALS`
- Pre-signed URL expiry = 900 giây (15 phút)
- Response field: `{ url, expiresAt }` — FE cần `streamUrl` hoặc `url` (verify với FE type)

File FE: `services/frontend/src/types/domain.ts` — FE dùng field `streamUrl` trong `StreamUrlResponse`
→ Nếu BE trả `url`, cần đổi thành `streamUrl` trong `StreamUrlResult` DTO.

---

### PHASE 5 — Search Service

#### 5.1 Verify SearchResult DTO
File: `services/search-service/src/SearchService.Application/DTOs/SearchResponse.cs`

FE cần:
```typescript
{ id, name, type: 'song'|'artist', score, coverUrl, artist?, duration? }
```

Map BE → FE:
- `Id` → `id`
- `Title` → `name` (songs) / `StageName` → `name` (artists)
- `CoverUrl` → `coverUrl` (ensure present)
- `Score` → `score`

#### 5.2 Seed Elasticsearch
Sau khi seed PostgreSQL (Phase 1.5), index songs vào Elasticsearch:
- Có thể dùng Kafka event `New_Release` để trigger auto-index
- Hoặc thêm `POST /internal/search/reindex` endpoint để seed thủ công

---

### PHASE 6 — Analytics Service

#### 6.1 Fix HeatmapResponse DTO
File: `services/analytics-service/src/AnalyticsService.Application/DTOs/HeatmapResponse.cs`

Đổi:
```csharp
// Before
public int SkipRate { get; set; }
// After  
public int Count { get; set; }   // FE expects `count`
```

#### 6.2 Fix StatsResponse — Map `dailyListeners`
File: `services/analytics-service/src/AnalyticsService.Application/DTOs/StatsResponse.cs`

FE expects `AnalyticsStats.dailyListeners[]{date, count}`.  
BE trả `DailyPlays[]{Date, Plays}`.

Đổi field name:
```csharp
public class DailyListenerPoint {
    public string Date { get; set; }   // "DD/MM" format
    public int Count { get; set; }     // rename từ Plays
}
public List<DailyListenerPoint> DailyListeners { get; set; }  // rename từ DailyPlays
```

---

### PHASE 7 — Notification Service

#### 7.1 Fix NotificationDto field mapping
File: `services/notification-service/src/NotificationService.Application/DTOs/NotificationDto.cs`

FE cần:
```typescript
{ notificationId, message, read, createdAt, type? }
```

Map:
```csharp
public string NotificationId { get; set; }  // từ Id
public string Message { get; set; }          // từ Body (hoặc Title + Body)
public bool Read { get; set; }               // Status == "Read"
public DateTime CreatedAt { get; set; }
public string? Type { get; set; }            // "new_release" | "system"
```

---

### PHASE 8 — Listening Party Service

#### 8.1 Fix WebSocket Hub Path
File: `services/api-gateway/src/ApiGateway.Api/appsettings.json`

FE expects: `ws://localhost:5000/ws/v1/parties/{roomId}`  
Actual SignalR hub: `/hubs/party?roomId={roomId}`

Options:
- **Option A (recommended)**: Thêm route alias trong API Gateway để `/ws/v1/parties/{roomId}` → forward tới `/hubs/party?roomId={roomId}`
- **Option B**: Update FE `useListeningParty.ts` để dùng đúng SignalR URL

→ **Chọn Option A** để không phải đổi FE đã done.

#### 8.2 Verify SignalR Hub Events Match FE Contract
File: `services/listening-party-service/src/ListeningPartyService.Api/Hubs/PartyHub.cs`

FE expects:
- `SYNC_STATE` → `{songId, isPlaying, positionSec, hostId, timestamp}` ✅ (camelCase)
- `MEMBER_JOIN` → `{userId, displayName, avatarUrl, joinedAt}` — verify `displayName` có trong event không
- `MEMBER_LEAVE` → `{userId, reason}` ✅
- `ROOM_CLOSED` → `{reason}` ✅

Nếu `displayName` thiếu trong `MemberJoinMessage` → bổ sung từ User Service lookup.

---

### PHASE 9 — Recommendation Service

#### 9.1 Seed Redis Trending Data
File mới: `services/recommendation-service/src/recommendation_service/scripts/seed_redis.py`

Sau khi seed songs vào PostgreSQL → seed Redis Sorted Set:
```
ZADD rec:trending:global <play_count> <song_id>
```

#### 9.2 Verify Internal Music Service Call
File: `services/recommendation-service/src/recommendation_service/api/routes/recommendations.py`

Kiểm tra `GET http://music-service/internal/songs/batch?ids=...` response shape khớp với `SongItem` type FE cần.

---

## Thứ tự thực hiện (dependency graph)

```
Phase 1 (infra) 
    ↓
Phase 2 (auth+user) ──┐
Phase 3 (music)   ────┤ (song data ready)
Phase 4 (streaming)   │
    ↓                 ↓
Phase 5 (search) ← cần songs trong ES
Phase 6 (analytics)   ← độc lập
Phase 7 (notification) ← độc lập
Phase 8 (party)        ← độc lập
Phase 9 (recommendation) ← cần songs trong Redis
```

**Parallel groups:**
- **Group A** (sau Phase 1): Phase 2, 3, 4, 6, 7, 8 → chạy song song
- **Group B** (sau Group A): Phase 5, 9 → cần data từ Phase 3

---

## Critical Files

| File | Thay đổi |
|---|---|
| `services/auth-service/src/AuthService.Application/DTOs/LoginRequest.cs` | `Username` → `Email` |
| `services/auth-service/src/AuthService.Application/DTOs/GoogleAuthRequest.cs` | Mới — `{ IdToken }` |
| `services/auth-service/src/AuthService.Infrastructure/Google/GoogleTokenVerifier.cs` | Mới — `Google.Apis.Auth` verify |
| `services/auth-service/src/AuthService.Application/Services/AuthService.cs` | Thêm `GoogleSignInAsync` |
| `services/auth-service/src/AuthService.Api/Controllers/AuthController.cs` | Thêm `POST /api/v1/auth/google` |
| `services/api-gateway/src/ApiGateway.Api/Middleware/JwtValidationMiddleware.cs` | Whitelist `/auth/google` |
| `proto/user.proto` | Thêm `GetUserByEmail` RPC |
| `services/user-service/src/UserService.Infrastructure/Grpc/UserGrpcService.cs` | Implement `GetUserByEmail` |
| `services/user-service/src/UserService.Infrastructure/Migrations/` | `password_hash` → nullable |
| `services/frontend/src/pages/LoginPage.tsx` | Thêm Google Sign-In button |
| `services/frontend/src/services/authService.ts` | Thêm `googleSignIn()` |
| `services/user-service/src/UserService.Infrastructure/Migrations/` | New migration: preferred_artists, has_completed_onboarding |
| `services/user-service/src/UserService.Application/DTOs/UserProfileDto.cs` | Add PreferredGenres, PreferredArtists, HasCompletedOnboarding |
| `services/user-service/src/UserService.Infrastructure/Repositories/UserRepository.cs` | JOIN preferences |
| `services/music-service/src/MusicService.Infrastructure/Data/Migrations/` | New migration: mood column |
| `services/music-service/src/MusicService.Application/DTOs/SongResponseDto.cs` | Add genreName, moodName, language, releaseDate, playCount |
| `services/music-service/src/MusicService.Infrastructure/Repositories/MusicRepository.cs` | JOIN genres + album |
| `services/analytics-service/src/AnalyticsService.Application/DTOs/HeatmapResponse.cs` | `SkipRate` → `Count` |
| `services/analytics-service/src/AnalyticsService.Application/DTOs/StatsResponse.cs` | `DailyPlays` → `DailyListeners`, `Plays` → `Count` |
| `services/notification-service/src/NotificationService.Application/DTOs/NotificationDto.cs` | Remap to `notificationId`, `message`, `read` |
| `services/streaming-service/src/StreamingService.Infrastructure/GCS/GcsStreamingService.cs` | Verify `url`/`streamUrl` field name |
| `services/api-gateway/src/ApiGateway.Api/appsettings.json` | WS route alias for listening party |
| `infra/seed/` | New: SeedData.sql, seed.sh |

---

## Verification Plan

1. **Auth flow (email/password)**: `POST /api/v1/auth/login` với `{email, password}` → nhận `accessToken` + cookie
1b. **Auth flow (Google)**: Click "Đăng nhập bằng Google" trên LoginPage → Google consent → nhận `accessToken` + cookie; user auto-created nếu lần đầu
2. **Profile**: `GET /api/v1/users/me` → có `preferredGenres`, `preferredArtists`, `hasCompletedOnboarding`
3. **Song detail**: `GET /api/v1/music/songs/{seedSongId}` → có `genreName`, `language`, `playCount`
4. **Streaming**: `GET /api/v1/streaming/{seedSongId}/url` → GCS pre-signed URL valid 900s
5. **Recommendations**: `GET /api/v1/recommendations?context=morning` → list songs với `reason`
6. **Search**: `GET /api/v1/search?q=test` → results có `coverUrl`, `duration`
7. **Analytics**: `GET /api/v1/analytics/creator/heatmap/{songId}` → `[{second, count}]`
8. **Notifications**: `GET /api/v1/notifications/unread` → `[{notificationId, message, read}]`
9. **Party**: `POST /api/v1/parties` → `{roomId, joinCode}`, rồi WS connect thành công
10. **UI smoke test**: Mở `localhost:3000`, login, home page hiển thị recommendations, click play → audio phát được
