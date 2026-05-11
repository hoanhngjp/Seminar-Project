# Plan: Frontend Redesign — Spotify Design System

## Context

Frontend hiện tại dùng inline styles với màu sắc không nhất quán (#0f0f0f, #1a1a1a, accent #1db954), không có shared layout, và không có PartyPage. DESIGN.md định nghĩa design system Spotify-inspired đầy đủ: near-black dark theme (#121212), Spotify Green (#1ed760), pill buttons, heavy shadows, và typography compact. Yêu cầu: cập nhật toàn bộ UI theo DESIGN.md + tạo AppShell layout chung (sidebar + bottom player bar) + thêm PartyPage. Tất cả 79/79 tests hiện tại phải tiếp tục xanh.

---

## Approach

Tiếp tục dùng **inline React.CSSProperties** (không thêm thư viện CSS mới). Tạo file design tokens (`tokens.ts`) làm source of truth cho màu/typography, tất cả components import từ đây. Thêm `playerStore` Zustand để chia sẻ trạng thái "bài đang phát" giữa pages và AppShell.

---

## Phase 1 — Design Foundation (2 files)

### `src/styles/tokens.ts` (NEW)
Constants từ DESIGN.md:
```ts
export const colors = {
  bg: '#121212', surface: '#181818', surfaceMid: '#1f1f1f',
  surfaceCard: '#252525', text: '#ffffff', textMuted: '#b3b3b3',
  accent: '#1ed760', accentBorder: '#1db954',
  error: '#f3727f', warning: '#ffa42b', info: '#539df5',
  border: '#4d4d4d', borderLight: '#7c7c7c',
}
export const shadows = {
  heavy: 'rgba(0,0,0,0.5) 0px 8px 24px',
  medium: 'rgba(0,0,0,0.3) 0px 8px 8px',
  inset: 'rgb(18,18,18) 0px 1px 0px, rgb(124,124,124) 0px 0px 0px 1px inset',
}
export const radius = { pill: 9999, large: 500, card: 8, circle: '50%' }
export const font = {
  family: "'SpotifyMixUI', 'CircularSp-Arab', 'CircularSp-Hebr', 'CircularSp-Cyrl', 'Helvetica Neue', helvetica, arial, 'Hiragino Sans', sans-serif",
  title: "'SpotifyMixUITitle', 'CircularSp-Arab', 'Helvetica Neue', helvetica, arial, sans-serif",
}
```

### `src/index.css` (MODIFY)
- Reset `#root`: `width: 100%; max-width: 100%; margin: 0; border: none; text-align: left`
- `body`: `background: #121212; color: #ffffff; margin: 0; font-family: [font.family]`
- Xóa light/dark media query cũ (app is always dark)
- Giữ `box-sizing: border-box`

---

## Phase 2 — Player Store (1 file)

### `src/store/playerStore.ts` (NEW)
```ts
interface PlayerState {
  currentSong: { songId: string; title: string; artist: string } | null
  setSong(song: { songId: string; title: string; artist: string }): void
  clearSong(): void
}
```
Zustand store, in-memory only. Pages gọi `setSong()` thay vì `setSelectedSong` local state.

---

## Phase 3 — AppShell Layout (1 file)

### `src/components/layout/AppShell.tsx` (NEW)

**Layout structure:**
```
┌──────────────────────────────────────────────────────┐
│ Sidebar (240px fixed, #121212)  │  Main Content Area │
│                                 │  (overflow-y: auto) │
│  🎵 Smart Music (green logo)    │                     │
│  ─────────────────────────      │  {children}         │
│  🏠 Trang chủ                   │                     │
│  🔍 Tìm kiếm                    │                     │
│  📊 Dashboard (Creator/Admin)   │                     │
│                     [Bell]      │                     │
├─────────────────────────────────┴─────────────────────┤
│  Bottom Player Bar (90px fixed, #181818, border-top)  │
│  AudioPlayer (if playerStore.currentSong) | ✕ button │
└──────────────────────────────────────────────────────┘
```

Props: `{ children: ReactNode }`

- Sidebar: `position: fixed, width: 240px, height: 100vh, background: #121212`
  - Logo: "Smart Music" text, color `#1ed760`, SpotifyMixUITitle, 24px bold
  - Nav links: Home (`/`), Search (`/search`), Dashboard (`/dashboard` — chỉ Creator/Admin)
  - Active link detection: compare `location.pathname` với `useLocation()`
  - Active style: weight 700, color `#ffffff`; inactive: weight 400, color `#b3b3b3`
  - NotificationBell ở cuối sidebar (sticky bottom)

- Main content: `marginLeft: 240px, marginBottom: 90px, minHeight: 100vh`

- Bottom bar: `position: fixed, bottom: 0, left: 0, right: 0, height: 90px, background: #181818, borderTop: 1px solid #4d4d4d`
  - Render `<AudioPlayer>` + close button nếu `playerStore.currentSong !== null`
  - Nếu null: show "Chọn bài hát để phát" — color #b3b3b3

---

## Phase 4 — Restyle Pages (4 files modified)

**Common changes for all protected pages:**
- Xóa `<header>` / `<nav>` inline khỏi pages (sidebar đảm nhiệm)
- Xóa `playerBar` + `AudioPlayer` + close button inline (AppShell đảm nhiệm)
- Thay `setSelectedSong(item)` → `playerStore.setSong(item)`
- Wrap return với `<AppShell>`
- Update colors/fonts theo tokens.ts

### `src/pages/LoginPage.tsx` (MODIFY)
- Không dùng AppShell (standalone full-screen)
- Layout: full-screen centered `#121212`, card `#181818` 400px wide, radius 8px, shadow heavy
- Logo "Smart Music" top-center, color `#1ed760`, SpotifyMixUITitle 24px
- Form fields: pill input (radius 500px), background `#1f1f1f`, inset border shadow
- Submit button: pill (radius 9999px), background `#1ed760`, text `#000000`, uppercase, letter-spacing 2px, weight 700
- Error text: `#f3727f`

### `src/pages/HomePage.tsx` (MODIFY)
- `<AppShell>` wraps toàn bộ
- Xóa header/nav/playerBar/AudioPlayer inline
- `onClick={() => setSong(item)}` thay vì `setSelectedSong`
- Card style: background `#181818`, radius 8px, hover `#252525`, shadow medium on hover
- Grid: `repeat(auto-fill, minmax(180px, 1fr))`, gap 16px
- Section title: SpotifyMixUITitle 24px bold, color `#ffffff`
- Skeleton: `#1f1f1f` → `#252525` shimmer
- Explain badge: background `#1ed76020`, color `#1ed760`, radius 4px
- Retry button: pill, background `#1ed760`, color `#000`

### `src/pages/SearchPage.tsx` (MODIFY)
- `<AppShell>` wraps toàn bộ
- Xóa header/nav/playerBar/AudioPlayer inline
- Search input: radius 9999px (full pill), background `#1f1f1f`, padding `12px 48px`, inset border shadow
- Search icon prefix, clear button (✕) trong input
- Result items: background `#181818`, hover `#252525`, radius 8px
- Load more button: outlined pill (transparent bg, border `#7c7c7c`, color `#fff`)

### `src/pages/CreatorDashboardPage.tsx` (MODIFY)
- `<AppShell>` wraps toàn bộ
- Xóa header/nav inline
- Stat cards: background `#181818`, radius 8px, shadow medium
- Stat value: 32px bold, color `#ffffff`
- Stat label: 14px, color `#b3b3b3`
- Time range toggle pills: active = `#1ed760` bg + `#000` text; inactive = `#1f1f1f` bg + `#b3b3b3` text
- Heatmap bar: red `#f3727f` if skipRate > 30%, green `#1ed760` otherwise
- Song ID input: giống search input (pill shape)

---

## Phase 5 — Restyle Components (2 files)

### `src/components/Player/AudioPlayer.tsx` (MODIFY)
- Restyle để phù hợp với bottom bar (90px height, full-width layout)
- Album art placeholder: 60x60px, radius 4px, background `#252525`
- Song info: title 14px bold white, artist 12px `#b3b3b3`
- Controls: play/pause = circular button 40px, radius 50%, background `#1ed760`, icon `#000`
- Seek bar: progress track `#4d4d4d`, filled `#1ed760`, thumb white circle
- Volume: compact slider, icon `#b3b3b3`
- Layout: `display: flex, alignItems: center, gap: 16px, padding: 0 16px`
- Giữ nguyên tất cả logic + aria-labels (tests depend on these)

### `src/components/NotificationBell.tsx` (MODIFY)
- Bell icon: color `#b3b3b3`, hover `#ffffff`
- Badge: background `#f3727f`, white text, radius 50%, 18px
- Dropdown: background `#181818`, shadow heavy, radius 8px
- Notification item: hover `#252525`, radius 4px
- Giữ nguyên: aria-label="Thông báo", data-testid="notification-badge", role="listbox"

---

## Phase 6 — New PartyPage (1 file)

### `src/pages/PartyPage.tsx` (NEW)
Route: `/party/:roomId`

Logic:
- Auth check: redirect to `/login` nếu no accessToken
- `const { roomId } = useParams()`
- `const { userId } = useAuthStore()`
- Local state: `syncState: SyncState | null`, `members: MemberJoin[]`, `isHost: boolean`
- `usePartyWebSocket({ roomId, isHost, onSyncState, onMemberJoin, onMemberLeave })`
- `isHost = syncState?.hostId === userId` (updated on each SyncState)

Layout (trong AppShell):
```
┌─────────────────────────────────────┐
│  Party Room #{roomId}               │
│  Status: [connecting/connected/...]  │
├─────────────────────┬───────────────┤
│  Now Playing        │  Members (N)  │
│  [album art 200px]  │  • User1 👑   │
│  Title / Artist     │  • User2      │
│                     │  • User3      │
│  ── Host Controls ──│               │
│  (only if isHost)   │               │
│  [▶/⏸] [Seek]      │               │
└─────────────────────┴───────────────┘
```

Host controls: sendPlayerAction({ action: 'PLAY' | 'PAUSE' | 'SEEK', ... })
Member view: sync display only (no controls)
Connection status badge: `connecting` = orange warning, `connected` = green, `reconnecting` = orange, `disconnected` = red error

---

## Phase 7 — Update App.tsx (1 file)

### `src/App.tsx` (MODIFY)
```tsx
import PartyPage from './pages/PartyPage';
// ...
<Route path="/party/:roomId" element={<PartyPage />} />
```
Thay thế placeholder `<div>`.

---

## Phase 8 — Update Tests (5 files)

### `src/tests/utils/renderWithShell.tsx` (NEW)
```tsx
export function renderWithShell(ui: ReactElement, options?: { route?: string }) {
  return render(
    <MemoryRouter initialEntries={[options?.route ?? '/']}>
      {ui}  // Note: AppShell is included via pages themselves wrapping with <AppShell>
    </MemoryRouter>
  )
}
```

**Thực ra pages giờ tự wrap `<AppShell>` bên trong, nên existing tests dùng `render(<HomePage />)` đã đủ. Chỉ cần:**
- Xóa import `MemoryRouter` duplicate nếu có
- Reset `playerStore` trong `beforeEach`: `usePlayerStore.getState().clearSong()`
- AudioPlayer tests: vẫn tìm được qua `getByLabelText('Đóng player')` vì AppShell render trong DOM

### Test files cần update:
1. **`HomePage.test.tsx`**: Thêm `beforeEach(() => usePlayerStore.getState().clearSong())`. Song click giờ dispatch vào playerStore → AppShell render AudioPlayer → `getByLabelText('Đóng player')` vẫn tìm được ✅
2. **`SearchPage.test.tsx`**: Tương tự playerStore reset
3. **`CreatorDashboardPage.test.tsx`**: Không dùng playerStore → minimal/no changes
4. **`NotificationBell.test.tsx`**: Standalone component, không liên quan AppShell → no changes

---

## Critical Files

| File | Action | Priority |
|------|--------|----------|
| `src/styles/tokens.ts` | CREATE | P0 — foundation |
| `src/index.css` | MODIFY | P0 — global reset |
| `src/store/playerStore.ts` | CREATE | P0 — shared player state |
| `src/components/layout/AppShell.tsx` | CREATE | P0 — layout |
| `src/pages/LoginPage.tsx` | MODIFY | P1 |
| `src/pages/HomePage.tsx` | MODIFY | P1 |
| `src/pages/SearchPage.tsx` | MODIFY | P1 |
| `src/pages/CreatorDashboardPage.tsx` | MODIFY | P1 |
| `src/components/Player/AudioPlayer.tsx` | MODIFY | P1 |
| `src/components/NotificationBell.tsx` | MODIFY | P1 |
| `src/pages/PartyPage.tsx` | CREATE | P2 |
| `src/App.tsx` | MODIFY | P2 |
| `src/tests/pages/HomePage.test.tsx` | MODIFY | P3 |
| `src/tests/pages/SearchPage.test.tsx` | MODIFY | P3 |

---

## Constraints & Risks

1. **Tests**: Tất cả aria-labels và data-testids phải giữ nguyên chính xác. Danh sách:
   - `aria-label="Đang tải danh sách nhạc"` (HomePage loading grid)
   - `aria-label="Phát ${title} — ${artist}"` (song cards)
   - `aria-label="Đóng player"` (close button — now in AppShell bottom bar)
   - `aria-label="Tìm kiếm bài hát"` (search input)
   - `aria-label="Xoá từ khoá"` (clear button)
   - `aria-label="Tải thêm kết quả"` (load more)
   - `aria-label="Song ID"` (dashboard input)
   - `aria-label="Thống kê bài hát"` (stats section)
   - `aria-label="Heatmap bỏ qua"` (heatmap section)
   - `aria-label="Thông báo"` (notification bell)
   - `data-testid="explain-badge"`, `data-testid="notification-badge"`
   - `role="listbox"` (notification dropdown)

2. **Font**: SpotifyMixUI không tải được (proprietary) → UI sẽ dùng Helvetica Neue / system fonts từ fallback stack. Chấp nhận được vì đây là academic project.

3. **playerStore reset in tests**: Zustand stores persist across tests — phải `clearSong()` in `beforeEach` để tránh state leak.

4. **PartyPage isHost detection**: Cần SyncState để biết hostId. Khi trang vừa load, isHost = false cho đến khi nhận SyncState đầu tiên. Cần handle loading state.

---

## Verification

```bash
cd services/frontend

# Run all tests — must stay green
npm run test -- --run

# Type check
npx tsc --noEmit

# Dev server — visual check
npm run dev
# Check: http://localhost:3000/login → Spotify dark form
# Check: http://localhost:3000/ → sidebar + grid + bottom bar
# Check: http://localhost:3000/search → pill search input
# Check: http://localhost:3000/dashboard → stat cards
# Check: http://localhost:3000/party/test-room → party layout
```

Visual checklist:
- [ ] Background toàn bộ app là `#121212`
- [ ] Sidebar 240px fixed bên trái, logo `#1ed760`
- [ ] Bottom player bar 90px fixed, background `#181818`
- [ ] Buttons là pill shape (radius 9999px)
- [ ] Play button circular `#1ed760` background
- [ ] Cards background `#181818`, hover sáng hơn
- [ ] Login form centered, isolated (không có sidebar)
- [ ] PartyPage hiển thị connection status + member list
