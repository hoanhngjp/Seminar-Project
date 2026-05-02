# week10_12_polish_demo.md — Observability + Verification + Demo Prep

> Port mapping và curl commands: xem `.claude/plan/shared_contracts.md`
> AC nguồn gốc: Backlog_V7.md

---

## Tuần 10 — Observability + Load Testing

### Prometheus Metrics cần có

| Metric name | Type | Labels | Mô tả |
|-------------|------|--------|-------|
| `api_request_duration_seconds` | Histogram | service, endpoint, method, status_code | Latency từng request |
| `api_latency_p95` | Gauge (computed từ histogram) | service, endpoint | p95 latency — target < 500ms |
| `streaming_start_time_seconds` | Histogram | song_id | Thời gian từ request đến first byte |
| `kafka_consumer_lag` | Gauge | consumer_group, topic, partition | Số messages chưa xử lý |
| `recommendation_ctr` | Counter | context | Click-through rate: plays / recommendations_shown |
| `http_requests_total` | Counter | service, endpoint, status_code | Tổng request count |

**Cách expose metrics trong C# (Prometheus.NET):**
```csharp
// Thêm vào mỗi service
builder.Services.AddMetricServer(options => options.Port = 9091); // hoặc expose trên /metrics

// Trong middleware đo latency
using var timer = requestDuration.WithLabels(serviceName, path, method, statusCode.ToString()).NewTimer();
```

**Cách expose metrics trong Python (prometheus-fastapi-instrumentator):**
```python
# requirements.txt
# prometheus-fastapi-instrumentator==6.1.*

from prometheus_fastapi_instrumentator import Instrumentator
Instrumentator().instrument(app).expose(app)
# Tự động expose /metrics endpoint
```

### Grafana Dashboard Setup

**Dashboard file:** `infra/grafana/dashboards/smart-music.json`

**4 Panels cần có:**

**Panel 1: API Latency p95 (Line chart)**
```
Flux query:
  rate(api_request_duration_seconds_bucket[5m])
Target: mọi service, hiển thị từng endpoint
Alert: nếu p95 > 500ms liên tục 5 phút
```

**Panel 2: Streaming Start Time (Histogram)**
```
histogram_quantile(0.95, rate(streaming_start_time_seconds_bucket[5m]))
Target: < 1s
```

**Panel 3: Kafka Consumer Lag (Bar chart)**
```
kafka_consumer_lag{consumer_group=~"analytics-service|recommendation-service|notification-service"}
Alert: nếu lag > 10s cho analytics-service hoặc recommendation-service
```

**Panel 4: Recommendation CTR (Gauge)**
```
rate(recommendation_ctr_total[1h]) / rate(http_requests_total{endpoint="/recommendations"}[1h])
Target: > 10% (>0.10)
```

### k6 Load Test Scripts

**Script 1: Streaming URL** — `tests/load/streaming_url.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 50,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<150'],  // 150ms p95
    http_req_failed: ['rate<0.01'],    // < 1% error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TOKEN = __ENV.ACCESS_TOKEN;
const SONG_ID = __ENV.SONG_ID || 'song-001';

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/streaming/${SONG_ID}/url`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'has url': (r) => JSON.parse(r.body).data?.url !== undefined,
    'latency < 150ms': (r) => r.timings.duration < 150,
  });
  sleep(1);
}
```

**Script 2: Search** — `tests/load/search.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 30,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

const QUERIES = ['son tung', 'noi nay', 'chay ngay di', 'hoa no', 'bac phan'];
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TOKEN = __ENV.ACCESS_TOKEN;

