# week7_9_frontend_listening_party.md — Frontend + Listening Party

> Mục tiêu cuối tuần 9: Login → Play nhạc → Tạo party → Bạn join → sync realtime
>
> Port mapping: xem `.claude/plan/shared_contracts.md`
> WebSocket TypeScript interfaces: xem `.claude/plan/shared_contracts.md` Section 6
> Error codes: xem `.claude/plan/shared_contracts.md` Section 5

---

## Tổng quan 2 Tracks song song

```
Track A — React SPA:
  Tuần 7: Login page + Audio Player component
  Tuần 8: Home (recommendations) + Search page
  Tuần 9: Creator Dashboard + Notification bell

Track B — Listening Party Service:
  Tuần 7: REST endpoints (POST /parties, POST /parties/{code}/join)
           + Export TypeScript interfaces (SYNC POINT)
  Tuần 8: SignalR WebSocket (PLAYER_ACTION, SYNC_STATE, MEMBER_JOIN)
  Tuần 9: Reconnect logic, integrate Track A với Track B

SYNC POINT cuối tuần 7:
  Track B tạo file services/frontend/src/types/listening-party.ts
  Track A dùng interfaces này với mock WebSocket trong tuần 7-8
  Tuần 9: Track A replace mock bằng SignalR connection thật
```

---

## Tuần 7 — Track A: Login + Player

### Login Page

**File:** `services/frontend/src/pages/LoginPage.tsx`

**API calls:**
- `POST /api/v1/auth/login` → `{ data: { accessToken } }` + `Set-Cookie: refreshToken`

**Security bắt buộc:**
- Access token → `useAuthStore.setAuth(token, userId, role)` — KHÔNG localStorage
- Refresh token trong HTTP-only Cookie — browser tự xử lý

**Prompt dùng với Claude:**
```
Đọc CLAUDE.md, react-spa/SKILL.md, và security-non-negotiable/RULE.md đính kèm.

Implement LoginPage (services/frontend/src/pages/LoginPage.tsx):
- Form: username, password fields
- Submit: POST /api/v1/auth/login qua apiClient (src/api/client.ts)
- Success: lưu accessToken vào useAuthStore (in-memory), redirect về /
- Error handling:
  - AUTH_INVALID_CREDENTIALS → "Tên đăng nhập hoặc mật khẩu không đúng"
  - ACCOUNT_LOCKED → "Tài khoản tạm thời bị khóa"
  - RATE_LIMIT_EXCEEDED → "Quá nhiều lần thử. Thử lại sau"
- Loading state: button disabled khi đang submit
- KHÔNG dùng localStorage/sessionStorage cho token

Sau khi login thành công: gọi GET /api/v1/users/me để lấy role.
Nếu role = "Creator": redirect về /dashboard; else redirect về /.

API response shape:
  POST /auth/login → { success, data: { accessToken, expiresIn }, error }
  GET /users/me → { success, data: { id, username, role }, error }

Definition of Done (verify bằng browser):
  □ Form render đúng
  □ Login thành công → redirect đúng theo role
  □ Error messages hiển thị đúng
  □ Network tab: không thấy token trong localStorage
```

### Audio Player Component

**File:** `services/frontend/src/components/Player/AudioPlayer.tsx`

**API calls:**
- `GET /api/v1/streaming/{songId}/url` → `{ data: { url, expiresIn } }`

**Prompt dùng với Claude:**
```
Đọc CLAUDE.md, react-spa/SKILL.md đính kèm.

Implement AudioPlayer component (services/frontend/src/components/Player/AudioPlayer.tsx):
- Props: songId, title, artist, coverUrl
- State: isPlaying, currentTime, duration, volume
- Khi mount: gọi GET /api/v1/streaming/{songId}/url để lấy pre-signed URL
- Dùng HTML5 <audio> element với pre-signed URL
- Controls: Play/Pause, Seek (progress bar), Volume
- Khi play bắt đầu: gọi POST /api/v1/analytics/events/play (Idempotency-Key = sessionId)
- Khi skip (user tua qua > 30s): gọi analytics (riêng logic này có thể skip ở tuần này)
- Error nếu URL expired (401): re-fetch URL (interceptor đã handle)

Pre-signed URL expiry = 15 phút — re-fetch khi gần hết hạn:
  const REFETCH_BEFORE_EXPIRY_SEC = 60;
  if (expiresIn - elapsed < REFETCH_BEFORE_EXPIRY_SEC) fetchNewUrl();

Definition of Done (verify bằng browser):
  □ Nhạc play được từ pre-signed URL
  □ Progress bar hoạt động
  □ Pause/Play toggle đúng
  □ Console không có CORS errors
```

