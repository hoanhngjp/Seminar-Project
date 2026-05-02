# RULE: api-contract-first

**Áp dụng tuyệt đối trước khi viết bất kỳ dòng code nào liên quan đến API endpoint.**
Source of truth: `docs/originals/API_DESIGN_V2.md`

---

## 1. Contract-First Checklist — Bắt buộc trước khi implement

Trước khi viết code cho bất kỳ endpoint nào, Claude **phải** điền đủ 8 ô sau.
Nếu thiếu bất kỳ ô nào → dừng lại, tra cứu API Design V2, rồi mới tiếp tục.

```
□ [1] HTTP Method + Path  : ___________________________
□ [2] Request             : body / params / headers
□ [3] Response (success)  : schema + HTTP status code
□ [4] Error codes         : code string + HTTP status
□ [5] Middleware          : Auth / Rate Limit / Idempotency-Key / RBAC
□ [6] Latency budget      : ___ms  (timeout phải set ≤ budget)
□ [7] Safe to retry       : YES / NO
□ [8] Notes & Constraints : atomicity, fallback, cache key, pagination, etc.
```

**Ví dụ đúng — trước khi implement `POST /api/v1/auth/login`:**
```
□ [1] POST /api/v1/auth/login
□ [2] Body: { username, password }
□ [3] 200: { success, data: { accessToken, expiresIn }, meta, error: null }
        Cookie: refreshToken (HTTP-only)
□ [4] 400 AUTH_INVALID_CREDENTIALS
        429 RATE_LIMIT_EXCEEDED
        423 ACCOUNT_LOCKED
        500 INTERNAL_ERROR
□ [5] Rate Limit (IP+User 10/min)
□ [6] 500ms
□ [7] YES
□ [8] Lock sau 5 lần fail, Refresh Token Rotation, CorrelationId propagated
```

**Ví dụ sai — implement ngay khi chỉ biết path:**
```
// WRONG: viết code khi chưa biết error codes, middleware, budget
[HttpPost("login")]
public async Task<IActionResult> Login(LoginRequest req) { ... }
```

---

## 2. Response Format — Không được sai một field

