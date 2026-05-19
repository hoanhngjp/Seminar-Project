# Sequence Diagrams — Mermaid Code
## Smart Music Streaming Platform | PRD V5 / Backlog V7 / Use Case V1

Paste từng block vào https://mermaid.live để preview và export PNG/SVG.

---

## SD-01 — Login & Onboarding (UC-01, UC-03)

```mermaid
sequenceDiagram
  autonumber
  actor U as User (Listener)
  participant GW as API Gateway
  participant AS as Auth Service
  participant US as User Service
  participant RD as Redis
  participant KF as Kafka
  participant RS as Recommendation Service

  Note over U,RS: UC-01 — Login
  U->>GW: POST /api/v1/auth/login {email, password}
  GW->>AS: gRPC ValidateCredentials(email, pwd)
  AS->>US: gRPC GetUserProfile(email)
  US-->>AS: {userId, role, passwordHash}
  AS->>AS: Verify password hash
  AS->>RD: Check account lock status
  RD-->>AS: not locked
  AS->>RD: Store Refresh Token (HTTP-only Cookie TTL)
  AS-->>GW: {accessToken, refreshToken}
  GW-->>U: 200 OK — Bearer Token + Set-Cookie: refreshToken

  Note over U,RS: UC-03 — Onboarding (first-time only)
  U->>GW: POST /api/v1/users/me/preferences {genres:[...], artists:[...]} + Idempotency-Key
  GW->>AS: gRPC ValidateToken
  AS-->>GW: valid, role=Listener
  GW->>US: Save preferences to PostgreSQL
  US-->>GW: 200 OK
  GW->>KF: Publish User_Preferences_Updated (v1)
  KF-->>RS: Consume event
  RS->>RD: Update genre weights in Redis (TTL 7d)
  GW-->>U: 200 OK — onboarding complete

  Note over U,RS: ALT — Login fail
  rect rgb(252,235,235)
    U->>GW: POST /login {wrong password}
    GW->>AS: gRPC ValidateCredentials
    AS-->>GW: 400 AUTH_INVALID_CREDENTIALS
    GW-->>U: 400 AUTH_INVALID_CREDENTIALS
    Note over AS: After 5 fails → 423 ACCOUNT_LOCKED
  end
```

---

## SD-02 — Refresh Token & Logout (UC-02, UC-01)

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant GW as API Gateway
  participant AS as Auth Service
  participant RD as Redis (Blacklist)

  Note over U,RD: UC-02 — Refresh Token (Rotation)
  U->>GW: POST /api/v1/auth/refresh (Cookie: refreshToken — auto sent)
  GW->>AS: Forward refresh request
  AS->>RD: Check token in Blacklist
  RD-->>AS: not blacklisted
  AS->>AS: Validate Refresh Token signature & expiry
  AS->>RD: Blacklist old Refresh Token (TTL = remaining expiry)
  AS->>AS: Issue new Access Token + new Refresh Token
  AS-->>GW: {newAccessToken} + Set-Cookie: newRefreshToken
  GW-->>U: 200 OK — new tokens

  Note over U,RD: ALT — Token Reuse Attack
  rect rgb(252,235,235)
    U->>GW: POST /refresh (reused old token)
    GW->>AS: Forward
    AS->>RD: Check Blacklist
    RD-->>AS: FOUND — token already used!
    AS->>RD: Revoke ALL tokens of this user (full session kill)
    AS-->>GW: 403 TOKEN_REUSED
    GW-->>U: 403 TOKEN_REUSED — forced re-login
  end

  Note over U,RD: UC-01 — Logout
  U->>GW: POST /api/v1/auth/logout
  GW->>AS: gRPC ValidateToken (get userId, expiry)
  AS->>RD: Blacklist Access Token (TTL = remaining expiry)
  AS->>RD: Delete Refresh Token from store
  AS-->>GW: success
  GW-->>U: 200 OK + Clear-Cookie: refreshToken