export default function () {
  const q = QUERIES[Math.floor(Math.random() * QUERIES.length)];
  const res = http.get(`${BASE_URL}/api/v1/search?q=${encodeURIComponent(q)}&limit=10`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'is array': (r) => Array.isArray(JSON.parse(r.body).data?.items),
  });
  sleep(1);
}
```

**Script 3: Recommendations** — `tests/load/recommendation.js`
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 30,
  duration: '2m',
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<0.01'],
  },
};

const CONTEXTS = ['morning', 'evening', 'none'];
const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TOKEN = __ENV.ACCESS_TOKEN;

export default function () {
  const ctx = CONTEXTS[Math.floor(Math.random() * CONTEXTS.length)];
  const res = http.get(`${BASE_URL}/api/v1/recommendations?context=${ctx}&limit=20`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, {
    'status 200': (r) => r.status === 200,
    'has items': (r) => JSON.parse(r.body).data?.items?.length > 0,
  });
  sleep(1);
}
```

**Chạy k6:**
```bash
# Lấy access token trước
ACCESS_TOKEN=$(curl -s -c /tmp/cookies.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"listener@example.com","password":"Test1234!"}' | jq -r '.data.accessToken')

# Chạy từng script
k6 run -e ACCESS_TOKEN=$ACCESS_TOKEN tests/load/streaming_url.js
k6 run -e ACCESS_TOKEN=$ACCESS_TOKEN tests/load/search.js
k6 run -e ACCESS_TOKEN=$ACCESS_TOKEN tests/load/recommendation.js
```

### Đọc kết quả k6 — Identify bottleneck

```
k6 output ví dụ:
  http_req_duration............: avg=95ms min=12ms med=87ms max=342ms p(90)=145ms p(95)=178ms

Nếu p95 VƯỢT target:
  1. p95 > 150ms cho /streaming/url:
     → Kiểm tra: curl http://localhost:5003/internal/songs/{id}/storage-key
       (nếu chậm → bottleneck ở Music Service DB query → thêm index)
       (nếu nhanh → bottleneck ở S3 pre-sign → check LocalStack perf)

  2. p95 > 200ms cho /search:
     → curl http://localhost:9200/songs/_search?q=...
       (nếu chậm → Elasticsearch heap thiếu → tăng ES_JAVA_OPTS="-Xms512m -Xmx512m")
       (nếu nhanh → bottleneck ở Redis cache miss → kiểm tra cache hit rate)

  3. p95 > 300ms cho /recommendations:
     → Kiểm tra Rule Engine timeout → fallback có bị trigger không?
     → redis-cli DEBUG SLEEP 0 (confirm Redis không lag)
     → Kiểm tra httpx call đến Music Service batch endpoint
```

---

## Tuần 11 — Verification + Buffer

### AC Checklist — Phase 1 MVP

Đánh dấu PASS/FAIL cho từng AC. Verify bằng curl hoặc browser.

#### EPIC 0 — API Gateway
- [ ] **AC0.1.1** PASS: request không JWT → 401 `curl http://localhost:5000/api/v1/users/me`
- [ ] **AC0.1.2** PASS: downstream > 2000ms → 503 (simulate bằng cách stop service, wait 2s)
- [ ] **AC0.1.3** PASS: > 100 req/min same IP → 429

#### EPIC 1 — Auth + User + Music Upload
- [ ] **AC1.1.1** PASS: login thành công → accessToken + refreshToken cookie
- [ ] **AC1.1.2** PASS: login sai → 400 `AUTH_INVALID_CREDENTIALS`
- [ ] **AC1.1.3** PASS: 5 fail → 423 `ACCOUNT_LOCKED`
- [ ] **AC1.1.4** PASS: refresh token reuse → 403 `TOKEN_REUSED` + all sessions revoked
- [ ] **AC1.2.1** PASS: first login → force onboarding (chọn ≥ 3 genres)
- [ ] **AC1.2.2** PASS: onboarding complete → Kafka `User_Preferences_Updated` published
- [ ] **AC1.2.3** PASS: onboarding đã có → skip screen (idempotent)
- [ ] **AC1.3.1** PASS: upload MP3 hợp lệ → S3 + DB
- [ ] **AC1.3.2** PASS: upload → `New_Release` Kafka event
- [ ] **AC1.3.3** PASS: file > 50MB → 413; file .exe rename → 400

