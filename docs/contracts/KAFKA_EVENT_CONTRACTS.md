# KAFKA_EVENT_CONTRACTS.md

Tài liệu này là **source of truth** cho tất cả Kafka event contracts trong Smart Music Streaming Platform. Mọi producer và consumer PHẢI tuân thủ đúng schema, idempotency rules, và DLQ behavior được mô tả ở đây.

---

## Overview

| Topic | Event | Version | Producer | Consumer(s) | Delivery | Schema File |
|---|---|---|---|---|---|---|
| `Song_Played` | `SongPlayedEvent` | v1 | Streaming Service | Analytics, Recommendation | at-least-once | `kafka-schemas/song_played.v1.json` |
| `Song_Skipped` | `SongSkippedEvent` | v1 | Streaming Service | Analytics, Recommendation | at-least-once | `kafka-schemas/song_skipped.v1.json` |
| `New_Release` | `NewReleaseEvent` | v1 | Music Service | Notification | at-least-once | `kafka-schemas/new_release.v1.json` |
| `User_Preferences_Updated` | `UserPreferencesUpdatedEvent` | v1 | User Service | Recommendation | at-least-once | `kafka-schemas/user_preferences_updated.v1.json` |
| `Notification_Sent` | `NotificationSentEvent` | v1 | Notification Service | Analytics | best-effort | `kafka-schemas/notification_sent.v1.json` |

### Global Conventions

- **Timestamps**: ISO8601 UTC với milliseconds — ví dụ `"2026-04-15T08:23:11.452Z"`
- **IDs**: UUID v4 cho tất cả `event_id`, `user_id`, `song_id`, `artist_id`, `genre_id`, etc.
- **PII**: Tuyệt đối không đưa email, tên thật, số điện thoại vào event. Chỉ dùng anonymized UUID.
- **Forward compatibility**: `additionalProperties: true` — consumers PHẢI ignore các field không biết.
- **Message format**: JSON UTF-8, không nén (Phase 1).

---

## Event: SongPlayedEvent (Song_Played topic)

### Overview

| Field | Value |
|---|---|
| Topic | `Song_Played` |
| Version | v1 |
| Producer | Streaming Service |
| Consumers | Analytics Service, Recommendation Service |
| Delivery guarantee | at-least-once |
| Message key | `{userId}:{songId}` — đảm bảo ordering theo user trên cùng partition |
| Idempotency key (Analytics) | `event_id` → Redis `SETNX analytics:idempotency:{event_id} 1 EX 86400` |
| Idempotency key (Recommendation) | `event_id` → Redis `SETNX rec:idempotency:{event_id} 1 EX 86400` |
| Schema file | `kafka-schemas/song_played.v1.json` |

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | string (UUID v4) | Yes | Unique event ID dùng cho idempotency dedup |
| `version` | string | Yes | Schema version, luôn là `"v1"` |
| `timestamp` | string (ISO8601 UTC) | Yes | Thời điểm event được sinh ra |
| `correlation_id` | string (UUID v4) | Yes | Distributed tracing ID từ HTTP request gốc |
| `user_id` | string (UUID v4) | Yes | Anonymized user ID — không được chứa PII |
| `song_id` | string (UUID v4) | Yes | Bài hát được phát |
| `artist_id` | string (UUID v4) | Yes | Nghệ sĩ chính của bài hát |
| `genre_id` | string (UUID v4) | Yes | Genre chính — dùng để cập nhật weight trong Recommendation |
| `duration_sec` | integer | Yes | Tổng thời lượng bài hát (giây) |
| `listened_sec` | integer | Yes | Số giây user thực sự nghe |
| `duration_percent` | number (0–100) | Yes | Phần trăm đã nghe = `listened_sec / duration_sec * 100` |
| `context` | string | No | Context gợi ý: `"morning"`, `"afternoon"`, `"evening"`, `"night"`, `"none"` |
| `platform` | string | Yes | `"web"` (Phase 1 only) |
| `audio_quality` | string | No | `"standard"`, `"high"` — reserved for future use |

### Producer Contract (Streaming Service)

**Khi nào publish**: Sau khi nhận POST `/api/v1/analytics/events/play` từ client — KHÔNG publish khi issue pre-signed URL.

Streaming Service PHẢI:
- Set `event_id` là UUID v4 mới (fresh, không tái sử dụng)
- Set `version = "v1"`
- Không bao gồm bất kỳ PII nào (email, tên, số điện thoại)
- Include `correlation_id` từ HTTP request gốc
- Publish SAU khi nhận analytics event từ client, không phải khi cấp streaming URL