```

---

## SD-03 — Phát nhạc + Analytics Tracking (UC-05, UC-22)

```mermaid
sequenceDiagram
  autonumber
  actor U as Listener
  participant GW as API Gateway
  participant SS as Streaming Service
  participant MS as Music Service
  participant S3 as S3 / CDN
  participant KF as Kafka
  participant ANS as Analytics Service
  participant RS as Recommendation Service
  participant RD as Redis

  Note over U,RD: UC-05 — Phát nhạc (Happy Path)
  U->>GW: GET /api/v1/streaming/{songId}/url
  GW->>SS: Route request (auth verified)
  SS->>MS: REST GET /internal/songs/{songId}/storage-key
  MS-->>SS: {storageKey, mimeType, durationSec}
  SS->>S3: Generate Pre-signed URL (TTL 15 min)
  S3-->>SS: presignedUrl
  SS-->>GW: {streamUrl, expiresIn: 900}
  GW-->>U: 200 OK {streamUrl}

  U->>S3: GET audio chunks via CDN (HTTP Range Requests)
  S3-->>U: HTTP 206 Partial Content (chunks)
  Note over U: Nhạc bắt đầu phát < 1s

  Note over U,RD: UC-22 — Analytics Tracking (async, <<include>>)
  U->>GW: POST /api/v1/analytics/events/play {eventId, songId, durationSec} + Idempotency-Key
  GW->>ANS: Route (202 ngay lập tức)
  ANS-->>GW: 202 Accepted
  GW-->>U: 202 Accepted (không block stream)
  ANS->>RD: Check idempotency (Redis SET eventId TTL 24h)
  RD-->>ANS: not duplicate
  ANS->>KF: Publish Song_Played (v1, at-least-once)
  KF-->>ANS: ack
  KF-->>RS: Consume Song_Played
  RS->>RD: Update genre weight (+play_bonus, TTL 7d)

  Note over U,RD: EX — S3 Timeout / CDN Fail
  rect rgb(252,235,235)
    U->>S3: GET chunk (CDN miss)
    S3-->>SS: timeout > 1s
    SS->>S3: Retry (Exponential Backoff x3)
    SS->>S3: Fallback: fetch from Origin Server
    S3-->>U: HTTP 206 (from origin, bandwidth throttled)
  end
```

---

## SD-04 — Recommendation + Feedback Loop (UC-08, UC-09, UC-23)

```mermaid
sequenceDiagram
  autonumber
  actor U as Listener
  participant GW as API Gateway
  participant RS as Recommendation Service
  participant RD as Redis
  participant MS as Music Service
  participant KF as Kafka

  Note over U,KF: UC-08 — Xem gợi ý nhạc (Rule Engine)
  U->>GW: GET /api/v1/recommendations?context=morning&limit=10
  GW->>RS: Route request
  RS->>RD: Check cache (Key: recs:{userId}:morning TTL 1h)
  alt Cache HIT
    RD-->>RS: cached result
    RS-->>GW: 200 OK {songs + explain_text} meta.cache=HIT
    GW-->>U: recommendations
  else Cache MISS
    RD-->>RS: miss
    RS->>RD: Get user preference weights (Key: pref:{userId})
    RS->>RD: Get trending sorted set (Key: trending:global)
    RD-->>RS: weights + trending data
    RS->>RS: Rule Engine scoring: score = base + context_bonus + pref_bonus - skip_penalty
    RS->>MS: REST /internal/songs/batch?ids=s1,s2,s3
    MS-->>RS: song metadata (title, artist, thumbnail)
    RS->>RD: Cache result (TTL 1h)
    RS-->>GW: 200 OK {songs + explain_text} meta.cache=MISS
    GW-->>U: recommendations
  end

  Note over U,KF: ALT — Rule Engine timeout (Graceful Degradation)
  rect rgb(255,248,225)
    RS->>RS: timeout > 300ms
    RS->>RD: Get Top 50 Trending (edge cache)
    RD-->>RS: trending list
    RS-->>GW: 200 OK {trending songs} explain_text=Đang thịnh hành
    GW-->>U: fallback recommendations
  end

  Note over U,KF: UC-09 — Feedback Loop (Play/Skip → Weight update)
  U->>GW: POST /recommendations/feedback {eventId, songId, action:SKIP, durationPercent:20}
  GW->>RS: Route (return 202 immediately)
  RS-->>GW: 202 Accepted
  GW-->>U: 202 Accepted
  RS->>RD: Idempotency check (Redis SET eventId TTL 24h)
  RD-->>RS: not duplicate
  RS->>KF: Publish Song_Skipped (v1)
  RS->>RD: genre_weight -= skip_penalty (TTL 7d)
  Note over RS,RD: PLAY >80%: weight += play_bonus / SKIP <30%: weight -= skip_penalty
