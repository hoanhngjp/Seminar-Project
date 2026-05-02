# week5_6_search_analytics_notification.md — Search + Analytics + Notification

> Mục tiêu cuối tuần 6: Creator thấy được heatmap skip-rate sau khi có play/skip events
>
> Port mapping và curl commands: xem `.claude/plan/shared_contracts.md`
> Error codes: xem `.claude/plan/shared_contracts.md` Section 5
> Elasticsearch setup: xem `.claude/plan/shared_contracts.md` Section 3

---

## Dependency Graph

```
Tuần 5:
  Elasticsearch index setup + seed 10 songs
      ↓
  Search Service (stateless, gọi Elasticsearch)

  Analytics Service (InfluxDB + Kafka consumers)
      ← Song_Played, Song_Skipped, Notification_Sent

Tuần 6:
  Notification Service (MongoDB + Kafka consumer New_Release)
  Kafka wiring verify: tất cả consumer groups hoạt động
```

---

## Bước 0 — Elasticsearch Setup (Làm trước Search Service)

### Verify Elasticsearch đang chạy
```bash
curl http://localhost:9200/_cluster/health
# Expected: { "status": "green" | "yellow", ... }
# Yellow là OK cho single-node local dev
```

### Tạo index mapping + seed data
Chạy commands từ `.claude/plan/shared_contracts.md` Section 3:

```bash
# 1. Tạo index với mapping
curl -X PUT http://localhost:9200/songs -H 'Content-Type: application/json' -d '{
  "mappings": {
    "properties": {
      "id":          { "type": "keyword" },
      "title":       { "type": "text", "analyzer": "standard" },
      "artist":      { "type": "text", "analyzer": "standard" },
      "album":       { "type": "text" },
      "genre":       { "type": "keyword" },
      "mood":        { "type": "keyword" },
      "language":    { "type": "keyword" },
      "is_explicit": { "type": "boolean" },
      "is_published":{ "type": "boolean" },
      "play_count":  { "type": "long" }
    }
  }
}'

# 2. Seed 10 sample songs (xem shared_contracts.md Section 3 cho full command)

# 3. Verify fuzzy search
curl "http://localhost:9200/songs/_search?q=son+tug&pretty"
# Expected: hits cho "Sơn Tùng M-TP"

curl "http://localhost:9200/songs/_search?q=noi+nay&pretty"
# Expected: hits cho "Nơi này có anh"
```

Seed script đầy đủ: `infra/seed/elasticsearch_seed.sh`

---

## Search Service (Tuần 5)

### Làm trước khi bắt đầu
Đọc: `docs/originals/API_DESIGN_V2.md` (Search endpoint), `database/DATABASE_SCHEMA.md`

### Lưu ý
Search Service là **stateless** — không có database riêng. Chỉ gọi Elasticsearch.

### Endpoint cần implement

**GET /api/v1/search**
- Auth: Bearer JWT required
- Query params: `q` (required), `type` (song|artist|all, default all), `limit` (max 20, default 10), `cursor` (pagination)
- Response 200: `{ success, data: { items: [...], nextCursor: string|null, hasMore: boolean }, meta: { cache: "HIT|MISS" } }`
- Khi không có kết quả: trả `[]` — không trả lỗi
- Cache: Redis TTL 10 phút cho frequent queries, key: `search:cache:{hash(q+type+limit)}`
- Elasticsearch: fuzzy match, fuzziness: "AUTO", fields: [title^3, artist^2, album]
- Fallback nếu Elasticsearch timeout: trả `[]` — không crash, log warning
- Latency budget: 200ms

### Acceptance Criteria cần pass
- AC5.1.1: query "son tug" → kết quả "Sơn Tùng M-TP" với relevance score
- AC5.1.2: response < 200ms (với cache hit)
- AC5.1.3: no results → `[]`, không trả error
- AC5.1.4: response có nextCursor và hasMore cho pagination

### Prompt dùng với Claude

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, api-contract-first/RULE.md,
security-non-negotiable/RULE.md, và testing-required/RULE.md đính kèm.