### Consumer Contracts

**Analytics Service:**
1. Check idempotency: `SETNX analytics:idempotency:{event_id} 1 EX 86400`
2. Nếu key đã tồn tại → skip (duplicate), commit Kafka offset
3. Ghi vào InfluxDB measurement `song_played` với tags: `song_id`, `artist_id`, `genre_id`, `user_id`, `platform`
4. Fields: `listened_sec`, `duration_sec`, `duration_percent`, `context`, `audio_quality`
5. On failure: retry 3 lần với Exponential Backoff (1s → 2s → 4s) → chuyển vào `Song_Played.DLQ` sau lần thứ 3

**Recommendation Service:**
1. Check idempotency: `SETNX rec:idempotency:{event_id} 1 EX 86400`
2. Nếu key đã tồn tại → skip
3. Nếu `duration_percent >= 80`: tăng genre weight → `HINCRBYFLOAT rec:weights:{user_id} {genre_id} 0.3`
4. Refresh TTL: `EXPIRE rec:weights:{user_id} 604800` (7 ngày)
5. Invalidate recommendation cache: `DEL rec:cache:{user_id}:*`
6. On failure: retry 3 lần → `Song_Played.DLQ`

### Realistic Example Payload

```json
{
  "event_id": "7f3a2c1e-8b4d-4e9f-a0c2-3d5e6f7a8b9c",
  "version": "v1",
  "timestamp": "2026-04-15T08:23:11.452Z",
  "correlation_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "song_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "artist_id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "genre_id": "d4e5f6a7-b8c9-0123-defa-234567890123",
  "duration_sec": 214,
  "listened_sec": 198,
  "duration_percent": 92.5,
  "context": "morning",
  "platform": "web",
  "audio_quality": "high"
}
```

---

## Event: SongSkippedEvent (Song_Skipped topic)

### Overview

| Field | Value |
|---|---|
| Topic | `Song_Skipped` |
| Version | v1 |
| Producer | Streaming Service |
| Consumers | Analytics Service, Recommendation Service |
| Delivery guarantee | at-least-once |
| Message key | `{userId}:{songId}` |
| Idempotency key (Analytics) | `event_id` → Redis `SETNX analytics:idempotency:{event_id} 1 EX 86400` |
| Idempotency key (Recommendation) | `event_id` → Redis `SETNX rec:idempotency:{event_id} 1 EX 86400` |
| Schema file | `kafka-schemas/song_skipped.v1.json` |

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | string (UUID v4) | Yes | Unique event ID dùng cho idempotency dedup |
| `version` | string | Yes | Schema version, luôn là `"v1"` |
| `timestamp` | string (ISO8601 UTC) | Yes | Thời điểm skip được thực hiện |
| `correlation_id` | string (UUID v4) | Yes | Distributed tracing ID từ HTTP request gốc |
| `user_id` | string (UUID v4) | Yes | Anonymized user ID |
| `song_id` | string (UUID v4) | Yes | Bài hát bị skip |
| `artist_id` | string (UUID v4) | Yes | Nghệ sĩ chính của bài hát |
| `genre_id` | string (UUID v4) | Yes | Genre chính — dùng để tính weight penalty |
| `skip_at_sec` | integer | Yes | Vị trí phát (giây) tại thời điểm skip |
| `duration_sec` | integer | Yes | Tổng thời lượng bài hát (giây) |
| `duration_percent` | number (0–100) | Yes | Phần trăm đã nghe trước khi skip = `skip_at_sec / duration_sec * 100` |
| `skip_trigger` | string | No | `"manual_skip"`, `"next_button"`, `"auto_skip"` (reserved) |
| `context` | string | No | Context: `"morning"`, `"afternoon"`, `"evening"`, `"night"`, `"none"` |
| `platform` | string | Yes | `"web"` (Phase 1 only) |

### Producer Contract (Streaming Service)

**Khi nào publish**: Sau khi nhận POST `/api/v1/analytics/events/skip` từ client.

Streaming Service PHẢI:
- Set `event_id` là UUID v4 mới
- Set `skip_at_sec` chính xác theo vị trí playback khi skip xảy ra
- Không bao gồm PII

### Consumer Contracts