```

---

## SD-05 — Music Upload + Notification Fan-out (UC-14, UC-24)

```mermaid
sequenceDiagram
  autonumber
  actor C as Creator
  participant GW as API Gateway
  participant MS as Music Service
  participant S3 as S3 Storage
  participant KF as Kafka
  participant NS as Notification Service
  participant US as User Service
  participant MDB as MongoDB

  Note over C,MDB: UC-14 — Upload nhạc (Creator)
  C->>GW: POST /api/v1/music/songs multipart: {file, title, genre, mood} + Idempotency-Key
  GW->>GW: RBAC check → Creator role ✓
  GW->>MS: Route upload request
  MS->>MS: Validate: format MP3/WAV, size ≤ 50MB
  MS->>S3: Upload audio file (Exponential Backoff if fail)
  S3-->>MS: storageKey confirmed
  MS->>MS: Commit metadata to PostgreSQL (only after S3 success — atomicity)
  MS-->>GW: 200 OK {songId, status: PROCESSING}
  GW-->>C: 200 OK — song published

  Note over C,MDB: UC-24 — Fan-out Notification (async, <<include>>)
  MS->>KF: Publish New_Release (v1) {artistId, songId, title, genre}
  KF-->>NS: Consume New_Release event
  NS->>US: REST GET /internal/artists/{artistId}/followers
  US-->>NS: [followerId1, followerId2, ...]
  loop For each follower (async fan-out)
    NS->>MDB: Insert notification record {userId, message, read:false}
  end
  NS->>KF: Publish Notification_Sent (v1)
  Note over NS: DLQ after 3 retries per follower

  Note over C,MDB: EX — S3 Upload Fail
  rect rgb(252,235,235)
    MS->>S3: Upload attempt 1 → fail
    MS->>S3: Retry 2 (Exponential Backoff)
    MS->>S3: Retry 3 → fail
    MS-->>GW: 503 SERVICE_UNAVAILABLE
    GW-->>C: 503 — upload failed, no DB commit
    Note over MS: Atomicity: DB not committed if S3 fails
  end
```

---

## SD-06 — Listening Party: Create, Join & Host Sync (UC-10, UC-11, UC-12)

```mermaid
sequenceDiagram
  autonumber
  actor H as Host (Listener)
  actor M as Member (Listener)
  participant GW as API Gateway
  participant PS as Party Service
  participant RD as Redis (ephemeral)
  participant WS as WebSocket Server

  Note over H,WS: UC-10 — Tạo phòng
  H->>GW: POST /api/v1/parties {name} + Idempotency-Key
  GW->>PS: Create room
  PS->>RD: Store room state {roomId, hostId, currentSongId, positionSec}
  RD-->>PS: OK
  PS-->>GW: {roomId, joinCode: XYZ123}
  GW-->>H: 200 OK — share joinCode with friends

  Note over H,WS: UC-11 — Member tham gia
  M->>GW: POST /api/v1/parties/XYZ123/join
  GW->>PS: Validate joinCode
  PS->>RD: GET room state by joinCode
  RD-->>PS: {roomId, hostId, currentSongId, positionSec:45}
  PS-->>GW: room snapshot
  GW-->>M: 200 OK {roomId, hostId, currentSongId, positionSec}
  M->>WS: WSS /ws/v1/parties/{roomId} (upgrade)
  WS-->>M: Connected — begin receiving SYNC_STATE

  Note over H,WS: UC-12 — Host điều khiển → Sync tới Members
  H->>WS: PLAYER_ACTION {action: pause, eventId: uuid}
  WS->>WS: Validate: sender == hostId ✓
  WS->>RD: Update state {status: paused, positionSec: 92}
  WS-->>H: ACK
  WS-->>M: SYNC_STATE {status: paused, positionSec: 92}
  Note over M: Sync delay < 500ms

  Note over H,WS: ALT — Member gửi action (bị từ chối)
  rect rgb(252,235,235)
    M->>WS: PLAYER_ACTION {action: skip}
    WS->>WS: Validate: sender != hostId ✗
    WS-->>M: REJECTED — only Host can control playback
  end

  Note over H,WS: EX — Host disconnect → Re-election
  rect rgb(255,248,225)
    H->>WS: [disconnect]
    WS->>WS: Detect Host disconnect > 5s
    WS->>RD: Find member with lowest latency
    RD-->>WS: memberId=M
    WS->>RD: Update hostId = M
    WS-->>M: HOST_ELECTED — you are now the Host
    WS-->>M: SYNC_STATE broadcast to all remaining members
  end
