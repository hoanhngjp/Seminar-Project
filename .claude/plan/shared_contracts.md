# shared_contracts.md — Shared Reference cho Tất Cả Plan Files

> File này được tất cả plan files khác reference. Không cần đọc file khác để dùng file này.
> Cập nhật file này khi có thay đổi port, config, hoặc contract.

---

## 1. Port Mapping — Local Dev

| Service | Port | Health Check URL |
|---------|------|-----------------|
| API Gateway | 5000 | http://localhost:5000/health |
| Auth Service | 5001 | http://localhost:5001/health |
| User Service | 5002 | http://localhost:5002/health |
| Music Service | 5003 | http://localhost:5003/health |
| Streaming Service | 5004 | http://localhost:5004/health |
| Listening Party Service | 5005 | http://localhost:5005/health |
| Analytics Service | 5006 | http://localhost:5006/health |
| Notification Service | 5007 | http://localhost:5007/health |
| Search Service | 5008 | http://localhost:5008/health |
| Recommendation Service (Python) | 8000 | http://localhost:8000/health |
| Frontend (Vite dev) | 3000 | http://localhost:3000 |
| PostgreSQL (auth_db) | 5432 | — |
| PostgreSQL (user_db) | 5433 | — |
| PostgreSQL (music_db) | 5434 | — |
| Redis | 6379 | — |
| Kafka | 9092 | — |
| Kafka UI | 8080 | http://localhost:8080 |
| Elasticsearch | 9200 | http://localhost:9200/_cluster/health |
| MongoDB | 27017 | — |
| InfluxDB | 8086 | http://localhost:8086/health |
| LocalStack (S3 mock) | 4566 | http://localhost:4566/_localstack/health |
| MinIO | 9000 | http://localhost:9000/minio/health/live |
| MinIO Console | 9001 | http://localhost:9001 |

---

## 2. LocalStack / S3 Config (Local Dev)

```bash
# LocalStack endpoint
LOCALSTACK_ENDPOINT=http://localhost:4566

# AWS credentials (dummy — LocalStack không verify)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1

# S3 bucket name
S3_BUCKET_NAME=smart-music-dev

# Tạo bucket (chạy 1 lần khi setup)
aws --endpoint-url=http://localhost:4566 s3 mb s3://smart-music-dev

# Upload test MP3
aws --endpoint-url=http://localhost:4566 s3 cp tests/fixtures/test-audio.mp3 s3://smart-music-dev/songs/test-song-id/audio.mp3

# Verify
aws --endpoint-url=http://localhost:4566 s3 ls s3://smart-music-dev/
```

MinIO (alternative nếu LocalStack không chạy được):
```bash
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=smart-music-dev
```

---

## 3. Elasticsearch Index Mapping — songs