Mọi response phải theo đúng cấu trúc dưới đây. Không tự ý đổi tên field, thêm field ngoài schema, hoặc bỏ field.

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "apiVersion": "v1",
    "requestId": "uuid-v4",
    "timestamp": "ISO8601",
    "cache": "HIT | MISS"
  },
  "error": null
}
```

> `"cache"` chỉ xuất hiện khi endpoint có caching (theo API Design V2). Không thêm vào endpoint không có cache.

### Error Response

```json
{
  "success": false,
  "data": null,
  "meta": {
    "apiVersion": "v1",
    "requestId": "uuid-v4",
    "timestamp": "ISO8601"
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Đúng vs Sai

| | Đúng | Sai |
|---|---|---|
| Top-level keys | `success`, `data`, `meta`, `error` | `status`, `result`, `errors`, `message` ở top-level |
| Error shape | `error.code` + `error.message` | `error: "string"` / `errors: []` / `message` ở top-level |
| Meta luôn có | `apiVersion`, `requestId`, `timestamp` | Bỏ `meta` khi trả error |
| `data` khi error | `null` | `{}` / `[]` / bỏ field |
| `error` khi success | `null` | Bỏ field `error` |
| Cache field | Chỉ khi endpoint có cache | Thêm vào mọi response |

---

## 3. Error Code Catalogue — Chỉ dùng codes đã định nghĩa

Claude **chỉ được dùng** error codes từ API Design V2. Không tự đặt tên mới.

| HTTP Status | Error Code | Dùng khi |
|-------------|------------|----------|
| 400 | `AUTH_INVALID_CREDENTIALS` | Login sai username/password |
| 400 | `VALIDATION_ERROR` | Input không hợp lệ (thiếu field, sai type, < min items) |
| 401 | `UNAUTHORIZED` | Không có hoặc JWT không hợp lệ |
| 401 | `TOKEN_EXPIRED` | Token hết hạn |
| 403 | `FORBIDDEN` | Đủ auth nhưng không có quyền (sai role) |
| 403 | `TOKEN_REUSED` | Refresh token dùng lại → revoke toàn bộ session |
| 404 | `USER_NOT_FOUND` | Không tìm thấy user |
| 404 | `SONG_NOT_FOUND` | Không tìm thấy bài hát |
| 404 | `ROOM_NOT_FOUND` | Không tìm thấy listening party room |
| 404 | `NOTIFICATION_NOT_FOUND` | Không tìm thấy notification |
| 409 | `IDEMPOTENCY_CONFLICT` | Idempotency-Key đã được xử lý |
| 413 | `PAYLOAD_TOO_LARGE` | File upload vượt 50MB |
| 423 | `ACCOUNT_LOCKED` | Tài khoản bị khóa sau 5 lần fail |
| 429 | `RATE_LIMIT_EXCEEDED` | Vượt rate limit |
| 500 | `INTERNAL_ERROR` | Lỗi không xác định / server error |
| 503 | `SERVICE_UNAVAILABLE` | Service tạm thời không khả dụng |

**Nếu không có error code phù hợp:**
1. Dùng `INTERNAL_ERROR` (500) tạm thời
2. Comment `// TODO: propose new error code to team`
3. Flag lại trong response: "Tôi đã dùng `INTERNAL_ERROR` tạm thời — cần team định nghĩa error code mới cho trường hợp này."
4. **Không tự đặt tên mới như** `UPLOAD_FAILED`, `DB_ERROR`, `KAFKA_TIMEOUT`, v.v.

---

## 4. Latency Budget Enforcement

Mỗi endpoint có budget cụ thể từ API Design V2. Claude phải:

| Endpoint | Budget | Timeout phải set | Fallback |
|----------|--------|-----------------|----------|
| `POST /auth/login` | 500ms | ≤ 500ms | — |
| `POST /auth/refresh` | 200ms | ≤ 200ms | — |
| `POST /auth/logout` | 150ms | ≤ 150ms | — |
| `GET /users/me` | 300ms | ≤ 300ms | Redis cache TTL 15m |
| `POST /users/me/preferences` | 400ms | ≤ 400ms | — |
| `GET /recommendations` | 300ms | ≤ 300ms | Top 50 Trending từ Redis |
| `POST /recommendations/feedback` | 100ms | ≤ 100ms (async 202) | — |
| `GET /streaming/{songId}/url` | 150ms | ≤ 150ms | Secondary CDN |
| `GET /streaming/{songId}/chunk` | 1000ms | ≤ 1000ms | CDN fallback |
| `POST /analytics/events/play` | 50ms | ≤ 50ms (async 202) | Local disk queue |
| `GET /analytics/creator/heatmap/{songId}` | 500ms | ≤ 500ms | Stale cache |
| `GET /analytics/creator/stats/{songId}` | 500ms | ≤ 500ms | Stale cache |
| `POST /music/songs` | 5000ms | ≤ 5000ms | S3 retry 3x Exp. Backoff |
| `GET /music/songs/{songId}` | 200ms | ≤ 200ms | Redis cache TTL 30m |
| `GET /search` | 200ms | ≤ 200ms | Return `[]` (không throw error) |
| `GET /notifications/unread` | 150ms | ≤ 150ms | — |
| `PATCH /notifications/{id}/read` | 150ms | ≤ 150ms | — |
| `PATCH /notifications/read-all` | 200ms | ≤ 200ms | Background async |
| `POST /parties` | 200ms | ≤ 200ms | — |
| `POST /parties/{joinCode}/join` | 150ms | ≤ 150ms | — |
| `WS /ws/v1/parties/{roomId}` | 500ms | ≤ 500ms | Reconnect Exp. Backoff |

**Quy tắc:**
- Async endpoints (202 Accepted): trả response ngay, xử lý background — không block đợi Kafka/DB.
- Timeout phải được set **ở code**, không chỉ trong config — `CancellationToken` hoặc `HttpClient.Timeout`.
- Không viết code có thể block vô thời hạn (N+1 query, missing timeout trên HTTP call).

---

## 5. Breaking Change Prevention

Khi sửa endpoint đã tồn tại, Claude **chỉ được ADD**, không được REMOVE hoặc RENAME.

| Hành động | Cho phép | Lý do |
|-----------|----------|-------|
| Thêm field mới vào response | ✅ | Backward compatible |
| Thêm optional query param | ✅ | Backward compatible |
| Đổi tên field | ❌ | Breaking — client cũ bị lỗi |
| Thay đổi data type của field | ❌ | Breaking — parse error ở client |
| Xóa field | ❌ | Breaking — client cũ bị lỗi |
| Thay đổi HTTP method | ❌ | Breaking |
| Thay đổi path | ❌ | Breaking |
| Thêm required field vào request | ❌ | Breaking — client cũ không gửi |

**Nếu cần breaking change:**
1. Dừng lại, không implement.
2. Flag rõ ràng: "Thay đổi này là BREAKING CHANGE tại `[endpoint]` — ảnh hưởng `[field/type]`."
3. Hỏi xác nhận trước khi tiếp tục.

---

## 6. External vs Internal API

### External APIs — `/api/v1/...`

- **Luôn** đi qua API Gateway
- **Luôn** có Auth middleware (JWT validation)
- **Luôn** có Rate Limit
- Response format bắt buộc theo Section 2

### Internal APIs — `/internal/...`

- **Không** expose qua API Gateway
- **Không** cần Auth middleware từ client (service-to-service trust)
- Chỉ được gọi từ service khác trong cùng cluster
- Response format có thể đơn giản hơn (không bắt buộc full `meta`)

| Internal Endpoint | Caller | Target | Timeout |
|-------------------|--------|--------|---------|
| `GET /internal/songs/{songId}/storage-key` | Music Service | Streaming Service | 150ms |
| `GET /internal/songs/batch?ids=...` | Recommendation Service | Music Service | 200ms |

**Ví dụ:**
- ĐÚNG: Recommendation Service gọi `GET http://music-service/internal/songs/batch?ids=s1,s2`
- SAI: Recommendation Service gọi `GET http://api-gateway/api/v1/music/songs/s1` (đi qua Gateway — tốn 1 hop, thêm overhead)

---

## 7. Behavior khi Yêu Cầu Mâu Thuẫn với API Design V2

Khi user yêu cầu implement thứ gì mâu thuẫn với contract, Claude **phải** trả lời theo template:

```
"Yêu cầu này mâu thuẫn với API Design V2 tại [endpoint].

Theo contract:
  - [nội dung contract cụ thể — path, field, error code, v.v.]

Yêu cầu hiện tại:
  - [nội dung yêu cầu của user]

Bạn có muốn update contract trong API_DESIGN_V2.md trước không?
Nếu có, tôi sẽ implement theo contract mới sau khi được xác nhận."
```

**Ví dụ:**
```
User: "Trả về lỗi dạng { error: 'invalid credentials' } khi login sai"

Claude: "Yêu cầu này mâu thuẫn với API Design V2 tại POST /api/v1/auth/login.

Theo contract:
  - Error shape: { 'success': false, 'data': null, 'meta': {...},
                   'error': { 'code': 'AUTH_INVALID_CREDENTIALS', 'message': '...' } }
  - HTTP 400

Yêu cầu hiện tại:
  - { 'error': 'invalid credentials' } — flat string, không có code, không có meta

Bạn có muốn update contract trong API_DESIGN_V2.md trước không?"
```

---

## Quick Reference — Endpoints by Service

| Service | Endpoints |
|---------|-----------|
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| User | `GET /users/me`, `POST /users/me/preferences` |
| Recommendation | `GET /recommendations`, `POST /recommendations/feedback` |
| Streaming | `GET /streaming/{songId}/url`, `GET /streaming/{songId}/chunk` |
| Analytics | `POST /analytics/events/play`, `GET /analytics/creator/heatmap/{songId}`, `GET /analytics/creator/stats/{songId}` |
| Music | `POST /music/songs`, `GET /music/songs/{songId}` |
| Search | `GET /search` |
| Notification | `GET /notifications/unread`, `PATCH /notifications/{id}/read`, `PATCH /notifications/read-all` |
| Party (REST) | `POST /parties`, `POST /parties/{joinCode}/join` |
| Party (WS) | `WS /ws/v1/parties/{roomId}` |

---

## Checklist Cuối — Trước khi Submit Code

- [ ] Đã điền đủ 8 ô Contract-First Checklist?
- [ ] Response format đúng schema (success & error)?
- [ ] Chỉ dùng error codes từ catalogue?
- [ ] Timeout được set ≤ latency budget?
- [ ] Async endpoint trả 202 ngay, không block?
- [ ] Không có breaking change nào chưa được xác nhận?
- [ ] Internal API không đi qua Gateway?
- [ ] Middleware đúng theo contract (Auth, Rate Limit, Idempotency-Key)?