```

---

## SD-07 — Member Reconnect & Resync (UC-13)

```mermaid
sequenceDiagram
  autonumber
  actor M as Member
  participant WS as WebSocket Server
  participant GW as API Gateway
  participant PS as Party Service
  participant RD as Redis

  Note over M,RD: UC-13 — Member mất mạng → Reconnect
  M->>WS: [network disconnected]
  WS->>WS: Detect disconnect, clean up member slot

  loop Exponential Backoff: 1s → 2s → 4s → max 30s
    M->>WS: WSS reconnect attempt
    WS-->>M: [connection refused — server busy]
  end

  M->>WS: WSS reconnect (success)
  WS-->>M: Connected

  Note over M,RD: Resync current playback state
  M->>GW: POST /api/v1/parties/{joinCode}/join (re-join)
  GW->>PS: Validate joinCode
  PS->>RD: GET current room state (Host is Source of Truth)
  RD-->>PS: {currentSongId, positionSec: 187, status: playing}
  PS-->>GW: room snapshot
  GW-->>M: 200 OK {currentSongId, positionSec: 187}
  M->>WS: WSS upgrade to room channel
  WS-->>M: Resume SYNC_STATE stream from positionSec 187
  Note over M: Đã bắt kịp Host — nghe cùng vị trí

  Note over M,RD: EX — Phòng đã bị xóa khỏi Redis
  rect rgb(252,235,235)
    M->>GW: POST /parties/{joinCode}/join
    GW->>PS: Validate joinCode
    PS->>RD: GET room state
    RD-->>PS: nil — room expired or Redis crashed
    PS-->>GW: 404 ROOM_NOT_FOUND
    GW-->>M: 404 — Phòng đã kết thúc
    Note over M: Redirect về Home screen
  end

  Note over M,RD: Heartbeat mechanism (always active)
  loop Every 30 seconds
    WS->>M: PING
    M->>WS: PONG
  end
  Note over WS: No PONG in 10s → force disconnect & clean state
