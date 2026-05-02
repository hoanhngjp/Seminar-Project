# week3_4_music_streaming_recommendation.md — Music + Streaming + Recommendation

> Mục tiêu cuối tuần 4: Listener có thể play 1 bài nhạc end-to-end
> Creator upload nhạc → Streaming Service cấp pre-signed URL → Listener nghe được
>
> Port mapping và curl commands: xem `.claude/plan/shared_contracts.md`
> Error codes: xem `.claude/plan/shared_contracts.md` Section 5
> LocalStack config: xem `.claude/plan/shared_contracts.md` Section 2

---

## Dependency Graph

```
Tuần 3:
  LocalStack S3 + Seed setup
      ↓
  Music Service (PostgreSQL music_db — port 5434)
      ↓
  Streaming Service (stateless, gọi Music Service qua REST internal)

Tuần 4:
  Redis Seed (50 trending songs)
      ↓
  Recommendation Service (Python FastAPI, Kafka consumers)
```

---

## Bước 0 — Setup LocalStack + Seed (Làm trước Music Service)

### Thêm LocalStack vào docker-compose.yml
```yaml
# Thêm vào infra/docker-compose.yml
localstack:
  image: localstack/localstack:3.4
  ports:
    - "4566:4566"
  environment:
    - SERVICES=s3
    - DEBUG=1
    - AWS_DEFAULT_REGION=us-east-1
  volumes:
    - localstack_data:/var/lib/localstack
    - /var/run/docker.sock:/var/run/docker.sock

volumes:
  localstack_data:
```

### Seed script: infra/seed/s3_seed.sh
```bash
#!/bin/bash
# Tạo S3 bucket và upload test MP3

ENDPOINT=http://localhost:4566
BUCKET=smart-music-dev

# Tạo bucket
aws --endpoint-url=$ENDPOINT s3 mb s3://$BUCKET 2>/dev/null || echo "Bucket đã tồn tại"

# Tạo test MP3 (1 giây silence)
# Cần ffmpeg: ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -q:a 9 -acodec libmp3lame tests/fixtures/test-audio.mp3
# Hoặc dùng bất kỳ file .mp3 nhỏ nào để test

aws --endpoint-url=$ENDPOINT s3 cp tests/fixtures/test-audio.mp3 \
  s3://$BUCKET/songs/test-song-001/audio.mp3

echo "S3 seed hoàn thành"
aws --endpoint-url=$ENDPOINT s3 ls s3://$BUCKET/songs/ --recursive
```

### Seed script: infra/seed/redis_seed.sh
```bash
#!/bin/bash
# Populate Redis với 50 trending songs

redis-cli ZADD rec:trending:global \
  9500 "song-001" 8200 "song-002" 7100 "song-003" \
  6800 "song-004" 6500 "song-005" 6200 "song-006" \
  5900 "song-007" 4500 "song-008" 4200 "song-009" \
  3800 "song-010" 3600 "song-011" 3400 "song-012" \
  3200 "song-013" 3000 "song-014" 2800 "song-015" \
  2600 "song-016" 2400 "song-017" 2200 "song-018" \
  2000 "song-019" 1900 "song-020" 1800 "song-021" \
  1700 "song-022" 1600 "song-023" 1500 "song-024" \
  1400 "song-025" 1300 "song-026" 1200 "song-027" \
  1100 "song-028" 1000 "song-029" 950 "song-030" \
  900 "song-031" 850 "song-032" 800 "song-033" \
  750 "song-034" 700 "song-035" 650 "song-036" \
  600 "song-037" 550 "song-038" 500 "song-039" \
  480 "song-040" 460 "song-041" 440 "song-042" \
  420 "song-043" 400 "song-044" 380 "song-045" \
  360 "song-046" 340 "song-047" 320 "song-048" \
  300 "song-049" 280 "song-050"

redis-cli EXPIRE rec:trending:global 3600
echo "Redis seed: $(redis-cli ZCARD rec:trending:global) songs in trending"
```