**Analytics Service:**
1. Check idempotency: `SETNX analytics:idempotency:{event_id} 1 EX 86400`
2. Nếu key đã tồn tại → skip, commit offset
3. Ghi vào InfluxDB measurement `song_skipped` với tags: `song_id`, `artist_id`, `genre_id`, `user_id`, `platform`, `skip_trigger`
4. Fields: `skip_at_sec`, `duration_sec`, `duration_percent`, `context`
5. On failure: retry 3 lần (Exponential Backoff 1s → 2s → 4s) → `Song_Skipped.DLQ`

**Recommendation Service:**
1. Check idempotency: `SETNX rec:idempotency:{event_id} 1 EX 86400`
2. Nếu key đã tồn tại → skip
3. Nếu `duration_percent < 30`: áp dụng weight penalty → `HINCRBYFLOAT rec:weights:{user_id} {genre_id} -0.2`
4. Refresh TTL: `EXPIRE rec:weights:{user_id} 604800`
5. Invalidate recommendation cache: `DEL rec:cache:{user_id}:*`
6. On failure: retry 3 lần → `Song_Skipped.DLQ`

### Realistic Example Payload

```json
{
  "event_id": "9e8d7c6b-5a4f-3e2d-1c0b-9a8f7e6d5c4b",
  "version": "v1",
  "timestamp": "2026-04-15T14:37:22.891Z",
  "correlation_id": "f1e2d3c4-b5a6-9780-fedc-ba9876543210",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "song_id": "e5f6a7b8-c9d0-1234-efab-567890123456",
  "artist_id": "f6a7b8c9-d0e1-2345-fabc-678901234567",
  "genre_id": "a7b8c9d0-e1f2-3456-abcd-789012345678",
  "skip_at_sec": 18,
  "duration_sec": 198,
  "duration_percent": 9.1,
  "skip_trigger": "manual_skip",
  "context": "afternoon",
  "platform": "web"
}
```

---

## Event: NewReleaseEvent (New_Release topic)

### Overview

| Field | Value |
|---|---|
| Topic | `New_Release` |
| Version | v1 |
| Producer | Music Service |
| Consumers | Notification Service |
| Delivery guarantee | at-least-once |
| Message key | `{artistId}` — tất cả release của cùng artist trên cùng partition |
| Idempotency key (Notification) | `event_id` → Redis `SETNX notif:idempotency:{event_id} 1 EX 86400` |
| Schema file | `kafka-schemas/new_release.v1.json` |

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | string (UUID v4) | Yes | Unique event ID |
| `version` | string | Yes | `"v1"` |
| `timestamp` | string (ISO8601 UTC) | Yes | Thời điểm bài hát được publish |
| `correlation_id` | string (UUID v4) | Yes | Distributed tracing ID từ upload request |
| `artist_id` | string (UUID v4) | Yes | Creator đã upload |
| `artist_name` | string | Yes | Tên hiển thị — dùng trong nội dung notification |
| `song_id` | string (UUID v4) | Yes | Bài hát mới vừa publish |
| `song_title` | string | Yes | Tên bài hát — dùng trong nội dung notification |
| `album_id` | string (UUID v4) or null | No | Album chứa bài hát. Null nếu là single |
| `genre_ids` | array of UUID | Yes (min 1) | Danh sách genre — dùng để target followers |
| `mood_tags` | array of string | No | Tags vibe như `["energetic", "focus"]` |
| `thumbnail_url` | string (URI) | Yes | CDN URL thumbnail dùng trong notification |
| `s3_storage_key` | string | Yes | S3 key nội bộ — consumers KHÔNG được expose ra ngoài |
| `duration_sec` | integer | Yes | Thời lượng bài hát (giây) |
| `explicit` | boolean | Yes | Có nội dung explicit không |

### Producer Contract (Music Service)

**Khi nào publish**: CHỈ sau khi **cả hai** điều kiện sau đúng:
1. S3 upload confirm thành công (HTTP 200 từ S3/MinIO)
2. Metadata đã commit vào PostgreSQL/MongoDB

Nếu S3 fail → rollback DB → KHÔNG publish event. Nếu DB commit fail sau khi S3 thành công → compensate (xóa S3 object) → KHÔNG publish.

### Consumer Contracts

**Notification Service:**
1. Check idempotency: `SETNX notif:idempotency:{event_id} 1 EX 86400`
2. Nếu key đã tồn tại → skip, commit offset
3. Gọi User Service: `GET /internal/artists/{artist_id}/followers` để lấy danh sách follower IDs
4. Fan-out: với mỗi follower, insert notification document vào MongoDB collection `notifications`
5. Sau mỗi insert thành công → publish `NotificationSentEvent` lên `Notification_Sent` topic
6. Nếu insert thất bại cho một follower: retry 3 lần per-follower (Exponential Backoff) → log vào `New_Release.DLQ` per entry
7. **Lưu ý**: `s3_storage_key` trong payload là thông tin nội bộ — KHÔNG đưa vào notification document gửi cho user