```

---

## SD-08 — Search + Creator Analytics Dashboard (UC-04, UC-15, UC-16)

```mermaid
sequenceDiagram
  autonumber
  actor U as Listener
  actor C as Creator
  participant GW as API Gateway
  participant SRS as Search Service
  participant ES as Elasticsearch
  participant RD as Redis
  participant ANS as Analytics Service
  participant IDB as InfluxDB (Time-series)

  Note over U,IDB: UC-04 — Tìm kiếm bài hát / nghệ sĩ
  U->>GW: GET /api/v1/search?q=son+tug&type=all&limit=10
  GW->>SRS: Route search request
  SRS->>RD: Check cache (Key: search:son+tug:all TTL 10m)
  alt Cache HIT
    RD-->>SRS: cached results
    SRS-->>GW: 200 OK {results, meta.cache: HIT}
    GW-->>U: search results
  else Cache MISS
    RD-->>SRS: miss
    SRS->>ES: Fuzzy search query (Read-Replica) match: {title, artist} fuzziness:AUTO
    ES-->>SRS: [{id, name, type, score}] sorted by relevance
    SRS->>RD: Cache results (TTL 10m)
    SRS-->>GW: 200 OK {results, meta.cache: MISS}
    GW-->>U: search results
  end

  Note over U,IDB: EX — Elasticsearch timeout
  rect rgb(252,235,235)
    SRS->>ES: query timeout
    SRS-->>GW: 200 OK {data: [], meta: warning}
    GW-->>U: empty results (no error exposed)
  end

  Note over C,IDB: UC-15 — Creator xem Heatmap Skip-rate
  C->>GW: GET /analytics/creator/heatmap/{songId}?timeRange=7d
  GW->>GW: RBAC check → Creator owns song ✓
  GW->>ANS: Route request
  ANS->>RD: Check cache (Key: heatmap:{songId}:7d TTL 6h)
  alt Cache HIT
    RD-->>ANS: cached heatmap
  else Cache MISS
    ANS->>IDB: Aggregate skip events by second GROUP BY skipAtSec WHERE songId=s1 AND timeRange=7d
    IDB-->>ANS: [{second:120, count:45}, {second:180, count:32}]
    ANS->>RD: Cache result (TTL 6h)
  end
  ANS-->>GW: 200 OK {dropOffs:[...]}
  GW-->>C: heatmap data → render chart

  Note over C,IDB: UC-16 — Creator xem Daily Stats
  C->>GW: GET /analytics/creator/stats/{songId}?timeRange=7d
  GW->>ANS: Route request
  ANS->>IDB: Query daily_listeners and unique_users (7d)
  IDB-->>ANS: {dailyListeners:[...], uniqueUsers: 1420}
  ANS-->>GW: 200 OK stats data
  GW-->>C: stats → render chart
```

---

---

## SD-09 — Notification Read & Mark-All (UC-17, UC-18)

```mermaid
sequenceDiagram
  autonumber
  actor U as User (Listener/Creator)
  participant GW as API Gateway
  participant NS as Notification Service
  participant RD as Redis (Idempotency)
  participant MDB as MongoDB
  participant BG as Background Worker

  Note over U,MDB: UC-17 — Đánh dấu một notification đã đọc
  U->>GW: PATCH /api/v1/notifications/{id}/read + Idempotency-Key header
  GW->>GW: ValidateToken → userId extracted from JWT claims
  GW->>NS: Route request (150ms budget)
  NS->>NS: Validate Idempotency-Key header present
  NS->>RD: SETNX notification:idem:{key} TTL 24h
  alt Idempotency-Key đã tồn tại (duplicate request)
    RD-->>NS: SET NX = false (key exists)
    NS-->>GW: 409 IDEMPOTENCY_CONFLICT
    GW-->>U: 409 IDEMPOTENCY_CONFLICT
  else First-time request
    RD-->>NS: SET NX = true (key stored)
    NS->>MDB: FindById(notificationId)
    alt Notification không tồn tại
      MDB-->>NS: null
      NS-->>GW: 404 NOTIFICATION_NOT_FOUND
      GW-->>U: 404 NOTIFICATION_NOT_FOUND
    else Notification tồn tại — kiểm tra ownership
      MDB-->>NS: {notificationId, recipientId, status, body}
      NS->>NS: Check: notification.recipientId == currentUserId
      alt Ownership check fail
        NS-->>GW: 403 FORBIDDEN
        GW-->>U: 403 FORBIDDEN
      else Owner confirmed
        NS->>MDB: UpdateOne — status = Read, readAt = UtcNow
        MDB-->>NS: acknowledged
        NS-->>GW: 200 OK {notificationId, readAt}
        GW-->>U: 200 OK {notificationId, readAt}
      end
    end
  end

  Note over U,MDB: UC-18 — Đánh dấu tất cả notifications đã đọc
  U->>GW: PATCH /api/v1/notifications/read-all
  GW->>GW: ValidateToken → userId extracted from JWT claims
  GW->>NS: Route request (200ms budget)
  NS->>NS: Extract userId from JWT claims
  NS->>BG: Task.Run — QueueMarkAllReadAsync (fire-and-forget)
  NS-->>GW: 202 Accepted {queued: true}
  GW-->>U: 202 Accepted — không block

  Note over BG,MDB: Background async — chạy sau khi 202 đã trả về
  BG->>MDB: UpdateMany — status IN [Pending, Delivered] → Read WHERE recipientId = userId
  MDB-->>BG: N records updated
  BG->>BG: LogInformation("Bulk mark-all-read completed")

  Note over U,MDB: EX — Background worker fail
  rect rgb(252,235,235)
    BG->>MDB: UpdateMany (MongoDB timeout)
    MDB-->>BG: exception
    BG->>BG: LogError("Bulk mark-all-read failed")
    Note over BG: Client đã nhận 202 — lỗi background không lan ra ngoài
  end

  Note over U,MDB: EX — Unauthorized (no token)
  rect rgb(252,235,235)
    U->>GW: PATCH /notifications/{id}/read (no Authorization header)
    GW->>GW: JWT validation fail
    GW-->>U: 401 UNAUTHORIZED
  end