Implement Search Service (services/search-service/) với:
GET /api/v1/search?q=...&type=song&limit=10&cursor=...

Yêu cầu:
- Elasticsearch fuzzy search: fuzziness AUTO, fields title^3/artist^2/album
- Redis cache TTL 600s: key search:cache:{sha256(q+type+limit)}
- Cursor pagination: nextCursor = base64(lastHitId + lastScore)
- Fallback nếu Elasticsearch timeout: return [] (không throw, log warning)
- Không có database riêng — stateless service

Acceptance Criteria:
- AC5.1.1: "son tug" → hits "Sơn Tùng M-TP"
- AC5.1.2: cache hit < 50ms, cold < 200ms
- AC5.1.3: no results → [] không phải error
- AC5.1.4: nextCursor và hasMore trong response

Elasticsearch config từ env:
- ELASTICSEARCH_URL=http://localhost:9200
- ELASTICSEARCH_INDEX=songs

Bắt đầu bằng Elasticsearch setup verify trước khi viết code:
  curl http://localhost:9200/songs/_search?q=son+tug
Sau đó điền Contract-First Checklist 8 ô.
```

### Definition of Done

- [ ] AC5.1.1: `curl "http://localhost:5000/api/v1/search?q=son+tug"` → response có "Sơn Tùng M-TP"
- [ ] AC5.1.3: `curl "http://localhost:5000/api/v1/search?q=xyznonexistent"` → `{"data":{"items":[],...}}`
- [ ] AC5.1.4: response có `nextCursor` và `hasMore` fields
- [ ] Unit tests: mock Elasticsearch client và Redis
- Thời gian ước tính: **1 ngày**

---

## Analytics Service (Tuần 5)

### Làm trước khi bắt đầu
Đọc: `docs/originals/API_DESIGN_V2.md` (Analytics endpoints), `database/DATABASE_SCHEMA.md` (InfluxDB schema), `docs/contracts/KAFKA_EVENT_CONTRACTS.md`, `.github/REDIS_KEY_DESIGN.md`

### Database: InfluxDB (port 8086)
Measurements: `song_played`, `song_skipped`
Schema: `database/DATABASE_SCHEMA.md` (phần InfluxDB)
**PII rule: chỉ lưu `userId` (UUID) — KHÔNG lưu email, username, họ tên.**

### Endpoints cần implement

**1. POST /api/v1/analytics/events/play**
- Auth: Bearer JWT required
- Idempotency-Key: required header
- Body: `{ songId, durationSec, listenedSec, platform }`
- Response: **202 Accepted ngay** — không block
- Flow async (background): publish Song_Played event lên Kafka, sau đó write vào InfluxDB
- Errors: 409 IDEMPOTENCY_CONFLICT (kiểm tra Redis key `analytics:idem:{idempotencyKey}` TTL 24h)
- Latency budget: 50ms (trả 202 ngay)

**2. GET /api/v1/analytics/creator/heatmap/{songId}**
- Auth: Bearer JWT, Role: Creator (ownership check) hoặc Admin
- Query param: `timeRange` (7d|30d)
- Response 200: `{ success, data: { heatmap: [{ second: number, skipRate: number }] }, meta: { cache: "HIT|MISS" } }`
- Redis cache TTL 6h, key: `heatmap:{songId}:{timeRange}`
- Ownership check: `song.artistId == currentUserId` (gọi Music Service internal)
- Fallback nếu timeout: serve stale cache; nếu không có cache: `{ heatmap: [] }` + warning
- Latency budget: 500ms

**3. GET /api/v1/analytics/creator/stats/{songId}**
- Auth: Bearer JWT, Role: Creator (ownership) hoặc Admin
- Response 200: `{ success, data: { totalPlays, totalSkips, uniqueListeners, avgListenPercent, dailyPlays: [...] }, meta }`
- Redis cache TTL 6h, key: `stats:{songId}`
- Latency budget: 500ms

### Kafka Consumers cần setup

**Consumer 1: Song_Played**
- Topic: `Song_Played`, Consumer group: `analytics-service`
- Logic:
  1. Idempotency: `SETNX dedup:analytics:Song_Played:{eventId} 1 EX 86400`
  2. Write vào InfluxDB measurement `song_played`:
     - Tags: song_id, artist_id, genre_id, user_id (UUID), platform
     - Fields: duration_sec, listened_sec, duration_percent, session_id
  3. DLQ sau 3 retries

**Consumer 2: Song_Skipped**
- Topic: `Song_Skipped`, Consumer group: `analytics-service`
- Logic:
  1. Idempotency check
  2. Write vào InfluxDB measurement `song_skipped`:
     - Tags: song_id, artist_id, genre_id, user_id (UUID), skip_trigger
     - Fields: duration_sec, skip_at_sec, duration_percent

**Consumer 3: Notification_Sent**
- Topic: `Notification_Sent`, Consumer group: `analytics-service`
- Logic: increment notification delivery counter trong InfluxDB

### Acceptance Criteria cần pass
- AC4.1.1: stream start → Song_Played Kafka event
- AC4.1.2: song skipped → Song_Skipped Kafka event với timestamp
- AC4.1.3: duplicate eventId → skip (idempotency)
- AC4.1.4: endpoint trả 202 ngay — không block streaming
- AC4.2.1: Creator xem heatmap → data theo từng giây
- AC4.2.2: Dashboard có DAL và Unique Users
- AC4.2.3: non-Creator cố truy cập → 403 FORBIDDEN
- AC4.2.4: heatmap < 500ms (cache Redis TTL 6h)

### Prompt dùng với Claude

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, api-contract-first/RULE.md,
security-non-negotiable/RULE.md, và testing-required/RULE.md đính kèm.

Implement Analytics Service (services/analytics-service/) với:
1. POST /api/v1/analytics/events/play — 202 async, publish Kafka + write InfluxDB
2. GET /api/v1/analytics/creator/heatmap/{songId}?timeRange=7d — Redis cache 6h
3. GET /api/v1/analytics/creator/stats/{songId} — Redis cache 6h
4. Kafka consumer: Song_Played → write InfluxDB song_played measurement
5. Kafka consumer: Song_Skipped → write InfluxDB song_skipped measurement
6. Kafka consumer: Notification_Sent → increment counter

Acceptance Criteria:
- AC4.1.3: duplicate eventId (Idempotency-Key) → 409 IDEMPOTENCY_CONFLICT
- AC4.1.4: POST /events/play → 202 ngay, không đợi Kafka/InfluxDB
- AC4.2.3: Listener cố truy cập heatmap → 403 FORBIDDEN
- AC4.2.4: cache hit < 500ms

PII rule bắt buộc: Analytics chỉ lưu userId (UUID) — KHÔNG lưu email, username.
InfluxDB config từ env: INFLUXDB_URL, INFLUXDB_TOKEN, INFLUXDB_ORG, INFLUXDB_BUCKET

Idempotency pattern:
- Check Redis SETNX analytics:idem:{idempotencyKey} 1 EX 86400
- Nếu đã tồn tại → 409 IDEMPOTENCY_CONFLICT
- Fallback khi Kafka down: ghi vào local disk queue (append to /tmp/analytics-dlq.jsonl)

RBAC + Ownership check cho Creator endpoints:
- Lấy song.artistId từ Music Service: GET http://music-service/internal/songs/{songId}
- So sánh với JWT claim userId
- Admin bỏ qua ownership check

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trước khi viết code.
```