---

## Tuần 7 — Track B: Listening Party REST + SYNC POINT

### Listening Party Service — REST Endpoints

**File:** `services/listening-party-service/src/ListeningParty.Api/Controllers/PartiesController.cs`

### Database: Redis (ephemeral room state)
Keys:
- `party:room:{roomId}` → Hash: `{ hostId, songId, isPlaying, positionSec, joinCode }`
- `party:joincode:{joinCode}` → String: `roomId`
- `party:members:{roomId}` → Set: `{ userId1, userId2, ... }`

### Endpoints cần implement

**1. POST /api/v1/parties**
- Auth: Bearer JWT required
- Body: `{ songId: string }`
- Flow:
  1. Generate `roomId` (UUID), `joinCode` (6 ký tự alphanumeric)
  2. Lưu state vào Redis: `HSET party:room:{roomId} hostId {userId} songId {songId} isPlaying false positionSec 0 joinCode {joinCode}`
  3. Set TTL: `EXPIRE party:room:{roomId} 86400` (24h)
  4. Lưu mapping: `SETEX party:joincode:{joinCode} 86400 {roomId}`
  5. Add host vào members: `SADD party:members:{roomId} {userId}`
- Response 201: `{ success, data: { roomId, joinCode, hostId }, meta }`
- Latency budget: 200ms

**2. POST /api/v1/parties/{joinCode}/join**
- Auth: Bearer JWT required
- Flow:
  1. Lookup: `GET party:joincode:{joinCode}` → roomId
  2. Nếu không tồn tại → 404 ROOM_NOT_FOUND
  3. Lấy room state: `HGETALL party:room:{roomId}`
  4. Add member: `SADD party:members:{roomId} {userId}`
- Response 200: `{ success, data: { roomId, hostId, currentSongId, playbackPositionSec }, meta }`
- Latency budget: 150ms

### Acceptance Criteria cần pass
- AC7.1.1: create party → roomId + joinCode (6 ký tự)
- AC7.1.2: join với joinCode hợp lệ → trả room state
- AC7.1.3: join với joinCode không tồn tại → 404 ROOM_NOT_FOUND

### SYNC POINT — TypeScript Interface File

**Sau khi implement REST endpoints, Track B tạo file:**

`services/frontend/src/types/listening-party.ts` — copy y hệt nội dung từ `.claude/plan/shared_contracts.md` Section 6.

**Verify Track A có thể import được:**
```typescript
// Track A test import (tuần 7)
import type { SyncState, PlayerAction, MemberJoin } from '../types/listening-party';
// TypeScript compile không lỗi là OK
```

### Prompt dùng với Claude (Track B Tuần 7):

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, api-contract-first/RULE.md,
no-scope-creep/RULE.md, security-non-negotiable/RULE.md, và
testing-required/RULE.md đính kèm.

Implement Listening Party Service REST endpoints (services/listening-party-service/):
1. POST /api/v1/parties — tạo room, lưu state vào Redis
2. POST /api/v1/parties/{joinCode}/join — join room

Acceptance Criteria:
- AC7.1.1: create → roomId (UUID) + joinCode (6 ký tự alphanumeric)
- AC7.1.2: join hợp lệ → room state đầy đủ
- AC7.1.3: joinCode không tồn tại → 404 ROOM_NOT_FOUND

Room state lưu trên Redis (KHÔNG lưu DB):
- party:room:{roomId} → Hash (TTL 24h)
- party:joincode:{joinCode} → String → roomId (TTL 24h)
- party:members:{roomId} → Set

Sau khi implement REST, tạo file TypeScript interfaces:
  services/frontend/src/types/listening-party.ts
  Nội dung: copy từ .claude/plan/shared_contracts.md Section 6

Bắt đầu bằng cách điền Contract-First Checklist 8 ô trước khi viết code.
```

### Definition of Done Tuần 7 — Track B

- [ ] AC7.1.1: `curl -X POST .../parties -d '{"songId":"song-001"}'` → 201 + joinCode 6 ký tự
- [ ] AC7.1.2: `curl -X POST .../parties/{joinCode}/join` → 200 + room state
- [ ] AC7.1.3: join với code sai → 404 ROOM_NOT_FOUND
- [ ] `services/frontend/src/types/listening-party.ts` tồn tại và compile được

---

## Tuần 8 — Track A: Home + Search

### Home Page (Recommendations)

**File:** `services/frontend/src/pages/HomePage.tsx`

**API calls:**
- `GET /api/v1/recommendations?context={timeOfDay}&limit=20`
- `GET /api/v1/music/songs/{songId}` (khi click để xem chi tiết)

**Prompt dùng với Claude:**
```
Đọc CLAUDE.md, react-spa/SKILL.md đính kèm.