#### EPIC 2 — Recommendation
- [ ] **AC2.1.1** PASS: context=morning → acoustic/morning songs ranked cao
- [ ] **AC2.1.2** PASS: skip 3 lần liên tiếp → genre weight giảm trong Redis
- [ ] **AC2.1.3** PASS: nghe > 80% → genre weight tăng
- [ ] **AC2.1.4** PASS: mỗi item có `explainText` không rỗng
- [ ] **AC2.1.5** PASS: timeout → fallback trending list
- [ ] **AC2.2.1** PASS: `Song_Played` consumed → Redis weight tăng
- [ ] **AC2.2.2** PASS: `Song_Skipped` consumed → Redis weight giảm
- [ ] **AC2.2.3** PASS: duplicate eventId → chỉ xử lý 1 lần

#### EPIC 3 — Streaming
- [ ] **AC3.1.1** PASS: nhạc bắt đầu phát < 1s (từ khi nhận URL đến first audio)
- [ ] **AC3.1.2** PASS: seek → HTTP 206 từ byte range đúng
- [ ] **AC3.1.3** PASS: pre-signed URL có `X-Amz-Expires=900`

#### EPIC 4 — Analytics
- [ ] **AC4.1.1** PASS: stream → `Song_Played` event
- [ ] **AC4.1.2** PASS: skip → `Song_Skipped` event với timestamp
- [ ] **AC4.1.3** PASS: duplicate eventId → skip
- [ ] **AC4.1.4** PASS: `POST /events/play` → 202 trong < 50ms
- [ ] **AC4.2.1** PASS: Creator xem heatmap → array theo giây
- [ ] **AC4.2.2** PASS: stats có `uniqueListeners` và `dailyPlays`
- [ ] **AC4.2.3** PASS: Listener truy cập heatmap → 403
- [ ] **AC4.2.4** PASS: heatmap cached → `meta.cache = "HIT"`

#### EPIC 5 — Search
- [ ] **AC5.1.1** PASS: "son tug" → hit "Sơn Tùng M-TP"
- [ ] **AC5.1.2** PASS: response < 200ms (cache hit)
- [ ] **AC5.1.3** PASS: no results → `[]` không phải error
- [ ] **AC5.1.4** PASS: response có `nextCursor` và `hasMore`

#### EPIC 6 — Notification
- [ ] **AC6.1.1** PASS: `New_Release` → notification documents trong MongoDB
- [ ] **AC6.1.2** PASS: `GET /notifications/unread` → cursor pagination
- [ ] **AC6.1.3** PASS: cùng Idempotency-Key 2 lần → 409 lần 2

#### EPIC 7 — Listening Party
- [ ] **AC7.1.1** PASS: create → roomId + joinCode (6 ký tự)
- [ ] **AC7.1.2** PASS: join hợp lệ → room state đầy đủ
- [ ] **AC7.1.3** PASS: sai joinCode → 404 ROOM_NOT_FOUND
- [ ] **AC7.2.1** PASS: Host Play → Members sync < 500ms
- [ ] **AC7.2.2** PASS: Member Play → server reject
- [ ] **AC7.2.3** PASS: conflict → Host state win
- [ ] **AC7.2.4** PASS: idle 30s → Ping → no Pong → disconnect
- [ ] **AC7.3.1** PASS: reconnect → nhận SYNC_STATE ngay
- [ ] **AC7.3.2** PASS: reconnect dùng Exponential Backoff (verify bằng Network tab)
- [ ] **AC7.3.3** PASS: room không tồn tại → "Phòng đã kết thúc"

### Trade-offs đã accept — Chuẩn bị giải thích cho hội đồng