### Verify setup
```bash
# Chạy LocalStack
docker-compose up localstack -d
sleep 5

# Chạy seed scripts
chmod +x infra/seed/s3_seed.sh infra/seed/redis_seed.sh
bash infra/seed/s3_seed.sh
bash infra/seed/redis_seed.sh

# Verify S3
aws --endpoint-url=http://localhost:4566 s3 ls s3://smart-music-dev/songs/ --recursive
# Expected: 2026-xx-xx test-audio.mp3

# Verify Redis
redis-cli ZREVRANGE rec:trending:global 0 4 WITHSCORES
# Expected: song-001 9500 song-002 8200 ...
```

---

## Music Service (Tuần 3)

### Làm trước khi bắt đầu
Đọc: `docs/originals/API_DESIGN_V2.md` (phần Music), `database/DATABASE_SCHEMA.md` (music_db), `.github/REDIS_KEY_DESIGN.md`, `security-non-negotiable/RULE.md` (phần S3)

### Database: music_db (PostgreSQL port 5434)
Tables cần tạo: `artists`, `genres`, `albums`, `songs`, `song_genres`
Schema chi tiết: `database/DATABASE_SCHEMA.md`

### EF Core Migration
```bash
cd services/music-service/src/Music.Infrastructure
dotnet ef migrations add InitialCreate --startup-project ../Music.Api
dotnet ef database update --startup-project ../Music.Api
# Verify: psql -h localhost -p 5434 -d music_db
# \dt → artists, genres, albums, songs, song_genres
```

### Endpoints cần implement

**1. POST /api/v1/music/songs**
- Auth: Bearer JWT, Role: Creator only (403 nếu Listener)
- Body: multipart/form-data — audio file + metadata (title, genreIds, mood, language, isExplicit)
- Validation: MIME type phải là audio/mpeg hoặc audio/wav hoặc audio/ogg; size ≤ 50MB
- Flow:
  1. Validate file (server-side, không trust Content-Type header — đọc magic bytes)
  2. Upload lên S3 với key: `songs/{songId}/audio.mp3`
  3. CHỈ sau khi S3 confirm thành công → commit metadata vào PostgreSQL
  4. Publish Kafka event `New_Release` (v1)
- Response 201: `{ success, data: { songId, title, storageKey, status: "processing" }, meta }`
- Errors: 400 VALIDATION_ERROR, 403 FORBIDDEN, 413 PAYLOAD_TOO_LARGE, 503 nếu S3 fail
- Retry: S3 upload retry 3 lần Exponential Backoff
- Latency budget: 5000ms (upload có thể chậm)
- Idempotency-Key: cần — tránh double upload

**2. GET /api/v1/music/songs/{songId}**
- Auth: Bearer JWT required
- Response 200: `{ success, data: { id, title, artist, album, duration, coverUrl, isExplicit }, meta }`
- Redis cache TTL 30m, key: `song:meta:{songId}`
- Errors: 404 SONG_NOT_FOUND
- Latency budget: 200ms

**3. Internal REST: GET /internal/songs/{songId}/storage-key**
- Caller: Streaming Service
- Response: `{ storageKey: "songs/{songId}/audio.mp3", bucket: "smart-music-dev" }`
- Không qua Gateway, không cần Auth middleware

**4. Internal REST: GET /internal/songs/batch?ids=id1,id2,...**
- Caller: Recommendation Service
- Response: `{ songs: [{ id, title, artist, genreId, moodTags }] }`

### Acceptance Criteria cần pass
- AC1.3.1: upload file hợp lệ → S3 + DB
- AC1.3.2: upload thành công → New_Release Kafka event
- AC1.3.3: file > 50MB hoặc sai format → 400 VALIDATION_ERROR

### Prompt dùng với Claude

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, microservice-api/SKILL.md,
api-contract-first/RULE.md, security-non-negotiable/RULE.md, và
testing-required/RULE.md đính kèm trước khi làm.

Implement Music Service (services/music-service/) với các endpoints:
1. POST /api/v1/music/songs — upload audio + metadata (Creator only)
2. GET /api/v1/music/songs/{songId} — lấy metadata (cache Redis 30m)
3. Internal GET /internal/songs/{songId}/storage-key
4. Internal GET /internal/songs/batch?ids=...