Implement HomePage (services/frontend/src/pages/HomePage.tsx):
- Khi mount: detect time of day (morning/evening/workout/study)
  const getContext = (hour: number) => {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'none';
  }
- Gọi GET /api/v1/recommendations?context={context}&limit=20
- Render list nhạc: cover, title, artist, explainText badge
- Click vào bài → mount AudioPlayer component
- Loading skeleton khi đang fetch
- Error state: "Không thể tải gợi ý. Thử lại." + retry button

API response:
  GET /recommendations → { success, data: { items: [{ songId, title, artist, explainText }] } }

Definition of Done (verify bằng browser):
  □ Danh sách nhạc render đúng
  □ explainText hiển thị dưới mỗi bài
  □ Click bài → AudioPlayer mount và play được
  □ Loading state khi đang fetch
```

### Search Page

**File:** `services/frontend/src/pages/SearchPage.tsx`

**API calls:**
- `GET /api/v1/search?q={query}&type=song&limit=10&cursor={cursor}`

**Prompt dùng với Claude:**
```
Đọc CLAUDE.md, react-spa/SKILL.md đính kèm.

Implement SearchPage (services/frontend/src/pages/SearchPage.tsx):
- Search input với debounce 300ms
- Gọi GET /api/v1/search?q=...&type=song&limit=10 khi user ngừng gõ
- Render kết quả: title, artist, album
- "Load more" button nếu hasMore = true (dùng cursor pagination)
- Empty state: "Không tìm thấy kết quả cho '{query}'"
- No query state: "Tìm kiếm bài hát, nghệ sĩ..."

API response:
  GET /search → { success, data: { items: [...], nextCursor, hasMore } }

Definition of Done:
  □ Gõ "son tung" → thấy "Sơn Tùng M-TP" trong kết quả
  □ Debounce: không gọi API liên tục khi gõ nhanh
  □ Load more button xuất hiện khi hasMore = true
  □ Empty state đúng khi không có kết quả
```

---

## Tuần 8 — Track B: SignalR WebSocket

### SignalR Hub

**File:** `services/listening-party-service/src/ListeningParty.Api/Hubs/PartyHub.cs`

### Acceptance Criteria cần pass
- AC7.2.1: Host Play/Pause/Seek → tất cả members nhận SYNC_STATE trong < 500ms
- AC7.2.2: Member cố gửi PLAYER_ACTION → server reject (403/ignore)
- AC7.2.3: conflict 2 requests cùng lúc → Host state win
- AC7.2.4: idle > 30s → Ping; không Pong trong 10s → disconnect + clean Redis

### Prompt dùng với Claude:

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, no-scope-creep/RULE.md,
security-non-negotiable/RULE.md, và testing-required/RULE.md đính kèm.

Implement SignalR Hub cho Listening Party Service:
Hub: PartyHub (/ws/v1/parties/{roomId})

Events (Client → Server):
- PLAYER_ACTION: { eventId, action: PLAY|PAUSE|SEEK, songId?, positionSec? }
  → CHỈ Host được gửi. Kiểm tra: userId == party:room:{roomId}.hostId
  → Nếu Member gửi → ignore silently + log warning

Events (Server → Client):
- SYNC_STATE: { songId, isPlaying, positionSec, hostId, timestamp }
  → Broadcast tới ALL members trong group khi Host action

Heartbeat:
- Server gửi Ping mỗi 30s
- Client không Pong trong 10s → disconnect + SADD quá hạn → clean up

Acceptance Criteria:
- AC7.2.1: Host send PLAYER_ACTION → tất cả clients nhận SYNC_STATE < 500ms
- AC7.2.2: Member send PLAYER_ACTION → server KHÔNG broadcast, KHÔNG update state
- AC7.2.4: idle client → timeout và clean up Redis members Set

Room state update khi PLAYER_ACTION:
  HSET party:room:{roomId} isPlaying {true|false} positionSec {n}

TypeScript interface file đã được tạo ở tuần 7:
  services/frontend/src/types/listening-party.ts
  Backend phải match đúng schema này (field names, types)

Host disconnect > 5s: log warning "Host disconnected, room {roomId} may terminate"
Host re-election là Phase 2 — không implement trong Phase 1.
Khi Host disconnect: broadcast RoomClosed event tới tất cả members.

Bắt đầu bằng cách đọc no-scope-creep/RULE.md về Host re-election trước.
```