### Definition of Done

- [ ] AC4.1.4: `curl -X POST .../analytics/events/play` → response trong < 50ms (dùng `time curl`)
- [ ] AC4.1.3: gửi cùng Idempotency-Key 2 lần → lần 2 nhận 409
- [ ] AC4.2.3: dùng Listener token gọi `/creator/heatmap/` → 403
- [ ] AC4.2.4: gọi heatmap lần 2 → `meta.cache = "HIT"`
- [ ] Unit tests: mock InfluxDB client, mock Kafka, mock Redis
- [ ] Verify InfluxDB write: `curl http://localhost:8086/api/v2/query` với Flux query
- Thời gian ước tính: **2 ngày**

---

## Notification Service (Tuần 6)

### Làm trước khi bắt đầu
Đọc: `docs/originals/API_DESIGN_V2.md` (Notification endpoints), `database/DATABASE_SCHEMA.md` (MongoDB schema), `docs/contracts/KAFKA_EVENT_CONTRACTS.md`

### Database: MongoDB (port 27017)
Collections: `notifications`, `subscriptions`
Schema: `database/DATABASE_SCHEMA.md`

### Endpoints cần implement

**1. GET /api/v1/notifications/unread**
- Auth: Bearer JWT required
- Query params: `limit` (max 50), `cursor`
- Response 200: `{ success, data: { items: [...], nextCursor, hasMore }, meta }`
- Filter: `recipientId == currentUserId AND status IN ["pending", "delivered"]`
- Latency budget: 150ms