| Trade-off | Lý do accept | Cách giải thích |
|-----------|-------------|-----------------|
| Rule Engine thay ML | Timeline 1 học kỳ, không có training data | "Chúng tôi prioritize deliverable over accuracy. Rule Engine CTR > 10% là đủ cho MVP" |
| Listening Party mất state khi Redis crash | Đổi lấy latency < 500ms, đơn giản hóa | "Trade-off được document rõ. User tạo room mới — state chỉ là temporary session" |
| No Host re-election (Phase 2) | Đơn giản hóa, scope giới hạn | "Phase 2 feature. Phase 1 focus: sync mechanism và Host Authority đúng" |
| Bloom Filter → Redis SET | Redis SET đủ cho scale demo | "Bloom Filter optimize memory cho billion events. Redis SET đủ cho demo scale" |
| gRPC chỉ 2 calls | Tránh over-engineering | "gRPC overhead justify khi cần: Auth validation (hot path) và User profile (critical)" |
| No DRM | Pre-signed URL + CDN đủ cho demo | "Production DRM cần license server phức tạp. Pre-signed URL đủ bảo vệ cho demo" |

---

## Tuần 12 — Demo Preparation

### Demo Script — Thứ tự tính năng

| Bước | Tính năng | Người thao tác | Người thuyết minh | Thời gian |
|------|-----------|---------------|-------------------|-----------|
| 1 | Login | Thành viên A | Thành viên B | 1 phút |
| 2 | Onboarding (chọn genres) | Thành viên A | Thành viên B | 1 phút |
| 3 | Home → Recommendations với explainText | Thành viên A | Thành viên C | 1.5 phút |
| 4 | Play nhạc (AudioPlayer) | Thành viên A | Thành viên C | 1 phút |
| 5 | Search "son tung" → kết quả | Thành viên A | Thành viên B | 1 phút |
| 6 | Creator Dashboard — heatmap | Thành viên A (đổi account Creator) | Thành viên B | 2 phút |
| 7 | Creator Upload nhạc mới | Thành viên A | Thành viên C | 1.5 phút |
| 8 | Listener nhận Notification | Thành viên A (đổi về Listener) | Thành viên B | 1 phút |
| 9 | Tạo Listening Party | Thành viên A | Thành viên C | 0.5 phút |
| 10 | Join Party từ laptop 2 | Thành viên B (laptop riêng) | Thành viên C | 0.5 phút |
| 11 | Host Play → Member sync realtime | Thành viên A + B | Thành viên C | 2 phút |
| **Total** | | | | **~14 phút** |

### Happy Path — Commands cụ thể

**Chuẩn bị trước demo (30 phút trước):**
```bash
# 1. Start tất cả services
cd infra && docker-compose up -d
sleep 30

# 2. Verify health
for port in 5000 5001 5002 5003 5004 5005 5006 5007 5008 8000; do
  echo -n "Port $port: "
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:$port/health
done

# 3. Start React dev server
cd services/frontend && npm run dev &

# 4. Verify Elasticsearch index
curl -s http://localhost:9200/songs/_count | jq .count
# Expected: >= 10

# 5. Verify Redis trending
redis-cli ZCARD rec:trending:global
# Expected: >= 50

# 6. Mở browser, login trước, để sẵn ở Home page
open http://localhost:3000
```

**Accounts cần tạo trước demo:**
```
Listener:  listener@example.com / Demo1234!  (role: Listener)
Creator:   creator@example.com  / Demo1234!  (role: Creator, có sẵn 2-3 bài đã upload)
```

**Pre-upload nhạc cho Creator:**
```bash
CREATOR_TOKEN=$(curl -s -c /tmp/c.txt -X POST http://localhost:5000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"creator@example.com","password":"Demo1234!"}' | jq -r '.data.accessToken')

# Upload 2 bài demo
curl -X POST http://localhost:5000/api/v1/music/songs \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -F "file=@tests/fixtures/demo-song-1.mp3" \
  -F "title=Demo Song 1" -F "genreIds=genre-vpop-001" -F "mood=morning"

curl -X POST http://localhost:5000/api/v1/music/songs \
  -H "Authorization: Bearer $CREATOR_TOKEN" \
  -F "file=@tests/fixtures/demo-song-2.mp3" \
  -F "title=Demo Song 2" -F "genreIds=genre-ballad-001" -F "mood=romantic"
```