Acceptance Criteria cần cover:
- AC1.3.1: upload hợp lệ → S3 key songs/{songId}/audio.mp3 + commit DB
- AC1.3.2: upload thành công → Kafka New_Release event v1
- AC1.3.3: file > 50MB hoặc sai MIME → 413 PAYLOAD_TOO_LARGE hoặc 400 VALIDATION_ERROR

Security bắt buộc:
- Validate MIME type bằng magic bytes (không trust Content-Type header)
- Allowed: audio/mpeg, audio/wav, audio/ogg
- S3 commit PHẢI sau khi upload success — không commit trước
- CREATOR role check tại controller, không trust body
- AWS credentials từ env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
- LocalStack endpoint (dev): từ env LOCALSTACK_ENDPOINT (http://localhost:4566)

S3 config:
- Bucket: từ env S3_BUCKET_NAME
- Key pattern: songs/{songId}/audio.mp3
- Retry: 3 lần Exponential Backoff (1s, 2s, 4s)

Kafka: publish New_Release event v1 sau khi upload thành công
Schema: docs/contracts/KAFKA_EVENT_CONTRACTS.md

EF Core migration: dotnet ef migrations add InitialCreate
Schema: database/DATABASE_SCHEMA.md (tables: songs, artists, genres, albums, song_genres)

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trước khi viết code.
```

### Definition of Done

- [ ] AC1.3.1: `curl -X POST .../music/songs -F "file=@test.mp3" -F "title=Test Song"` → 201 + S3 object tồn tại
- [ ] AC1.3.2: Kafka message trong topic `New_Release` sau khi upload
- [ ] AC1.3.3: file 60MB → 413; file .txt rename thành .mp3 → 400
- [ ] Internal endpoint: `curl http://localhost:5003/internal/songs/test-song-001/storage-key` → 200
- [ ] Unit tests: mock S3, mock Kafka, mock DB
- [ ] Migration: `\dt` trong music_db thấy đủ 5 tables
- Thời gian ước tính: **2 ngày**

---

## Streaming Service (Tuần 3)

### Làm trước khi bắt đầu
Đọc: `docs/originals/API_DESIGN_V2.md` (phần Streaming), `security-non-negotiable/RULE.md` (phần Pre-signed URLs)

### Lưu ý quan trọng
Streaming Service là **stateless** — không có database riêng. Lấy storage key từ Music Service qua internal REST.

### Endpoints cần implement

**1. GET /api/v1/streaming/{songId}/url**
- Auth: Bearer JWT required
- Flow:
  1. Gọi `GET http://music-service/internal/songs/{songId}/storage-key` (timeout 150ms)
  2. Generate pre-signed URL từ S3 (expiry 900 giây = 15 phút)
  3. Trả URL về client — client tải trực tiếp từ S3/CDN
- Response 200: `{ success, data: { url: "https://...", expiresIn: 900 }, meta }`
- Errors: 404 SONG_NOT_FOUND, 503 nếu Music Service fail
- Latency budget: 150ms
- Pre-signed URL phải dùng expiry chính xác 900s — không nhiều hơn, không ít hơn

**2. GET /api/v1/streaming/{songId}/chunk**
- HTTP Range Request support (206 Partial Content)
- Header: `Range: bytes=0-1048575`
- Response 206: binary audio data
- Fallback: nếu CDN miss → fetch từ S3 trực tiếp
- Latency budget: 1000ms

### Acceptance Criteria cần pass
- AC3.1.1: nhạc bắt đầu phát trong < 1s
- AC3.1.2: seek → HTTP 206 từ timestamp chính xác
- AC3.1.3: pre-signed URL expiry = 15 phút

### Prompt dùng với Claude

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, api-contract-first/RULE.md,
security-non-negotiable/RULE.md, và testing-required/RULE.md đính kèm.

Implement Streaming Service (services/streaming-service/) với:
1. GET /api/v1/streaming/{songId}/url — generate pre-signed URL (15 phút)
2. GET /api/v1/streaming/{songId}/chunk — HTTP Range Request (206 Partial Content)

Acceptance Criteria:
- AC3.1.1: response time < 150ms cho /url endpoint
- AC3.1.2: Range header → 206 với đúng byte range
- AC3.1.3: pre-signed URL expiry = chính xác 900 giây

Internal dependency: gọi GET http://music-service/internal/songs/{songId}/storage-key
- Timeout: 150ms
- Fallback nếu fail: return 503 SERVICE_UNAVAILABLE

Pre-signed URL security:
- Expiry: DateTime.UtcNow.AddSeconds(900) — không dùng số khác
- Verb: GET only
- S3 endpoint từ env: LOCALSTACK_ENDPOINT (dev) hoặc để trống (prod)
- AWS credentials từ env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

CDN fallback: nếu CDN_PRIMARY_URL fail → dùng CDN_SECONDARY_URL (từ env)

Streaming Service không có database riêng — stateless.

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trước khi viết code.
```

### Definition of Done

- [ ] AC3.1.3: `curl http://localhost:5000/api/v1/streaming/test-song-001/url` → 200 với URL chứa `X-Amz-Expires=900`
- [ ] AC3.1.2: `curl -H "Range: bytes=0-1023" {pre-signed-url}` → 206 Partial Content
- [ ] Internal flow: Streaming Service gọi được Music Service storage-key endpoint
- [ ] Unit tests: mock HTTP client (Music Service call), mock S3 pre-sign
- Thời gian ước tính: **1 ngày**

---

## Recommendation Service (Tuần 4 — Python FastAPI)

### CẢNH BÁO SCOPE — ĐỌC TRƯỚC
Recommendation Service **CHỈ ĐƯỢC** dùng:
- Rule Engine với công thức: `final_score = base_score + context_bonus + preference_bonus - skip_penalty`
- Redis Sorted Set cho trending (`ZADD`, `ZREVRANGE`)
- Redis Hash cho user preference weights (`HGET`, `HSET`)

**KHÔNG ĐƯỢC dùng:** scikit-learn, numpy (cho matrix ops), torch, tensorflow, cosine similarity, collaborative filtering, bất kỳ ML library nào.

Xem: `.claude/rules/no-scope-creep/RULE.md`

### Làm trước khi bắt đầu
Đọc: `docs/originals/API_DESIGN_V2.md` (Recommendation endpoints), `.claude/skills/fastapi-service/SKILL.md`, `.claude/rules/no-scope-creep/RULE.md`, `docs/contracts/KAFKA_EVENT_CONTRACTS.md`

### Verify Redis seed trước khi implement
```bash
redis-cli ZREVRANGE rec:trending:global 0 4 WITHSCORES
# Expected: song-001 9500 song-002 8200 ...
# Nếu chưa có → chạy infra/seed/redis_seed.sh
```

### Rule Engine Scoring Logic

```python
# services/recommendation-service/src/recommendation_service/services/rule_engine.py

CONTEXT_RULES = {
    "morning": {"tags": ["focus", "morning", "acoustic"], "bonus": 0.3},
    "evening": {"tags": ["chill", "evening", "relaxing"], "bonus": 0.3},
    "workout": {"tags": ["energetic", "party", "hype"],  "bonus": 0.3},
    "study":   {"tags": ["focus", "lofi", "instrumental"], "bonus": 0.3},
}

BASE_SCORE = 1.0
PLAY_WEIGHT_INCREMENT  = 0.1   # mỗi lần nghe > 80% duration
SKIP_WEIGHT_DECREMENT  = 0.05  # mỗi lần skip
MIN_WEIGHT = 0.1               # floor để không biến mất hoàn toàn
TIMEOUT_MS = 300               # caller enforce timeout này

def compute_score(candidate, context, user_weights):
    base = BASE_SCORE

    # Context bonus
    context_bonus = 0.0
    rule = CONTEXT_RULES.get(context, {})
    if any(tag in candidate.mood_tags for tag in rule.get("tags", [])):
        context_bonus = rule.get("bonus", 0.0)

    # Preference bonus từ Redis Hash
    genre_weight = user_weights.genre_weights.get(candidate.genre_id, 1.0)
    preference_bonus = (genre_weight - 1.0) * 0.5  # normalized

    # Skip penalty
    skip_penalty = user_weights.skip_penalties.get(candidate.genre_id, 0.0)

    total = base + context_bonus + preference_bonus - skip_penalty

    explain = _build_explain(context_bonus, preference_bonus, skip_penalty)
    return ScoreResult(base, context_bonus, preference_bonus, skip_penalty, total, explain)

def _build_explain(context_bonus, preference_bonus, skip_penalty):
    parts = []
    if context_bonus > 0:
        parts.append("Gợi ý theo thời điểm trong ngày")
    if preference_bonus > 0:
        parts.append("Vì bạn hay nghe thể loại này")
    elif preference_bonus < 0:
        parts.append("Thể loại ít phù hợp với bạn")
    if not parts:
        parts.append("Đang thịnh hành")
    return ". ".join(parts)
```

### Endpoints cần implement

**1. GET /api/v1/recommendations**
- Auth: Bearer JWT required
- Query params: `context` (morning/evening/workout/study), `limit` (default 20, max 50)
- Flow:
  1. Lấy user preferences từ Redis Hash `user:prefs:{userId}`
  2. Lấy candidates từ `rec:trending:global` (ZREVRANGE top 100)
  3. Enrich với metadata qua `GET http://music-service/internal/songs/batch?ids=...`
  4. Score mỗi candidate bằng Rule Engine
  5. Sort by total score, lấy top `limit`
  6. Trả về với `explain_text`
- Fallback nếu Rule Engine timeout > 300ms: trả Top 50 từ `rec:trending:global` trực tiếp
- Fallback nếu Redis miss hoàn toàn (user mới): trả songs từ genres onboarding
- Response 200: `{ success, data: { items: [{ songId, title, artist, explainText, score }] }, meta: { cache: "HIT|MISS" } }`
- Latency budget: 300ms

**2. POST /api/v1/recommendations/feedback**
- Auth: Bearer JWT required
- Body: `{ songId: string, action: "PLAY"|"SKIP", durationPercent: number }`
- Response 202: `{ success, data: { received: true }, meta }`
- Async: update Redis weights ngay, không block
- Latency budget: 100ms

### Kafka Consumers cần setup

**Consumer 1: Song_Played**
- Topic: `Song_Played`
- Consumer group: `recommendation-service`
- Logic:
  1. Idempotency check: `SETNX dedup:Song_Played:{eventId} 1 EX 86400`
  2. Nếu durationPercent >= 80: tăng genre weight trong Redis Hash `user:prefs:{userId}`, field `genre:{genreId}`, increment 0.1, cap tại 2.0
  3. DLQ sau 3 retries

**Consumer 2: Song_Skipped**
- Topic: `Song_Skipped`
- Consumer group: `recommendation-service`
- Logic:
  1. Idempotency check: `SETNX dedup:Song_Skipped:{eventId} 1 EX 86400`
  2. Giảm genre weight: `user:prefs:{userId}` field `genre:{genreId}`, decrement 0.05, floor tại 0.1
  3. DLQ sau 3 retries

**Consumer 3: User_Preferences_Updated**
- Topic: `User_Preferences_Updated`
- Consumer group: `recommendation-service`
- Logic: override `user:prefs:{userId}` Hash với preferred genres từ onboarding

### Acceptance Criteria cần pass
- AC2.1.1: context=morning → songs có tags morning/acoustic ở vị trí cao
- AC2.1.2: skip liên tục ≥ 3 lần → giảm weight genre đó
- AC2.1.3: nghe > 80% → tăng weight genre
- AC2.1.4: response có explain_text cho mỗi bài
- AC2.1.5: timeout > 300ms → fallback Top 50 Trending
- AC2.2.1: Song_Played event → cập nhật play weight Redis
- AC2.2.2: Song_Skipped event → cập nhật skip weight Redis
- AC2.2.3: duplicate event (same eventId) → skip, không xử lý lại

### Prompt dùng với Claude

```
Đọc CLAUDE.md, fastapi-service/SKILL.md, api-contract-first/RULE.md,
no-scope-creep/RULE.md, security-non-negotiable/RULE.md, và
testing-required/RULE.md đính kèm trước khi làm.

Implement Recommendation Service (services/recommendation-service/) với:
1. GET /api/v1/recommendations — Rule Engine scoring với context
2. POST /api/v1/recommendations/feedback — async weight update
3. Kafka consumer: Song_Played → tăng genre weight
4. Kafka consumer: Song_Skipped → giảm genre weight
5. Kafka consumer: User_Preferences_Updated → override user prefs

Rule Engine: final_score = base_score + context_bonus + preference_bonus - skip_penalty
KHÔNG dùng scikit-learn, numpy matrix ops, hay bất kỳ ML library nào.
Chỉ dùng Redis + pure Python math.

Context rules:
- morning (6-12h): tags = ["focus", "morning", "acoustic"], bonus = 0.3
- evening (18-22h): tags = ["chill", "evening", "relaxing"], bonus = 0.3

Fallback chain (theo thứ tự):
1. Rule Engine < 300ms → kết quả scored
2. Rule Engine timeout → Top 50 từ rec:trending:global (Redis ZREVRANGE)
3. Redis miss hoàn toàn → songs từ genres onboarding user

Kafka idempotency: Redis SETNX dedup:{TOPIC}:{eventId} 1 EX 86400
DLQ: sau 3 retries Exponential Backoff (1s, 2s, 4s)

Internal HTTP call: GET http://music-service:80/internal/songs/batch?ids=...
Timeout: 200ms, dùng httpx.AsyncClient

Acceptance Criteria cần cover:
- AC2.1.1: context=morning → acoustic/morning songs ranked cao hơn
- AC2.1.5: timeout → fallback trending
- AC2.2.3: duplicate eventId → skip

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trước khi viết code.
Deliver: implementation → unit tests (pytest + fakeredis) → integration tests.
```

### Definition of Done

- [ ] AC2.1.1: `curl ".../recommendations?context=morning"` → response có bài acoustic/morning ở đầu
- [ ] AC2.1.4: mỗi item có `explainText` không rỗng
- [ ] AC2.1.5: mock timeout → response là trending list, `meta.cache = "HIT"`
- [ ] AC2.2.3: publish cùng eventId 2 lần → Redis weight chỉ tăng 1 lần
- [ ] Unit tests với fakeredis: `pytest services/recommendation-service/tests/unit/`
- [ ] Không có import scikit-learn, torch, numpy trong toàn bộ codebase
- Thời gian ước tính: **2 ngày**

---

## Checkpoint Cuối Tuần 4 — Play Nhạc End-to-End

```bash
# Bước 1: Login (lấy token)
ACCESS_TOKEN=$(curl -s -c cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"listener@example.com","password":"Test1234!"}' | jq -r '.data.accessToken')

# Bước 2: Creator upload bài nhạc (cần Creator token)
CREATOR_TOKEN=$(curl -s -c creator_cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"creator@example.com","password":"Test1234!"}' | jq -r '.data.accessToken')

SONG_ID=$(curl -s -X POST http://localhost:5000/api/v1/music/songs \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -F "file=@tests/fixtures/test-audio.mp3" \
  -F "title=Test Song" \
  -F "genreIds=song-genre-001" \
  -F "mood=acoustic" | jq -r '.data.songId')

echo "Song uploaded: $SONG_ID"

# Bước 3: Lấy pre-signed URL
STREAM_URL=$(curl -s "http://localhost:5000/api/v1/streaming/$SONG_ID/url" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq -r '.data.url')

echo "Stream URL: $STREAM_URL"

# Bước 4: Stream nhạc (download 1KB đầu để verify)
curl -s -r 0-1023 "$STREAM_URL" -o /dev/null -w "HTTP: %{http_code}, Size: %{size_download} bytes\n"
# Expected: HTTP: 206, Size: 1024 bytes

# Bước 5: Lấy recommendations
curl -s "http://localhost:5000/api/v1/recommendations?context=morning&limit=5" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.data.items[].explainText'
# Expected: ["Gợi ý theo thời điểm trong ngày", ...]
```

**Tuần 4 hoàn thành khi:** Tất cả 5 bước trên pass.