```bash
# Tạo index với mapping (chạy 1 lần khi setup)
curl -X PUT http://localhost:9200/songs -H 'Content-Type: application/json' -d '{
  "mappings": {
    "properties": {
      "id":         { "type": "keyword" },
      "title":      { "type": "text", "analyzer": "standard" },
      "artist":     { "type": "text", "analyzer": "standard" },
      "album":      { "type": "text" },
      "genre":      { "type": "keyword" },
      "mood":       { "type": "keyword" },
      "language":   { "type": "keyword" },
      "is_explicit":{ "type": "boolean" },
      "is_published":{ "type": "boolean" },
      "play_count": { "type": "long" }
    }
  }
}'

# Seed 10 sample songs
curl -X POST http://localhost:9200/songs/_bulk -H 'Content-Type: application/json' -d '
{ "index": { "_id": "song-001" } }
{ "id": "song-001", "title": "Nơi này có anh", "artist": "Sơn Tùng M-TP", "genre": "vpop", "mood": "romantic", "is_published": true, "play_count": 9500 }
{ "index": { "_id": "song-002" } }
{ "id": "song-002", "title": "Chạy ngay đi", "artist": "Sơn Tùng M-TP", "genre": "vpop", "mood": "energetic", "is_published": true, "play_count": 8200 }
{ "index": { "_id": "song-003" } }
{ "id": "song-003", "title": "Hoa nở không màu", "artist": "Hoài Lâm", "genre": "ballad", "mood": "sad", "is_published": true, "play_count": 7100 }
{ "index": { "_id": "song-004" } }
{ "id": "song-004", "title": "Muộn rồi mà sao còn", "artist": "Sơn Tùng M-TP", "genre": "vpop", "mood": "melancholy", "is_published": true, "play_count": 6800 }
{ "index": { "_id": "song-005" } }
{ "id": "song-005", "title": "Bạc phận", "artist": "Jack", "genre": "vpop", "mood": "sad", "is_published": true, "play_count": 6500 }
{ "index": { "_id": "song-006" } }
{ "id": "song-006", "title": "Sóng gió", "artist": "Jack & K-ICM", "genre": "vpop", "mood": "energetic", "is_published": true, "play_count": 6200 }
{ "index": { "_id": "song-007" } }
{ "id": "song-007", "title": "Hương giang", "artist": "Mỹ Tâm", "genre": "ballad", "mood": "romantic", "is_published": true, "play_count": 5900 }
{ "index": { "_id": "song-008" } }
{ "id": "song-008", "title": "Acoustic morning", "artist": "Ngọc Linh", "genre": "acoustic", "mood": "morning", "is_published": true, "play_count": 4500 }
{ "index": { "_id": "song-009" } }
{ "id": "song-009", "title": "Focus time", "artist": "Lo-Fi Studio", "genre": "lofi", "mood": "focus", "is_published": true, "play_count": 4200 }
{ "index": { "_id": "song-010" } }
{ "id": "song-010", "title": "Evening chill", "artist": "Ambient Duo", "genre": "ambient", "mood": "evening", "is_published": true, "play_count": 3800 }
'

# Verify fuzzy search
curl "http://localhost:9200/songs/_search?q=son+tug&pretty"
```

---

## 4. Redis Seed — Trending Sorted Set

```bash
# Populate rec:trending:global với 50 songs (ZADD key score member)
# Chạy lần lượt hoặc dùng redis-cli pipe mode

redis-cli ZADD rec:trending:global \
  9500 "song-001" \
  8200 "song-002" \
  7100 "song-003" \
  6800 "song-004" \
  6500 "song-005" \
  6200 "song-006" \
  5900 "song-007" \
  4500 "song-008" \
  4200 "song-009" \
  3800 "song-010"

# Thêm 40 songs nữa với score giảm dần (3000 → 100)
# (script đầy đủ trong infra/seed/redis_seed.sh)

# Set TTL 1h cho trending list
redis-cli EXPIRE rec:trending:global 3600

# Verify
redis-cli ZREVRANGE rec:trending:global 0 9 WITHSCORES
```

Seed script đầy đủ: `infra/seed/redis_seed.sh`
Seed script S3: `infra/seed/s3_seed.sh`
Seed script Elasticsearch: `infra/seed/elasticsearch_seed.sh`

---

## 5. Error Codes Catalogue (source: API_DESIGN_V2.md)

**Frontend dùng bảng này để map error code → user message.**
**Backend dùng bảng này để không tự đặt code mới ngoài danh sách.**