---

## Tuần 9 — Track A: Creator Dashboard + Notifications + Integrate WebSocket

### Creator Dashboard

**File:** `services/frontend/src/pages/CreatorDashboardPage.tsx`

**API calls:**
- `GET /api/v1/analytics/creator/heatmap/{songId}?timeRange=7d`
- `GET /api/v1/analytics/creator/stats/{songId}`

**Prompt dùng với Claude:**
```
Đọc CLAUDE.md, react-spa/SKILL.md đính kèm.

Implement CreatorDashboardPage (services/frontend/src/pages/CreatorDashboardPage.tsx):
- Hiển thị danh sách bài đã upload (gọi GET /api/v1/music/songs — dùng artist filter)
- Khi click vào bài: hiển thị heatmap và stats
- Heatmap visualization: progress bar cho mỗi giây, màu đỏ khi skipRate > 0.3
- Stats: totalPlays, totalSkips, uniqueListeners, avgListenPercent
- Time range selector: 7d / 30d
- RBAC: nếu role != "Creator" và != "Admin" → redirect về /

API response:
  heatmap → { data: { heatmap: [{ second, skipRate }] } }
  stats → { data: { totalPlays, totalSkips, uniqueListeners, avgListenPercent } }

Definition of Done (verify bằng browser):
  □ Heatmap render với màu đỏ ở đoạn skip nhiều
  □ Stats cards hiển thị số liệu
  □ Time range 7d/30d thay đổi data
  □ Listener truy cập → redirect về /
```

### Notification Bell

**File:** `services/frontend/src/components/NotificationBell.tsx`

**API calls:**
- `GET /api/v1/notifications/unread?limit=10`
- `PATCH /api/v1/notifications/{id}/read` (khi click notification)

**Prompt dùng với Claude:**
```
Đọc CLAUDE.md, react-spa/SKILL.md đính kèm.

Implement NotificationBell component (services/frontend/src/components/NotificationBell.tsx):
- Bell icon trong header, hiển thị badge với số unread
- Click → dropdown list 10 notifications gần nhất
- Click vào notification: gọi PATCH /{id}/read, mark as read
- Idempotency-Key cho PATCH: crypto.randomUUID() mỗi lần click
- Poll mỗi 30s: re-fetch unread count (không dùng WebSocket cho notifications)
- "Xem tất cả" link → trang notifications đầy đủ

API response:
  GET /notifications/unread → { data: { items: [{ id, title, body, createdAt }], hasMore } }

Definition of Done:
  □ Badge count hiển thị đúng
  □ Click notification → mark as read → badge giảm
  □ Idempotency: click 2 lần nhanh → không bị duplicate mark read
```

### Integrate WebSocket — Track A + Track B

**File:** `services/frontend/src/hooks/usePartyWebSocket.ts`

Thay thế mock implementation từ tuần 7-8 bằng SignalR thật:

**Prompt dùng với Claude:**
```
Đọc CLAUDE.md, react-spa/SKILL.md, security-non-negotiable/RULE.md đính kèm.

Implement usePartyWebSocket hook — integrate thật với SignalR:
(services/frontend/src/hooks/usePartyWebSocket.ts)

Thay thế mock implementation bằng @microsoft/signalr:
  npm install @microsoft/signalr

Connection:
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`/ws/v1/parties/${roomId}`, {
      accessTokenFactory: () => getAccessToken() ?? ''
    })
    .withAutomaticReconnect([1000, 2000, 4000, 8000, 16000, 30000])
    .build();

Events to handle:
  connection.on('SYNC_STATE', (data: SyncState) => { ... })
  connection.on('MEMBER_JOIN', (data: MemberJoin) => { ... })
  connection.on('MEMBER_LEAVE', (data: MemberLeave) => { ... })
  connection.on('HOST_CHANGED', (data: HostChanged) => { ... })
  connection.on('ROOM_CLOSED', () => { navigate('/'); })

Sending (chỉ khi isHost):
  connection.invoke('PLAYER_ACTION', action: PlayerAction)

Import types từ: src/types/listening-party.ts (đã có từ tuần 7)

Reconnect Exponential Backoff: withAutomaticReconnect array trên là đủ
Cleanup: connection.stop() khi component unmount

Definition of Done (test với 2 browser tabs):
  □ Tab 1 (Host): kết nối thành công
  □ Tab 2 (Member): join cùng room, kết nối thành công
  □ Host click Play → Member tự động play trong < 500ms
  □ Host seek → Member seek đến cùng vị trí
  □ Member click Play → không có gì xảy ra (bị reject)
```