**2. PATCH /api/v1/notifications/{id}/read**
- Auth: Bearer JWT required
- Idempotency-Key: required (TTL 24h)
- Response 200: `{ success, data: { notificationId, readAt }, meta }`
- Set: `status = "read"`, `readAt = now()`
- Errors: 404 NOTIFICATION_NOT_FOUND, 409 IDEMPOTENCY_CONFLICT
- Latency budget: 150ms

**3. PATCH /api/v1/notifications/read-all**
- Auth: Bearer JWT required
- Response 202: `{ success, data: { queued: true }, meta }`
- Async: bulk update tất cả unread notifications của user → "read"
- Latency budget: 200ms (trả 202 ngay, bulk update background)

### Kafka Consumer cần setup

**Consumer: New_Release**
- Topic: `New_Release`, Consumer group: `notification-service`
- Logic (fan-out):
  1. Lấy artistId từ event payload
  2. Lấy danh sách followers của artist từ User Service: `GET http://user-service/internal/artists/{artistId}/followers`
  3. Với mỗi follower: tạo notification document trong MongoDB
  4. Publish `Notification_Sent` event (v1) lên Kafka
  5. DLQ sau 3 retries nếu fan-out fail

### Acceptance Criteria cần pass
- AC6.1.1: New_Release event → fan-out notifications tới tất cả followers
- AC6.1.2: GET /notifications/unread → cursor pagination
- AC6.1.3: PATCH /{id}/read → idempotent (dùng lại Idempotency-Key → 409)

### Prompt dùng với Claude

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, api-contract-first/RULE.md,
security-non-negotiable/RULE.md, và testing-required/RULE.md đính kèm.

Implement Notification Service (services/notification-service/) với:
1. GET /api/v1/notifications/unread — cursor pagination
2. PATCH /api/v1/notifications/{id}/read — idempotent với Idempotency-Key
3. PATCH /api/v1/notifications/read-all — 202 async
4. Kafka consumer: New_Release → fan-out tới followers

Acceptance Criteria:
- AC6.1.1: New_Release event → MongoDB document tạo cho mỗi follower
- AC6.1.2: GET với cursor pagination (nextCursor, hasMore)
- AC6.1.3: PATCH /{id}/read với cùng Idempotency-Key → 409 lần 2

MongoDB config từ env: MONGODB_CONNECTION_STRING, MONGODB_DATABASE=notification_db
Kafka consumer group: notification-service

Fan-out logic:
- Gọi GET http://user-service/internal/artists/{artistId}/followers?limit=1000
- Nếu > 1000 followers: paginate (cursor-based) để lấy hết
- Tạo notification cho mỗi follower (bulk insert MongoDB)
- Sau khi fan-out: publish Notification_Sent event v1