### Realistic Example Payload

```json
{
  "event_id": "2a3b4c5d-6e7f-8901-2345-6789abcdef01",
  "version": "v1",
  "timestamp": "2026-04-15T10:05:00.000Z",
  "correlation_id": "b1c2d3e4-f5a6-7890-bcde-f09876543210",
  "artist_id": "11223344-5566-7788-99aa-bbccddeeff00",
  "artist_name": "Son Tung M-TP",
  "song_id": "aabbccdd-eeff-0011-2233-445566778899",
  "song_title": "Chung Ta Cua Hien Tai",
  "album_id": null,
  "genre_ids": ["d4e5f6a7-b8c9-0123-defa-234567890123"],
  "mood_tags": ["melancholic", "emotional"],
  "thumbnail_url": "https://cdn.smartmusic.example.com/thumbnails/aabbccdd.jpg",
  "s3_storage_key": "audio/2026/04/aabbccdd-eeff-0011-2233-445566778899.mp3",
  "duration_sec": 287,
  "explicit": false
}
```

---

## Event: UserPreferencesUpdatedEvent (User_Preferences_Updated topic)

### Overview

| Field | Value |
|---|---|
| Topic | `User_Preferences_Updated` |
| Version | v1 |
| Producer | User Service |
| Consumers | Recommendation Service |
| Delivery guarantee | at-least-once |
| Message key | `{userId}` |
| Idempotency key (Recommendation) | `event_id` → Redis `SETNX rec:idempotency:{event_id} 1 EX 86400` |
| Schema file | `kafka-schemas/user_preferences_updated.v1.json` |

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | string (UUID v4) | Yes | Unique event ID |
| `version` | string | Yes | `"v1"` |
| `timestamp` | string (ISO8601 UTC) | Yes | Thời điểm preferences được commit |
| `correlation_id` | string (UUID v4) | Yes | Distributed tracing ID từ HTTP request gốc |
| `user_id` | string (UUID v4) | Yes | Anonymized user ID |
| `preferred_genres` | array of objects | Yes (min 3) | Danh sách genre với `genre_id` và `genre_name` |
| `preferred_genres[].genre_id` | string (UUID v4) | Yes | UUID của genre |
| `preferred_genres[].genre_name` | string | Yes | Tên genre để hiển thị |
| `preferred_artist_ids` | array of UUID | Yes (min 1) | Danh sách artist ID user follow/prefer |
| `is_onboarding` | boolean | Yes | `true` = lần đầu tiên, `false` = update sau này |
| `idempotency_key` | string | Yes | Giá trị header `Idempotency-Key` từ HTTP request gốc |

### Producer Contract (User Service)

**Khi nào publish**: Sau khi `POST /api/v1/users/me/preferences` thành công và dữ liệu đã được commit vào PostgreSQL.

User Service PHẢI:
- Include toàn bộ danh sách genres và artists (không phải diff)
- Set `is_onboarding = true` chỉ cho lần submit đầu tiên trong onboarding flow (UC-03)
- Forward `Idempotency-Key` header từ HTTP request vào field `idempotency_key`

### Consumer Contracts

**Recommendation Service:**
1. Check idempotency: `SETNX rec:idempotency:{event_id} 1 EX 86400`
2. Nếu key đã tồn tại → skip
3. Với mỗi genre trong `preferred_genres`: `HSET rec:weights:{user_id} {genre_id} 1.0` (baseline weight)
4. Lưu onboarding snapshot: `SET rec:onboarding:{user_id} {json_payload} EX 604800` (7 ngày)
5. Set TTL cho weights: `EXPIRE rec:weights:{user_id} 604800`
6. Invalidate recommendation cache: `DEL rec:cache:{user_id}:*`
7. Nếu `is_onboarding = false`: merge weights (giữ existing weights, chỉ thêm genre mới)
8. On failure: retry 3 lần → `User_Preferences_Updated.DLQ`

### Realistic Example Payload