```

---

## SD-10 — Creator Analytics Dashboard (UC-15, UC-16)

```mermaid
sequenceDiagram
  autonumber
  actor C as Creator
  actor A as Admin
  participant GW as API Gateway
  participant ANS as Analytics Service
  participant MS as Music Service (internal)
  participant RD as Redis Cache
  participant IDB as InfluxDB (Time-series)

  Note over C,IDB: UC-15 — Creator xem Heatmap Skip-rate
  C->>GW: GET /api/v1/analytics/creator/heatmap/{songId}?timeRange=7d
  GW->>GW: ValidateToken → role=Creator, userId extracted
  GW->>ANS: Route request (500ms budget)
  ANS->>ANS: Validate timeRange ∈ {7d, 30d}

  Note over ANS,MS: RBAC + Ownership check (Creator only — Admin bypasses)
  ANS->>MS: REST GET /internal/songs/{songId}/artist-id
  alt Song không tồn tại
    MS-->>ANS: null
    ANS-->>GW: 404 SONG_NOT_FOUND
    GW-->>C: 404 SONG_NOT_FOUND
  else Song tồn tại
    MS-->>ANS: {artistId}
    ANS->>ANS: Check: artistId == currentUserId (Creator role)
    alt Ownership fail
      ANS-->>GW: 403 FORBIDDEN
      GW-->>C: 403 FORBIDDEN — bài hát không thuộc về bạn
    else Ownership confirmed
      ANS->>RD: GET cache (Key: heatmap:{songId}:{timeRange} TTL 6h)
      alt Cache HIT
        RD-->>ANS: cached heatmap data
        ANS-->>GW: 200 OK {heatmap:[...]} meta.cache=HIT
        GW-->>C: heatmap data (from cache)
      else Cache MISS
        RD-->>ANS: nil
        ANS->>IDB: Flux query — aggregate skip events by second WHERE songId AND timeRange
        IDB-->>ANS: [{second:120, skipRate:0.45}, {second:180, skipRate:0.32}]
        ANS->>RD: SET cache (Key: heatmap:{songId}:{timeRange}, TTL 6h)
        ANS-->>GW: 200 OK {heatmap:[...]} meta.cache=MISS
        GW-->>C: heatmap data (fresh from InfluxDB)
      end
    end
  end

  Note over C,IDB: UC-16 — Creator xem Daily Stats
  C->>GW: GET /api/v1/analytics/creator/stats/{songId}
  GW->>GW: ValidateToken → role=Creator, userId extracted
  GW->>ANS: Route request (500ms budget)

  Note over ANS,MS: RBAC + Ownership check (tương tự heatmap)
  ANS->>MS: REST GET /internal/songs/{songId}/artist-id
  MS-->>ANS: {artistId}
  ANS->>ANS: Check: artistId == currentUserId ✓

  ANS->>RD: GET cache (Key: stats:{songId} TTL 6h)
  alt Cache HIT
    RD-->>ANS: cached stats
    ANS-->>GW: 200 OK {totalPlays, totalSkips, uniqueListeners, avgListenPercent, dailyListeners} meta.cache=HIT
    GW-->>C: stats data (from cache)
  else Cache MISS
    RD-->>ANS: nil
    ANS->>IDB: Query totalPlays, totalSkips, uniqueListeners, avgListenPercent, dailyListeners
    IDB-->>ANS: aggregated stats
    ANS->>RD: SET cache (Key: stats:{songId}, TTL 6h)
    ANS-->>GW: 200 OK stats data meta.cache=MISS
    GW-->>C: stats data (fresh from InfluxDB)
  end

  Note over A,IDB: ALT — Admin xem stats (bypass ownership)
  rect rgb(255,248,225)
    A->>GW: GET /analytics/creator/stats/{songId}
    GW->>GW: ValidateToken → role=Admin
    GW->>ANS: Route request
    ANS->>ANS: role == Admin → skip ownership check
    ANS->>RD: GET cache (Key: stats:{songId})
    RD-->>ANS: cached or miss → query InfluxDB
    ANS-->>GW: 200 OK stats data
    GW-->>A: stats data (Admin không cần own bài hát)
  end

  Note over C,IDB: EX — InfluxDB timeout (Stale cache fallback)
  rect rgb(252,235,235)
    ANS->>IDB: Flux query (timeout > 500ms)
    IDB-->>ANS: OperationCanceledException
    ANS->>ANS: LogWarning("InfluxDB timeout — returning zeros/empty")
    ANS-->>GW: 200 OK {heatmap:[]} hoặc {totalPlays:0, ...}
    GW-->>C: empty/zero data (graceful degradation — không throw 500)
  end

  Note over C,IDB: EX — Unauthorized hoặc sai role
  rect rgb(252,235,235)
    C->>GW: GET /analytics/creator/stats/{songId} (role=Listener)
    GW->>GW: ValidateToken → role=Listener
    GW->>ANS: Request với role không hợp lệ
    ANS->>ANS: [Authorize(Roles="Creator,Admin")] → reject
    ANS-->>GW: 403 FORBIDDEN
    GW-->>C: 403 FORBIDDEN — chỉ Creator/Admin được phép
  end