Idempotency PATCH /{id}/read:
- Redis SETNX notification:idem:{idempotencyKey} 1 EX 86400
- Nếu tồn tại → 409 IDEMPOTENCY_CONFLICT

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trước khi viết code.
```

### Definition of Done

- [ ] AC6.1.1: publish New_Release event → MongoDB có documents mới cho followers
- [ ] AC6.1.2: `curl .../notifications/unread` → có `nextCursor` và `hasMore`
- [ ] AC6.1.3: PATCH với cùng Idempotency-Key 2 lần → lần 2 nhận 409
- [ ] Unit tests: mock MongoDB, mock Kafka, mock HTTP (User Service call)
- Thời gian ước tính: **1.5 ngày**

---

## Kafka Wiring Verify — Cuối Tuần 6

### Consumer groups cần có sau tuần 5-6

| Consumer Group | Topics consumed | Service |
|---------------|-----------------|---------|
| `analytics-service` | Song_Played, Song_Skipped, Notification_Sent | Analytics |
| `recommendation-service` | Song_Played, Song_Skipped, User_Preferences_Updated | Recommendation |
| `notification-service` | New_Release | Notification |

### Verify consumer groups
```bash
# List consumer groups
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list
# Expected: analytics-service, recommendation-service, notification-service

# Check lag cho analytics-service
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group analytics-service
# Expected: LAG = 0 hoặc nhỏ (nếu không có pending messages)
```

### Idempotency pattern — verify
```bash
# Publish Song_Played event với cùng eventId 2 lần
# Dùng Kafka UI (http://localhost:8080) để publish manual

# Kiểm tra InfluxDB — chỉ có 1 record
curl -X POST http://localhost:8086/api/v2/query \
  -H "Authorization: Token $INFLUXDB_TOKEN" \
  -H 'Content-Type: application/vnd.flux' \
  -d 'from(bucket:"analytics") |> range(start: -1h) |> filter(fn:(r) => r._measurement == "song_played") |> count()'
# Expected: count = 1, không phải 2
```

### DLQ setup verify
```bash
# Verify DLQ topic tồn tại
kafka-topics.sh --bootstrap-server localhost:9092 --list | grep dlq
# Expected: analytics-service-dlq, recommendation-service-dlq, notification-service-dlq
```

---

## Checkpoint Cuối Tuần 6 — Creator Heatmap

```bash
# Setup tokens
ACCESS_TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"listener@example.com","password":"Test1234!"}' | jq -r '.data.accessToken')

CREATOR_TOKEN=$(curl -s -c creator_cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"creator@example.com","password":"Test1234!"}' | jq -r '.data.accessToken')

SONG_ID="song-001"  # assume đã upload từ tuần 3

# Bước 1: Tạo play events
for i in 1 2 3; do
  curl -s -X POST http://localhost:5000/api/v1/analytics/events/play \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: play-event-$i-$(date +%s)" \
    -d "{\"songId\":\"$SONG_ID\",\"durationSec\":180,\"listenedSec\":$((RANDOM % 180)),\"platform\":\"web\"}"
  sleep 1
done

# Bước 2: Tạo skip event
curl -s -X POST http://localhost:5000/api/v1/analytics/events/play \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: skip-event-1-$(date +%s)" \
  -d "{\"songId\":\"$SONG_ID\",\"durationSec\":180,\"listenedSec\":30,\"platform\":\"web\"}"

# Chờ Kafka consumer xử lý
sleep 5

# Bước 3: Creator xem heatmap
curl -s "http://localhost:5000/api/v1/analytics/creator/heatmap/$SONG_ID?timeRange=7d" \
  -H "Authorization: Bearer $CREATOR_TOKEN" | jq .

# Expected:
# { "success": true, "data": { "heatmap": [{ "second": 30, "skipRate": 0.25 }, ...] }, "meta": { "cache": "MISS" } }

# Bước 4: Search
curl -s "http://localhost:5000/api/v1/search?q=son+tung&type=song" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data.items[0].title'
# Expected: "Nơi này có anh" hoặc bài của Sơn Tùng
```

**Tuần 6 hoàn thành khi:** Creator nhìn thấy heatmap có data từ play/skip events.