```json
{
  "event_id": "3c4d5e6f-7a8b-9012-3456-789abcdef012",
  "version": "v1",
  "timestamp": "2026-04-15T09:00:30.123Z",
  "correlation_id": "c2d3e4f5-a6b7-8901-cdef-0123456789ab",
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "preferred_genres": [
    { "genre_id": "d4e5f6a7-b8c9-0123-defa-234567890123", "genre_name": "Indie Pop" },
    { "genre_id": "e5f6a7b8-c9d0-1234-efab-567890123456", "genre_name": "Acoustic" },
    { "genre_id": "f6a7b8c9-d0e1-2345-fabc-678901234567", "genre_name": "Lo-fi" }
  ],
  "preferred_artist_ids": [
    "11223344-5566-7788-99aa-bbccddeeff00",
    "22334455-6677-8899-aabb-ccddeeff0011"
  ],
  "is_onboarding": true,
  "idempotency_key": "onboarding-a1b2c3d4-20260415"
}
```

---

## Event: NotificationSentEvent (Notification_Sent topic)

### Overview

| Field | Value |
|---|---|
| Topic | `Notification_Sent` |
| Version | v1 |
| Producer | Notification Service |
| Consumers | Analytics Service |
| Delivery guarantee | **best-effort** (không đảm bảo at-least-once) |
| Message key | `{recipientUserId}` |
| Idempotency | Không áp dụng — Analytics consumer không cần dedup cho topic này |
| Schema file | `kafka-schemas/notification_sent.v1.json` |

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `event_id` | string (UUID v4) | Yes | Unique event ID |
| `version` | string | Yes | `"v1"` |
| `timestamp` | string (ISO8601 UTC) | Yes | Thời điểm fan-out attempt này xảy ra |
| `correlation_id` | string (UUID v4) | Yes | Same correlation_id từ `NewReleaseEvent` gốc |
| `notification_id` | string | Yes | MongoDB ObjectId của notification document |
| `recipient_user_id` | string (UUID v4) | Yes | User nhận notification — anonymized |
| `notification_type` | string | Yes | `"NEW_RELEASE"` hoặc `"SYSTEM"` |
| `artist_id` | string (UUID v4) or null | No | Populated cho `NEW_RELEASE`. Null cho `SYSTEM` |
| `song_id` | string (UUID v4) or null | No | Populated cho `NEW_RELEASE`. Null cho `SYSTEM` |
| `delivery_status` | string | Yes | `"DELIVERED"`, `"FAILED"`, `"PENDING"` |
| `retry_count` | integer (0–3) | Yes | Số lần retry trước khi publish event này |
| `channel` | string | Yes | `"IN_APP"` (Phase 1 only) |

### Producer Contract (Notification Service)

**Khi nào publish**: Sau **mỗi** fan-out attempt — kể cả thành công và thất bại.

Notification Service PHẢI:
- Publish một event cho mỗi recipient (không batch)
- Set `delivery_status = "DELIVERED"` nếu MongoDB insert thành công
- Set `delivery_status = "FAILED"` và `retry_count = 3` nếu tất cả retries thất bại
- Giữ nguyên `correlation_id` từ `NewReleaseEvent` gốc để trace toàn bộ fan-out flow

### Consumer Contracts

**Analytics Service:**
1. Không cần check idempotency (topic là best-effort)
2. Ghi vào InfluxDB measurement `notification_delivery` với tags: `notification_type`, `delivery_status`, `channel`, `artist_id` (nếu có)
3. Fields: `retry_count`, `recipient_user_id`
4. Dùng để tính notification delivery rate, failed notification rate
5. Lỗi analytics KHÔNG trigger DLQ — best-effort, log ERROR và tiếp tục

### Realistic Example Payload

```json
{
  "event_id": "4d5e6f7a-8b9c-0123-4567-89abcdef0123",
  "version": "v1",
  "timestamp": "2026-04-15T10:05:03.551Z",
  "correlation_id": "b1c2d3e4-f5a6-7890-bcde-f09876543210",
  "notification_id": "507f1f77bcf86cd799439011",
  "recipient_user_id": "f7a8b9c0-d1e2-3456-fabc-def012345678",
  "notification_type": "NEW_RELEASE",
  "artist_id": "11223344-5566-7788-99aa-bbccddeeff00",
  "song_id": "aabbccdd-eeff-0011-2233-445566778899",
  "delivery_status": "DELIVERED",
  "retry_count": 0,
  "channel": "IN_APP"
}
```

---

## DLQ (Dead Letter Queue) Behavior

Áp dụng cho tất cả topics có delivery guarantee là `at-least-once`. Topic `Notification_Sent` (best-effort) không dùng DLQ.

### Retry Schedule

