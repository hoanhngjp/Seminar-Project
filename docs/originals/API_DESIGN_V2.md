# API Design V2 — Smart Music Streaming Platform

> Version 2.0 (Aligned to PRD V5 / Backlog V7)

## Sheet 1: API Design

| Router | Endpoint | Method | Description | Input (req.body / params) | Output (res.body sample) | Middleware | Errors (Unhappy path) | Notes & Constraints | Packages / Libraries | Test Types | Priority | Budget (ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **── EPIC 0 & 1: Authentication & Session Management ──** | | | | | | | | | | | | |
| Auth | /api/v1/auth/login | POST | As a User, I want to login to get access tokens and have my role recognized. | {"username":"user@example.com","password":"pwd"} | {"success":true,"data":{"accessToken":"jwt...","expiresIn":3600},"meta":{"apiVersion":"v1","requestId":"uuid","timestamp":"ISO8601"},"error":null}
Cookie: refreshToken (HTTP-only) | Rate Limit (IP+User 10/min) | 400 AUTH_INVALID_CREDENTIALS
429 RATE_LIMIT_EXCEEDED
423 ACCOUNT_LOCKED (after 5 fails)
500 INTERNAL_ERROR | Budget: 500ms | Safe to retry: YES
Brute-force: lock after 5 fails
Refresh Token Rotation
CorrelationId propagated
Metrics: p95 latency, auth success/fail rate | ASP.NET Core Identity, JWTBearer | Unit, Integration | High | 500 |
| Auth | /api/v1/auth/refresh | POST | As a User, I want to refresh my expired access token. | null (read from HTTP-only Cookie) | {"success":true,"data":{"accessToken":"newJwt..."},"meta":{...},"error":null}
Cookie: newRefreshToken (HTTP-only) | Rate Limit (IP+User 20/min) | 401 TOKEN_EXPIRED
403 TOKEN_REUSED (→ revoke all sessions)
500 INTERNAL_ERROR | Budget: 200ms | Safe to retry: NO
Token is ONE-TIME USE — reuse → revoke entire session
Redis Blacklist TTL = token expiry
CorrelationId propagated | StackExchange.Redis | Unit | High | 200 |
| Auth | /api/v1/auth/logout | POST | As a User, I want to logout to secure my account. | null | {"success":true,"data":true,"meta":{...},"error":null} | Auth (JWT) | 401 UNAUTHORIZED
500 INTERNAL_ERROR | Budget: 150ms | Safe to retry: YES
Clear cookie + append token to Redis Blacklist (TTL = remaining expiry)
CorrelationId propagated | StackExchange.Redis | Unit | High | 150 |
| **── User Service ──** | | | | | | | | | | | | |
| User | /api/v1/users/me | GET | As a User, I want to get my profile info and current role. | null | {"success":true,"data":{"userId":"u1","name":"Nghiep","email":"...","role":"Listener"},"meta":{...,"cache":"MISS"},"error":null} | Auth (JWT)
Rate Limit (Token 100/min) | 401 UNAUTHORIZED
404 USER_NOT_FOUND
500 INTERNAL_ERROR | Budget: 300ms | Safe to retry: YES
Route to Read-Replica DB
Cache: Redis TTL 15m (Key: user:profile:{userId})
Invalidation: on profile update
Metrics: p95 latency, QPS | Npgsql, Entity Framework | Integration | High | 300 |
| User | /api/v1/users/me/preferences | POST | As a New Listener, I want to save onboarding genre/artist preferences (min 3) so recommendations work immediately. | {"genres":["Pop","Acoustic"],"artists":["artistId1","artistId2"]} | {"success":true,"data":true,"meta":{...},"error":null} | Auth (JWT)
Idempotency-Key (Header)
Validation (min 3 items) | 400 VALIDATION_ERROR (< 3 items)
401 UNAUTHORIZED
409 IDEMPOTENCY_CONFLICT
500 INTERNAL_ERROR | Budget: 400ms | Safe to retry: YES (with Idempotency-Key, TTL 24h)
Async Kafka publish: User_Preferences_Updated (v1, at-least-once) → Recommendation Service updates Redis
Metrics: onboarding completion rate, p95 latency | Confluent.Kafka | Integration, Chaos | High | 400 |
| **── EPIC 2: Rule-based Context-Aware Recommendation ──** | | | | | | | | | | | | |
| Recommendation | /api/v1/recommendations | GET | As a Listener, I want context-aware music suggestions with explain_text based on time-of-day, onboarding preferences, and play/skip history. | ?context=morning&limit=10&cursor=abc123 | {"success":true,"data":[{"songId":"s1","title":"Song 1","artist":"Artist 1","thumbnail":"https://...","reason":{"type":"CONTEXT","text":"Gợi ý buổi sáng"}}],"meta":{...,"pagination":{"nextCursor":"xyz","hasMore":true},"cache":"HIT"},"error":null} | Auth (JWT)
Rate Limit (Token 60/min) | 400 VALIDATION_ERROR
401 UNAUTHORIZED
429 RATE_LIMIT_EXCEEDED
503 SERVICE_UNAVAILABLE
500 INTERNAL_ERROR | Budget: 300ms | Safe to retry: YES
Rule Engine signals: (1) time-of-day tag match, (2) onboarding genres, (3) play/skip weight from Redis
Fallback: Top 50 Trending (Redis cache TTL 1h) if Rule Engine timeout > 300ms OR Redis miss
Cursor Pagination
Cache: Redis TTL 1h (Key: recs:{userId}:{context})
Metrics: Cache hit ratio, p95 latency, CTR
NO Vector DB, NO PyTorch — Rule-based only (PRD V5) | Python FastAPI, Redis | Load, Chaos | High | 300 |
| Recommendation | /api/v1/recommendations/feedback | POST | As the System, I want to record a play or skip event so the Rule Engine updates user preference weights in Redis immediately. | {"eventId":"uuid","version":"v1","songId":"s1","action":"PLAY","durationPercent":85} | {"success":true,"data":true,"meta":{...},"error":null} | Auth (JWT)
Idempotency-Key (Header) | 400 VALIDATION_ERROR
401 UNAUTHORIZED
409 IDEMPOTENCY_CONFLICT
500 INTERNAL_ERROR | Budget: 100ms (return 202 Async)
Idempotency via Redis SET (replaces Bloom Filter — PRD V5)
Idempotency TTL: 24h
Kafka publish: Song_Played or Song_Skipped (v1)
PLAY (>80% duration) → increase genre weight in Redis
SKIP (<30% duration) → decrease genre weight in Redis
Weights TTL: 7 days | Confluent.Kafka, StackExchange.Redis | Unit, Load | High | 100 |
| **── EPIC 3: Core Streaming & Delivery ──** | | | | | | | | | | | | |
| Streaming | /api/v1/streaming/{songId}/url | GET | As a Listener, I want a pre-signed streaming URL so my client can fetch audio directly from CDN without routing through the backend. | null (path param: songId) | {"success":true,"data":{"streamUrl":"https://cdn.example.com/s1.mp3?sig=...","expiresIn":900},"meta":{...},"error":null} | Auth (JWT)
Rate Limit (Token 120/min) | 401 UNAUTHORIZED
403 FORBIDDEN
404 SONG_NOT_FOUND
429 RATE_LIMIT_EXCEEDED
500 INTERNAL_ERROR | Budget: 150ms | Safe to retry: YES
Pre-signed URL expiry: 15 minutes (900s) — short-lived for security
Streaming Service is STATELESS — reads from S3 only
Fallback: secondary CDN if primary fails
S3 timeout > 1s → retry Exponential Backoff (max 3)
Metrics: stream request latency, error rate, CDN hit ratio | AWS SDK S3 | Integration, Load | High | 150 |
| Streaming | /api/v1/streaming/{songId}/chunk | GET | As a Listener, I want HTTP Range Requests so seeking works smoothly and playback starts in under 1 second. | Header: Range: bytes=0-65535
(path param: songId) | HTTP 206 Partial Content
Content-Range: bytes 0-65535/total_size
Body: audio chunk binary | Auth (JWT)
Rate Limit (Token 120/min) | 206 Partial Content (success)
416 Range Not Satisfiable
401 UNAUTHORIZED
404 SONG_NOT_FOUND
500 INTERNAL_ERROR | Budget: < 1s first chunk | Safe to retry: YES
HTTP Range Requests (RFC 7233) — HTTP 206 Partial Content
Chunk-based streaming: ~64KB chunks
Bandwidth control at CDN: ~50-100 MB/s peak
CDN miss → fetch from Origin with bandwidth throttling
Metrics: time-to-first-byte, chunk error rate | AWS SDK S3, CDN SDK | Integration, Load, Chaos | High | 1000 |
| **── EPIC 4: Analytics & Creator Dashboard ──** | | | | | | | | | | | | |
| Analytics | /api/v1/analytics/events/play | POST | As the System, I want to track async playback events without blocking the user's stream speed. | {"eventId":"uuid","version":"v1","songId":"s1","durationSec":45,"durationPercent":85} | {"success":true,"data":true,"meta":{...},"error":null} | Auth (JWT)
Idempotency-Key (Header) | 400 VALIDATION_ERROR
401 UNAUTHORIZED
409 IDEMPOTENCY_CONFLICT
500 INTERNAL_ERROR | Budget: 50ms (return 202 Accepted immediately — async)
Idempotency via Redis SET (TTL 24h) → effectively-once
Kafka publish: Song_Played (v1, at-least-once)
DLQ: retry 3x Exponential Backoff → Dead Letter Queue (retain 7 days)
Fallback: local disk queue if Kafka down
Analytics DB: Append-only (Time-series) | Confluent.Kafka, StackExchange.Redis | Unit, Load | High | 50 |
| Analytics | /api/v1/analytics/creator/heatmap/{songId} | GET | As a Creator, I want to see a skip-rate heatmap by second so I know where listeners drop off. | ?timeRange=7d
(path param: songId) | {"success":true,"data":{"songId":"s1","dropOffs":[{"second":120,"count":45},{"second":180,"count":32}]},"meta":{...},"error":null} | Auth (JWT)
RBAC (Creator or Admin only)
Rate Limit (Token 30/min) | 401 UNAUTHORIZED
403 FORBIDDEN
404 SONG_NOT_FOUND
500 INTERNAL_ERROR | Budget: 500ms | Safe to retry: YES
RBAC: only Creator who owns the song OR Admin can access
Aggregation query on Time-series DB / Read-Replica
Cache: Redis TTL 6h (Key: heatmap:{songId}:{timeRange})
Stale cache served on timeout — no crash
timeRange values: 7d, 30d | InfluxDB Client / MongoDB Driver | Integration | High | 500 |
| Analytics | /api/v1/analytics/creator/stats/{songId} | GET | As a Creator, I want to see daily active listeners and unique users for my song. | ?timeRange=7d
(path param: songId) | {"success":true,"data":{"songId":"s1","dailyListeners":[{"date":"2026-04-24","count":230}],"uniqueUsers":1420},"meta":{...},"error":null} | Auth (JWT)
RBAC (Creator or Admin only)
Rate Limit (Token 30/min) | 401 UNAUTHORIZED
403 FORBIDDEN
404 SONG_NOT_FOUND
500 INTERNAL_ERROR | Budget: 500ms | Safe to retry: YES
Aggregation from Time-series DB
Cache: Redis TTL 1h (Key: stats:{songId}:{timeRange})
Data updated daily via Kafka event pipeline | InfluxDB Client / MongoDB Driver | Integration | High | 500 |
| **── Music Service (Creator Upload) ──** | | | | | | | | | | | | |
| Music | /api/v1/music/songs | POST | As a Creator, I want to upload an audio file and song metadata so my music is available on the platform. | multipart/form-data:
- file: audio (MP3/WAV, max 50MB)
- title: string
- genre: string
- mood: string
- artistId: string | {"success":true,"data":{"songId":"s1","title":"My Song","status":"PROCESSING"},"meta":{...},"error":null} | Auth (JWT)
RBAC (Creator only)
Idempotency-Key (Header)
Validation (file type, size) | 400 VALIDATION_ERROR (wrong format / >50MB)
401 UNAUTHORIZED
403 FORBIDDEN
409 IDEMPOTENCY_CONFLICT
413 PAYLOAD_TOO_LARGE
500 INTERNAL_ERROR | Budget: 5000ms (file upload — different SLO)
S3 upload with retry (max 3x Exponential Backoff)
Do NOT commit to DB if S3 upload fails (atomicity)
After success: publish New_Release (v1) to Kafka → Notification Service
Idempotency TTL: 24h | AWS SDK S3, Confluent.Kafka | Integration, Chaos | High | 5000 |
| Music | /api/v1/music/songs/{songId} | GET | As a Listener or Creator, I want to get song metadata (title, artist, genre, mood, duration). | null (path param: songId) | {"success":true,"data":{"songId":"s1","title":"My Song","artist":"Artist A","genre":"Pop","mood":"Energetic","durationSec":210},"meta":{...,"cache":"HIT"},"error":null} | Auth (JWT)
Rate Limit (Token 200/min) | 401 UNAUTHORIZED
404 SONG_NOT_FOUND
500 INTERNAL_ERROR | Budget: 200ms | Safe to retry: YES
Cache: Redis TTL 30m (Key: song:meta:{songId})
Route to Read-Replica DB | Npgsql / MongoDB Driver | Integration | Medium | 200 |
| **── EPIC 5: Search ──** | | | | | | | | | | | | |
| Search | /api/v1/search | GET | As a Listener, I want to fuzzy search songs and artists with typo tolerance. | ?q=son+tug&type=all&limit=10&cursor=idx1 | {"success":true,"data":[{"id":"a1","name":"Sơn Tùng M-TP","type":"artist","score":0.98}],"meta":{...,"pagination":{"nextCursor":"idx2","hasMore":false},"cache":"HIT"},"error":null} | Auth (JWT)
Rate Limit (Token 60/min) | 400 VALIDATION_ERROR
401 UNAUTHORIZED
429 RATE_LIMIT_EXCEEDED
500 INTERNAL_ERROR | Budget: 200ms | Safe to retry: YES
Elasticsearch Read-Replica for fuzzy matching
Cache frequent queries: Redis TTL 10m
Fallback: return empty array [] on timeout — no error exposed
Cursor Pagination
Metrics: p95 latency, cache hit ratio | Elasticsearch.Net / Npgsql | Integration | Medium | 200 |
| **── EPIC 6: Notification ──** | | | | | | | | | | | | |
| Notification | /api/v1/notifications/unread | GET | As a Listener, I want to view my unread notifications (e.g., new releases from artists I follow). | ?limit=20&cursor=notif123 | {"success":true,"data":[{"notificationId":"n1","message":"Sơn Tùng vừa ra bài mới!","read":false,"createdAt":"ISO8601"}],"meta":{...,"pagination":{"nextCursor":"notif143","hasMore":true}},"error":null} | Auth (JWT)
Rate Limit (Token 60/min) | 400 VALIDATION_ERROR
401 UNAUTHORIZED
500 INTERNAL_ERROR | Budget: 150ms | Safe to retry: YES
Cursor Pagination
Fan-out via Kafka (New_Release v1 → Notification_Sent v1)
MongoDB for notification logs | MongoDB.Driver, Confluent.Kafka | Unit, Integration | Medium | 150 |
| Notification | /api/v1/notifications/{notificationId}/read | PATCH | As a Listener, I want to mark a specific notification as read. | null (path param: notificationId) | {"success":true,"data":true,"meta":{...},"error":null} | Auth (JWT)
Idempotency-Key (Header) | 400 VALIDATION_ERROR
401 UNAUTHORIZED
404 NOTIFICATION_NOT_FOUND
409 IDEMPOTENCY_CONFLICT
500 INTERNAL_ERROR | Budget: 150ms | Safe to retry: YES (with Idempotency-Key, TTL 24h) | MongoDB.Driver | Unit | Medium | 150 |
| Notification | /api/v1/notifications/read-all | PATCH | As a Listener, I want to mark all notifications as read in one action. | null | {"success":true,"data":{"updatedCount":5},"meta":{...},"error":null} | Auth (JWT)
Idempotency-Key (Header) | 401 UNAUTHORIZED
409 IDEMPOTENCY_CONFLICT
500 INTERNAL_ERROR | Budget: 200ms | Safe to retry: YES (with Idempotency-Key, TTL 24h)
Background async update if count is very large | MongoDB.Driver | Integration | Medium | 200 |
| **── EPIC 7: Realtime Listening Party (Phase 2) ──** | | | | | | | | | | | | |
| Party | /api/v1/parties | POST | As a Listener, I want to create a listening room and get a join code to share with friends. | {"name":"Chill Session"} | {"success":true,"data":{"roomId":"r1","joinCode":"XYZ123"},"meta":{...},"error":null} | Auth (JWT)
Idempotency-Key (Header) | 400 VALIDATION_ERROR
401 UNAUTHORIZED
409 IDEMPOTENCY_CONFLICT
500 INTERNAL_ERROR | Budget: 200ms | Safe to retry: YES (Idempotency-Key TTL 24h)
Ephemeral state on Redis cluster
Trade-off: room state LOST if Redis crashes — documented in PRD V5
Metrics: room creation rate | StackExchange.Redis | Unit | High | 200 |
| Party | /api/v1/parties/{joinCode}/join | POST | As a Listener, I want to join a party using a join code and immediately get the current playback state. | null (path param: joinCode) | {"success":true,"data":{"roomId":"r1","hostId":"u1","currentSongId":"s1","playbackPositionSec":45},"meta":{...},"error":null} | Auth (JWT)
Rate Limit (Token 30/min) | 400 VALIDATION_ERROR
401 UNAUTHORIZED
404 ROOM_NOT_FOUND
429 RATE_LIMIT_EXCEEDED
500 INTERNAL_ERROR | Budget: 150ms | Safe to retry: YES
Sync initial state from Redis (Host is Source of Truth)
Max members per room: configurable (default 50) | StackExchange.Redis | Unit, Integration | High | 150 |
| Party | /ws/v1/parties/{roomId} | WS | As a Party Member, I want realtime sync of Play/Pause/Seek from the Host so we all hear the same music at the same time. | Send: {"eventId":"uuid","type":"PLAYER_ACTION","senderId":"u2","payload":{"action":"pause"},"timestamp":123456} | Receive: {"eventId":"uuid","type":"SYNC_STATE","senderId":"system","payload":{"status":"paused","positionSec":45},"timestamp":123457} | Auth (JWT via query param on WS handshake) | WS 1008 POLICY_VIOLATION (unauthorized)
WS 1011 INTERNAL_ERROR
WS 1001 GOING_AWAY (server shutdown) | Safe to retry: YES (dedup via eventId)
Heartbeat: Ping every 30s, Pong timeout 10s → disconnect
Reconnect: Exponential Backoff (1s, 2s, 4s… max 30s)
Host Authority: only Host's PLAYER_ACTION is applied
Conflict: server applies Host state, broadcasts correction to all
Host disconnect > 5s: auto re-election (lowest latency member)
Backpressure: server buffer — drop oldest if client too slow | Microsoft.AspNetCore.SignalR | Load, Chaos | High | 500 |

## Sheet 2: Kafka Events

> KAFKA EVENT DESIGN — Smart Music Streaming Platform  |  Version 2.0 (Aligned to PRD V5)

| Topic / Event | Version | Producer | Consumer(s) | Trigger | Key Payload Fields | Delivery Guarantee | Idempotency | DLQ / Error Handling | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Song_Played | v1 | Streaming Service | Analytics Service
Recommendation Service | User listens to a song (play event fired) | {"eventId":"uuid","version":"v1","userId":"u1","songId":"s1","durationSec":180,"durationPercent":86} | at-least-once | Redis SET (eventId key, TTL 24h)
→ effectively-once on consumer | Retry 3x Exp. Backoff
→ DLQ (retain 7 days)
Fallback: local disk queue if Kafka down | High |
| Song_Skipped | v1 | Streaming Service | Analytics Service
Recommendation Service | User skips a song before 30% duration | {"eventId":"uuid","version":"v1","userId":"u1","songId":"s1","skipAtSec":42,"durationPercent":20} | at-least-once | Redis SET (eventId key, TTL 24h) | Retry 3x Exp. Backoff → DLQ (7 days) | High |
| User_Preferences_Updated | v1 | User Service | Recommendation Service | Listener completes onboarding (saves genres/artists) | {"eventId":"uuid","version":"v1","userId":"u1","genres":["Pop","Acoustic"],"artistIds":["a1","a2"]} | at-least-once | Idempotency-Key header → Redis SET TTL 24h | Retry 3x Exp. Backoff → DLQ (7 days)
Non-fatal: user gets fallback recs until event processed | High |
| New_Release | v1 | Music Service | Notification Service | Creator uploads and publishes a new song | {"eventId":"uuid","version":"v1","artistId":"a1","songId":"s1","title":"New Song","genre":"Pop"} | at-least-once | Redis SET (eventId key, TTL 24h) | Retry 3x Exp. Backoff → DLQ (7 days)
Fan-out partial fail: async retry per follower | Medium |
| Notification_Sent | v1 | Notification Service | Analytics Service | Notification successfully delivered to a user | {"eventId":"uuid","version":"v1","notificationId":"n1","userId":"u1","type":"NEW_RELEASE","deliveredAt":"ISO8601"} | at-least-once | Redis SET (eventId key, TTL 24h) | Best effort — Analytics is non-critical. Drop if Kafka lag > 10s (sampling 50%). | Low |

## Sheet 3: Internal APIs

> INTERNAL API DESIGN — gRPC & Service-to-Service  |  Version 2.0 (Aligned to PRD V5)

| Protocol | Caller Service | Target Service | Method / Channel | Description | Request | Response | Timeout | Fallback / Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gRPC | API Gateway | Auth Service | ValidateToken(token: string) | Gateway calls Auth Service to verify JWT on every protected request. Hot path — must be fastest call in system. | {"token":"Bearer jwt..."} | {"valid":true,"userId":"u1","role":"Listener","expiresAt":1714000000} | 100ms | Fallback: if Auth Service down, Gateway uses cached public keys (RSA) to verify JWT locally. Circuit Breaker triggers after 3 consecutive failures. |
| gRPC | Auth Service | User Service | GetUserProfile(userId: string) | Auth Service fetches full user profile and role from User Service after token validation. | {"userId":"u1"} | {"userId":"u1","name":"Nghiep","email":"...","role":"Listener","createdAt":"ISO8601"} | 100ms | Route to Read-Replica DB. Fallback: return cached profile from Redis (TTL 15m). Circuit Breaker on consecutive failures. |
| REST | Music Service | Streaming Service | GET /internal/songs/{songId}/storage-key | Music Service provides S3 storage key to Streaming Service for generating Pre-signed URLs. | Path param: songId | {"storageKey":"songs/s1/audio.mp3","mimeType":"audio/mpeg","durationSec":210} | 150ms | Internal network only — not exposed via API Gateway. Cache result in Streaming Service for 30m. 404 if song not found or not published yet. |
| REST | Recommendation Service | Music Service | GET /internal/songs/batch?ids=s1,s2,s3 | Recommendation Service fetches song metadata (title, artist, genre) to enrich recommendation response. | Query param: ids (comma-separated songIds, max 50) | [{"songId":"s1","title":"Song 1","artist":"Artist A","genre":"Pop","thumbnail":"url"},...] | 200ms | Batch request to minimize network calls. Cache in Recommendation Service Redis (TTL 30m). If Music Service unavailable: return recommendations without metadata enrichment (degrade gracefully). |
| Kafka | Streaming Service | Recommendation Service | Song_Played / Song_Skipped events (v1) | Async: Streaming Service publishes events → Recommendation Service updates Redis weight scores. | See Kafka Events sheet for full payload schema | 202 Accepted (async — no direct response) | at-least-once delivery. Idempotency via Redis SET. DLQ after 3 retries. Weight update: PLAY (+weight), SKIP (-weight) per genre, TTL 7 days. |  |
| Kafka | Music Service | Notification Service | New_Release event (v1) | Async: Music Service publishes new release → Notification Service fans out to all followers. | See Kafka Events sheet for full payload schema | 202 Accepted (async — no direct response) | at-least-once delivery. Fan-out: Notification Service reads follower list from User Service. Partial fan-out failures retried independently per user. |  |
| WebSocket | Listening Party Service | All Party Members | /ws/v1/parties/{roomId} | Bidirectional realtime channel. Host sends PLAYER_ACTION → server broadcasts SYNC_STATE to all members. | Client → Server:
{"eventId":"uuid","type":"PLAYER_ACTION","payload":{"action":"pause"}} | Server → Client:
{"eventId":"uuid","type":"SYNC_STATE","payload":{"status":"paused","positionSec":45}} | < 500ms | Host authority: only Host's actions applied. Heartbeat 30s. Reconnect: Expo Backoff. Host disconnect >5s → auto re-election. State stored in Redis (ephemeral — trade-off accepted). |

## Sheet 4: Changelog

| Version | Date | Change Summary | Impact | Author |
| --- | --- | --- | --- | --- |
| v1.0 | 2026-04-15 | Initial API Design (V1): Auth, User, Recommendation (ML-based), Streaming, Analytics, Party, Search, Notification. | Baseline | Team |
| v2.0 | 2026-04-24 | Revised to align with PRD V5 / Backlog V7:
1. Recommendation: replaced ML/Vector DB with Rule-based Context Engine. Removed PyTorch dependency.
2. Added /recommendations/feedback endpoint for realtime weight update.
3. Bloom Filter replaced with Redis SET for idempotency dedup.
4. gRPC limited to 2 calls: Gateway→Auth (ValidateToken) and Auth→User (GetUserProfile).
5. Added Music Upload endpoints (POST /music/songs, GET /music/songs/{songId}).
6. Added Creator Stats endpoint (GET /analytics/creator/stats/{songId}).
7. Added Streaming /chunk endpoint for HTTP Range Request detail.
8. Added Internal APIs sheet (gRPC, internal REST, Kafka, WebSocket).
9. Kafka Events sheet revised: 5 topics only, removed over-engineered topics.
10. CTR target lowered from >15% to >10% (rule-based vs ML). | Breaking (Recommendation) | Team |