---

## Tuần 9 — Track B: Reconnect Logic

**File:** `services/listening-party-service/src/ListeningParty.Api/Hubs/PartyHub.cs` (extend)

### Acceptance Criteria cần pass
- AC7.3.1: Member reconnect → lấy currentSongId và positionSec từ Redis
- AC7.3.2: Reconnect dùng Exponential Backoff (1s → 2s → 4s → max 30s)
- AC7.3.3: Room không còn tồn tại → thông báo "Phòng đã kết thúc"

### Prompt dùng với Claude:

```
Đọc CLAUDE.md, aspnet-service/SKILL.md, no-scope-creep/RULE.md đính kèm.

Extend PartyHub với reconnect và resync logic:

OnConnectedAsync override:
  1. Lấy userId từ JWT claim
  2. Lấy room state từ Redis: HGETALL party:room:{roomId}
  3. Nếu room không tồn tại → gửi RoomClosed event → close connection
  4. Nếu room tồn tại:
     - Add vào SignalR group: Groups.AddToGroupAsync(connectionId, roomId)
     - Add vào Redis Set: SADD party:members:{roomId} {userId}
     - Gửi SYNC_STATE ngay cho client mới reconnect (current state)
     - Broadcast MEMBER_JOIN tới group

OnDisconnectedAsync override:
  1. Remove khỏi Redis: SREM party:members:{roomId} {userId}
  2. Broadcast MEMBER_LEAVE tới group
  3. Nếu userId == hostId:
     - Log "Host disconnected, room {roomId} terminating"
     - Broadcast RoomClosed tới group
     - Clean up Redis: DEL party:room:{roomId} party:members:{roomId}

Acceptance Criteria:
  AC7.3.1: reconnect → ngay lập tức nhận SYNC_STATE với current position
  AC7.3.3: room đã xóa → nhận RoomClosed → client redirect về /

Host re-election là Phase 2 — không implement.
Khi Host disconnect: room kết thúc.
```

---

## Test Scenario — Cuối Tuần 9

### 2-Browser-Tab Test (thủ công)

```
Setup:
  - Tạo 2 accounts: host@example.com (Creator) và member@example.com (Listener)
  - Tab 1: đăng nhập host@example.com
  - Tab 2: đăng nhập member@example.com

Test steps:
  1. Tab 1 (Host): Tạo party với song-001
     → Nhận joinCode (ví dụ: ABC123)

  2. Tab 2 (Member): Join party với joinCode ABC123
     → Cả 2 tab connect WebSocket

  3. Tab 1 (Host): Click Play
     → Tab 2 phải tự động play trong < 500ms
     → Verify: cả 2 tab play cùng bài

  4. Tab 1 (Host): Seek đến 1:30
     → Tab 2 phải seek đến 1:30 ± 1s

  5. Tab 2 (Member): Click Play (không phải Host)
     → Không có gì xảy ra ở Tab 1

  6. Tab 1 (Host): Đóng tab (disconnect)
     → Tab 2 nhận "Phòng đã kết thúc", redirect về /
```

---

## Checkpoint Cuối Tuần 9 — Demo Flow

```
Demo flow đầy đủ (verify bằng browser):

1. Mở http://localhost:3000 → redirect về /login
2. Login với listener@example.com
3. Home page: thấy danh sách gợi ý nhạc với explainText
4. Click bài nhạc → AudioPlayer mount, nhạc play được
5. Search "son tung" → thấy kết quả
6. Mở tab mới: login với creator@example.com
7. Creator: upload bài nhạc mới (POST /music/songs)
8. Creator: xem Dashboard → heatmap và stats
9. Listener: thấy notification về bài nhạc mới
10. Listener: Tạo party → chia sẻ joinCode với bạn
11. Bạn (tab mới): Join party
12. Host Play → tất cả member sync realtime
```

**Tuần 9 hoàn thành khi:** Toàn bộ demo flow trên chạy được.