### Backup Plans — Theo từng Scenario

| Scenario | Triệu chứng | Backup plan |
|----------|-------------|-------------|
| Auth Service down | Login fail, 503 error | Có sẵn pre-recorded demo video 5 phút (record trước demo day) |
| Kafka lag cao | Heatmap trống, recommendations không cập nhật | Explain: "Real-time processing có thể lag trong demo environment. Production dùng cluster Kafka. Đây là data từ cache." Show Redis data trực tiếp |
| Elasticsearch down | Search trả `[]` | Explain: "Elasticsearch single-node trong dev. Code đã implement fallback → trả empty array, không crash. Production sẽ có cluster." |
| WebSocket không sync | Tab 2 không nhận SYNC_STATE | Reload Tab 2 → join lại room → thường sẽ fix. Nếu không: show SignalR connection logs trong Console |
| S3/LocalStack chậm | Streaming URL lấy > 5s | "Pre-signed URL đã cache. Demo pre-fetched URL." Có sẵn URL từ script trước đó |
| React blank screen | JS error | Check Console, thường là ENV variable missing. `VITE_API_BASE_URL=http://localhost:5000 npm run dev` |

### FAQ Dự đoán từ Hội đồng

**Q: Tại sao không dùng ML cho Recommendation?**
> "PRD V5 và Backlog V7 đều xác định Rule Engine là scope Phase 1. ML cần training data (chicken-and-egg problem khi platform mới), infrastructure phức tạp, và timeline ngắn hơn 1 học kỳ. Rule Engine đạt CTR > 10% target — đủ cho MVP. Phase 2 có thể nâng lên Collaborative Filtering."

**Q: Tại sao Listening Party mất state khi Redis crash?**
> "Đây là trade-off được document rõ trong database/DATABASE_SCHEMA.md và PRD V5. Party state là ephemeral — không cần persistence vĩnh viễn. Đổi lại: sync delay < 500ms, không cần distributed transaction, đơn giản hóa failure recovery. User tạo room mới nếu Redis crash — acceptable cho live demo feature."

**Q: Scale như thế nào nếu có 1000 concurrent users?**
> "API Gateway + YARP: horizontal scale stateless, Redis cho shared state. Kafka: partition để scale consumers. Streaming: CDN absorbs traffic, pre-signed URL không qua backend. Bottleneck prediction: Analytics write throughput — giải quyết bằng InfluxDB batch write và sampling khi Kafka lag > 10s."

**Q: Security như thế nào?**
> "JWT HS256 + HTTP-only Cookie cho refresh token. Redis blacklist cho token revocation. Refresh Token Rotation: one-time use, reuse detection → revoke all sessions. Rate limiting tại Gateway: 10 req/min cho auth endpoints. RBAC enforcement tại backend — không trust client. Pre-signed S3 URL expiry 15 phút."

**Q: Tại sao dùng InfluxDB cho Analytics thay vì PostgreSQL?**
> "Time-series data: InfluxDB native compression ~10x tốt hơn PostgreSQL cho append-only metrics. Flux query language: sliding window aggregate dễ hơn SQL Window Function. Retention policy built-in: tự động downsample 90-day raw → 2-year aggregate. PII segregation: InfluxDB chỉ lưu userId UUID — không lưu email/name."

**Q: gRPC chỉ 2 calls — tại sao không dùng nhiều hơn?**
> "gRPC có overhead: protobuf codegen, strict schema, HTTP/2 multiplexing. Justify khi: (1) hot path cần sub-100ms (ValidateToken mỗi request), (2) strongly-typed contract quan trọng (GetUserProfile). Các service-to-service khác dùng REST internal — đơn giản hơn, dễ debug, không phải auth với nhau."

**Q: Không có mobile app?**
> "Out of scope PRD V5. React SPA với responsive design chạy trên mobile browser. Native app cần push notification service, offline cache, deep linking — phức tạp hơn nhiều scope 1 học kỳ."