| HTTP Status | Error Code | Dùng khi | User Message (gợi ý) |
|-------------|------------|----------|---------------------|
| 400 | `AUTH_INVALID_CREDENTIALS` | Login sai username/password | "Tên đăng nhập hoặc mật khẩu không đúng" |
| 400 | `VALIDATION_ERROR` | Input không hợp lệ (thiếu field, sai type) | "Dữ liệu không hợp lệ: {field}" |
| 401 | `UNAUTHORIZED` | Không có JWT hoặc JWT không hợp lệ | "Vui lòng đăng nhập lại" |
| 401 | `TOKEN_EXPIRED` | JWT hết hạn | "Phiên đăng nhập hết hạn" |
| 403 | `FORBIDDEN` | Đủ auth nhưng sai role | "Bạn không có quyền thực hiện thao tác này" |
| 403 | `TOKEN_REUSED` | Refresh token dùng lại | "Phát hiện đăng nhập bất thường. Vui lòng đăng nhập lại" |
| 404 | `USER_NOT_FOUND` | Không tìm thấy user | "Người dùng không tồn tại" |
| 404 | `SONG_NOT_FOUND` | Không tìm thấy bài hát | "Bài hát không tồn tại hoặc đã bị xóa" |
| 404 | `ROOM_NOT_FOUND` | Không tìm thấy listening party | "Phòng nghe nhạc không tồn tại hoặc đã đóng" |
| 404 | `NOTIFICATION_NOT_FOUND` | Không tìm thấy notification | "Thông báo không tồn tại" |
| 409 | `IDEMPOTENCY_CONFLICT` | Idempotency-Key đã được xử lý | "Yêu cầu đã được xử lý trước đó" |
| 413 | `PAYLOAD_TOO_LARGE` | File upload vượt 50MB | "File quá lớn. Giới hạn 50MB" |
| 423 | `ACCOUNT_LOCKED` | Tài khoản bị khóa sau 5 lần fail | "Tài khoản tạm thời bị khóa. Thử lại sau 15 phút" |
| 429 | `RATE_LIMIT_EXCEEDED` | Vượt rate limit | "Quá nhiều yêu cầu. Vui lòng thử lại sau" |
| 500 | `INTERNAL_ERROR` | Lỗi server không xác định | "Đã xảy ra lỗi. Vui lòng thử lại" |
| 503 | `SERVICE_UNAVAILABLE` | Service tạm thời không khả dụng | "Dịch vụ đang bảo trì. Vui lòng thử lại sau" |

**Quy tắc Backend:** Nếu không có error code phù hợp → dùng `INTERNAL_ERROR` tạm thời + comment `// TODO: propose new error code to team`.

---

## 6. TypeScript Interfaces — WebSocket Events (Listening Party)

File vị trí: `services/frontend/src/types/listening-party.ts`

```typescript
// Listening Party WebSocket Event Contracts
// Generated from API_DESIGN_V2.md — DO NOT modify without updating backend

export type PartyEventType =
  | 'PLAYER_ACTION'
  | 'SYNC_STATE'
  | 'MEMBER_JOIN'
  | 'MEMBER_LEAVE'
  | 'HOST_CHANGED'
  | 'ROOM_CLOSED';

// Client → Server (chỉ Host được gửi PLAYER_ACTION)
export interface PlayerAction {
  type: 'PLAYER_ACTION';
  eventId: string;           // UUID v4 — dedup
  action: 'PLAY' | 'PAUSE' | 'SEEK';
  songId?: string;           // required khi action = PLAY
  positionSec?: number;      // required khi action = SEEK
  timestamp: string;         // ISO 8601
}

// Server → All Clients (broadcast khi Host thay đổi state)
export interface SyncState {
  type: 'SYNC_STATE';
  songId: string;
  isPlaying: boolean;
  positionSec: number;
  hostId: string;
  timestamp: string;         // ISO 8601 — dùng để tính drift
}

// Server → All Clients (khi có người join)
export interface MemberJoin {
  type: 'MEMBER_JOIN';
  userId: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: string;          // ISO 8601
}

// Server → All Clients (khi có người leave hoặc disconnect)
export interface MemberLeave {
  type: 'MEMBER_LEAVE';
  userId: string;
  reason: 'voluntary' | 'timeout' | 'error';
}

// Server → All Clients (khi Host disconnect và có member mới lên Host)
export interface HostChanged {
  type: 'HOST_CHANGED';
  newHostId: string;
  newHostDisplayName: string;
}

// Server → All Clients (khi room đóng)
export interface RoomClosed {
  type: 'ROOM_CLOSED';
  reason: 'host_disconnected' | 'manual';
}

export type PartyEvent =
  | PlayerAction
  | SyncState
  | MemberJoin
  | MemberLeave
  | HostChanged
  | RoomClosed;
```