| Bước | Hành động |
|---|---|
| Attempt 1 | Xử lý event ngay lập tức |
| Failure 1 | Chờ 1 giây, retry lần 1 |
| Failure 2 | Chờ 2 giây, retry lần 2 |
| Failure 3 | Chờ 4 giây, retry lần 3 |
| Failure 4 | Chuyển message vào DLQ topic: `{original_topic}.DLQ` |
| DLQ retention | 7 ngày |
| DLQ alerting | Log `ERROR` level với đầy đủ context |

### DLQ Topic Names

| Original Topic | DLQ Topic |
|---|---|
| `Song_Played` | `Song_Played.DLQ` |
| `Song_Skipped` | `Song_Skipped.DLQ` |
| `New_Release` | `New_Release.DLQ` |
| `User_Preferences_Updated` | `User_Preferences_Updated.DLQ` |

### DLQ Log Format

Mỗi lần move sang DLQ, consumer PHẢI log:
```
ERROR [DLQ] topic={topic} event_id={event_id} consumer_group={group} 
      attempt=4 failure_reason={exception_message} timestamp={iso8601}
```

### DLQ Recovery

- DLQ messages được retain 7 ngày
- Team có thể replay thủ công hoặc xây automation consumer riêng cho DLQ
- Trước khi replay: fix nguyên nhân gốc (bug code, infra issue)
- Khi replay: idempotency check vẫn áp dụng — safe để replay multiple times

---

## Backward Compatibility Rules

### Nguyên tắc cốt lõi

- **Producers**: PHẢI chỉ ADD fields mới — không được rename, remove, hoặc thay đổi type
- **Consumers**: PHẢI ignore các field không biết (`additionalProperties: true` trong schema)
- **Version field**: Consumers có thể route theo `version` nếu cần xử lý khác nhau

### Thay đổi SAFE (backward compatible — không cần bump version)

```
SAFE changes:
  ✅ Thêm một optional field mới vào event
  ✅ Thêm một giá trị enum mới (consumers phải handle unknown values gracefully)
  ✅ Tăng max length của một string field
  ✅ Thêm giá trị mới vào array field
```

Ví dụ SAFE: thêm field `playlist_id` (optional) vào `SongPlayedEvent`:
```json
// v1 consumer sẽ ignore field này — OK
{
  "event_id": "...",
  "version": "v1",
  "playlist_id": "new-optional-field-uuid"   // consumers cũ ignore, consumers mới xử lý
}
```

### Thay đổi BREAKING (cần tạo v2)

```
BREAKING changes — phải tạo schema v2:
  ❌ Đổi tên một field (rename)
  ❌ Xóa một field đã có
  ❌ Thay đổi type của field (string → integer)
  ❌ Biến optional field thành required
  ❌ Thay đổi ý nghĩa của enum value hiện có
```

Ví dụ BREAKING: đổi `duration_percent` (number) thành `duration_pct` (string) — phải tạo v2.

### Quy trình tạo v2

1. Tạo schema file mới: `kafka-schemas/song_played.v2.json`
2. Publish v2 events song song với v1 (dual-publish)
3. Chờ tất cả consumers migrate sang hỗ trợ v2 (tối thiểu 2 tuần overlap)
4. Sau khi confirm: deprecate v1, ngừng dual-publish
5. Update `KAFKA_EVENT_CONTRACTS.md` ghi nhận deprecation date

---

## Versioning Strategy

| Scenario | Action |
|---|---|
| Thêm optional field | Không cần bump version — thêm field, cập nhật schema file và docs |
| Thêm required field | BREAKING — phải tạo v2 |
| Đổi tên field | BREAKING — phải tạo v2 |
| Thêm enum value | Soft break — thêm value, consumers PHẢI handle unknown gracefully |
| Thay đổi type field | BREAKING — phải tạo v2 |
| Xóa field | BREAKING — phải tạo v2 |

### Consumer Best Practice cho Enum

Consumers KHÔNG được fail hard khi gặp enum value không biết. Thay vào đó:

```csharp
// C# example — correct pattern
var skipTrigger = payload.SkipTrigger switch
{
    "manual_skip" => SkipTrigger.Manual,
    "next_button"  => SkipTrigger.NextButton,
    _              => SkipTrigger.Unknown  // handle gracefully, log warning
};
```

```python
# Python example — correct pattern
skip_trigger = payload.get("skip_trigger", "unknown")
if skip_trigger not in KNOWN_SKIP_TRIGGERS:
    logger.warning(f"Unknown skip_trigger value: {skip_trigger} — ignoring")
```