```

---

## Tổng hợp các luồng

| ID | Tên | UC liên quan | Actors |
|---|---|---|---|
| SD-01 | Login & Onboarding | UC-01, UC-03 | Listener, Creator, Admin |
| SD-02 | Refresh Token & Logout | UC-02, UC-01 | All users |
| SD-03 | Phát nhạc + Analytics | UC-05, UC-22 | Listener, System |
| SD-04 | Recommendation + Feedback | UC-08, UC-09, UC-23 | Listener, System |
| SD-05 | Music Upload + Notification | UC-14, UC-24 | Creator, System |
| SD-06 | Listening Party Create/Join/Sync | UC-10, UC-11, UC-12 | Host, Member |
| SD-07 | Party Reconnect & Resync | UC-13 | Member |
| SD-08 | Search + Creator Dashboard | UC-04, UC-15, UC-16 | Listener, Creator |
| SD-09 | Notification Read & Mark-All | UC-17, UC-18 | Listener, Creator |
| SD-10 | Creator Analytics Dashboard | UC-15, UC-16 | Creator, Admin |

## Ghi chú

- Dùng Mermaid Live: https://mermaid.live
- GitHub/GitLab: wrap trong ```mermaid``` block
- Tất cả luồng đều có: Happy Path, ALT (alternative), EX (exception/error)
- Các ký hiệu:
  - `-->>` : response (dashed)
  - `->>` : request (solid)
  - `rect rgb(252,235,235)` : error/exception scenario (đỏ nhạt)
  - `rect rgb(255,248,225)` : alternative/warning scenario (vàng nhạt)
  - `<<include>>` : use case inclusion relationship