**Hướng dẫn dùng trong Track A (tuần 7-8 — mock):**
```typescript
// services/frontend/src/hooks/usePartyWebSocket.ts
// Tuần 7-8: mock bằng setTimeout để simulate events
// Tuần 9: replace bằng SignalR connection thật

import type { PartyEvent, SyncState } from '../types/listening-party';

// Mock implementation (tuần 7-8)
export function usePartyWebSocket(roomId: string) {
  const sendAction = (action: PlayerAction) => {
    console.log('[MOCK WS] Sending:', action);
    // TODO tuần 9: replace with signalR.invoke('PlayerAction', action)
  };

  return { sendAction, isConnected: true };
}
```

---

## 7. Common curl Commands — Test Từng Service

```bash
# === HEALTH CHECKS ===
for port in 5000 5001 5002 5003 5004 5005 5006 5007 5008; do
  echo -n "Port $port: "; curl -s http://localhost:$port/health | jq .status
done
curl -s http://localhost:8000/health | jq .status  # Python service

# === AUTH ===
# Login
curl -s -c cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"listener@example.com","password":"Test1234!"}' | jq .

# Lấy access token từ response
ACCESS_TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"listener@example.com","password":"Test1234!"}' | jq -r '.data.accessToken')

# Refresh token (dùng cookie)
curl -s -b cookies.txt -X POST http://localhost:5000/api/v1/auth/refresh | jq .

# Logout
curl -s -b cookies.txt -X POST http://localhost:5000/api/v1/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# === USER ===
curl -s http://localhost:5000/api/v1/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# === STREAMING ===
SONG_ID="song-001"
curl -s "http://localhost:5000/api/v1/streaming/$SONG_ID/url" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# === RECOMMENDATIONS ===
curl -s "http://localhost:5000/api/v1/recommendations?context=morning&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# === SEARCH ===
curl -s "http://localhost:5000/api/v1/search?q=son+tung&type=song&limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# === NOTIFICATIONS ===
curl -s "http://localhost:5000/api/v1/notifications/unread?limit=10" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# === LISTENING PARTY ===
# Tạo party
curl -s -X POST http://localhost:5000/api/v1/parties \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"songId":"song-001"}' | jq .

# Join party (thay ABC123 bằng joinCode thật)
curl -s -X POST http://localhost:5000/api/v1/parties/ABC123/join \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .

# === ANALYTICS ===
curl -s -X POST http://localhost:5000/api/v1/analytics/events/play \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: evt-test-001' \
  -d '{"songId":"song-001","durationSec":180,"listenedSec":150,"platform":"web"}' | jq .

# Creator heatmap (cần Creator token)
curl -s "http://localhost:5000/api/v1/analytics/creator/heatmap/song-001?timeRange=7d" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq .
```

---

## 8. EF Core Migrations — Quy tắc chung

```bash
# Tạo migration mới (chạy trong thư mục service)
cd services/auth-service/src/Auth.Infrastructure
dotnet ef migrations add InitialCreate --startup-project ../Auth.Api

# Apply migration
dotnet ef database update --startup-project ../Auth.Api

# Rollback 1 migration
dotnet ef database update PreviousMigrationName --startup-project ../Auth.Api
```

**Quy tắc:**
- Không sửa migration đã commit — chỉ ADD migration mới
- Tên migration: PascalCase mô tả thay đổi (ví dụ: `AddRefreshTokenIndex`, `AddFollowsTable`)
- Khi 2 người conflict migration: người có migration sau phải `dotnet ef migrations remove` rồi regenerate sau khi merge
- Migration files không cần test (ngoại lệ theo testing-required/RULE.md)
- Không hardcode connection string — đọc từ env: `AUTH_DB_CONNECTION_STRING`
