# Plan: Frontend Phase 2 — New Pages & Components

## Context

Nhóm đã dùng Google Stitch để thiết kế 10 màn hình/component mới (lưu trong `design/phase2/`). Đây là giai đoạn implement các thiết kế đó thành React/TypeScript, bổ sung 5 trang mới, nâng cấp 3 trang hiện có, và thêm ~12 component dùng chung — hoàn thiện luồng UX còn thiếu so với API Design V2.

**Giai đoạn này dùng mock data hoàn toàn** — không gọi API thật. Tích hợp BE sẽ thực hiện ở giai đoạn sau. Mock data đặt trong `services/frontend/src/mocks/data.ts` (file đã tồn tại).

Design references: `design/phase2/*/code.html`
Design system: `DESIGN_STITCH.md` (Tailwind tokens, typography, color palette)

---

## Mock Data Strategy

Tất cả service calls trong các trang/component mới đều được **thay bằng mock data tĩnh** hoặc mock functions:

```typescript
// Pattern dùng cho mọi page mới — thay vì gọi API thật:
const [data, setData] = useState<T>(MOCK_DATA);
const [loading, setLoading] = useState(false);
// Không có useEffect gọi service

// Hoặc nếu muốn simulate loading:
useEffect(() => {
  setLoading(true);
  const timer = setTimeout(() => {
    setData(MOCK_DATA);
    setLoading(false);
  }, 500);
  return () => clearTimeout(timer);
}, []);
```

Mock data cần thêm vào `services/frontend/src/mocks/data.ts`:
- `MOCK_SONG_DETAIL: SongDetail` — 1 bài hát đầy đủ metadata
- `MOCK_ARTIST: Artist` — 1 nghệ sĩ với songs[]
- `MOCK_CREATOR_SONG_ROWS: CreatorSongRow[]` — 5–10 hàng cho table
- `MOCK_HEATMAP: HeatmapDropOff[]` — ~20 điểm dữ liệu
- `MOCK_DAILY_STATS: { date: string; count: number }[]` — 7 ngày
- `MOCK_PROFILE: UserProfile` — profile đầy đủ với genres + artists
- `MOCK_RELATED_SONGS: RecommendedSong[]` — 8 bài gợi ý

---

## Scope

### 5 trang mới
| Page | Route | Design folder |
|---|---|---|
| SongDetailPage | `/songs/:songId` | `chi_ti_t_b_i_h_t_soundwave/` |
| ArtistPage | `/artists/:artistId` | `h_s_ngh_s_soundwave/` |
| CreatorSongAnalyticsPage | `/dashboard/songs/:songId` | `analytics_chi_ti_t_b_i_h_t_soundwave_creator/` |
| ProfilePage | `/profile` | `h_s_ng_i_d_ng_soundwave/` |
| PreferencesPage | `/settings/preferences` | `c_p_nh_t_s_th_ch_soundwave/` |

### 3 trang nâng cấp
- **HomePage**: thêm `ContextSelector` + row-variant feed
- **SearchPage**: thêm filter tabs + `ArtistCard` + `EmptyState`
- **CreatorDashboardPage**: thêm `CreatorSongTable` + link sang analytics page

### Components mới
- Shared UI: `EmptyState`, `SongContextMenu`, `UserMenuDropdown`
- Creator: `TimeRangeSelector`, `SongStatsCard`, `DailyListenersChart`, `HeatmapChart`, `CreatorSongTable`
- Recommendation: `ContextSelector`, `RecommendationFeedRow`
- Player: `QueueDrawer`

---

## Implementation Order

```
Phase 0 — Types & mock data
  ↓
Phase 1 — Shared UI components (EmptyState, SongContextMenu, UserMenuDropdown)
Phase 2 — Creator components (charts, table, TimeRangeSelector)   [parallel với Phase 1]
Phase 3 — Recommendation components (ContextSelector, FeedRow)     [parallel với Phase 1]
Phase 4 — Player: QueueDrawer + extend playerStore                 [parallel với Phase 1]
  ↓
Phase 5 — New pages (5 trang, có thể build song song nhau)
  ↓
Phase 6 — Enhance existing pages (HomePage, SearchPage, CreatorDashboardPage)
  ↓
Phase 7 — Sidebar / MobileNav updates
  ↓
Phase 8 — Route registration (App.tsx)
  ↓
Phase 9 — BottomPlayerBar: wire QueueDrawer
```

---

## Phase 0 — Types & Mock Data

### Modify: `services/frontend/src/types/domain.ts`
Thêm 3 interface:
```typescript
export interface Artist {
  id: string;
  name: string;
  avatarUrl?: string;
  followerCount?: number;
  songCount?: number;
  totalPlays?: number;
}

export interface SongDetail extends Song {
  releaseDate?: string;
  language?: string;
  genreName?: string;
  moodName?: string;
  playCount?: number;
  explainText?: string;
}

export interface CreatorSongRow {
  songId: string;
  title: string;
  coverUrl?: string;
  genre?: string;
  uploadedAt: string;
  totalPlays: number;
  uniqueListeners: number;
  completionRate: number; // 0–1
}
```

### Modify: `services/frontend/src/services/userService.ts`
Thêm `avatarUrl?: string; preferredGenres?: string[]; preferredArtists?: string[]` vào `UserProfile` interface.

### Modify: `services/frontend/src/mocks/data.ts`
Thêm mock data cho các trang mới:
```typescript
export const MOCK_SONG_DETAIL: SongDetail = {
  id: 'song-001', title: 'Lạc Trôi', artist: 'Sơn Tùng M-TP',
  coverUrl: 'https://picsum.photos/seed/song1/300/300',
  duration: 234, genreName: 'V-Pop', moodName: 'Lãng mạn',
  language: 'Tiếng Việt', releaseDate: '2017-01-01',
  playCount: 150000000, explainText: 'Gợi ý vì bạn hay nghe V-Pop buổi tối'
};

export const MOCK_ARTIST: Artist = {
  id: 'artist-001', name: 'Sơn Tùng M-TP',
  avatarUrl: 'https://picsum.photos/seed/artist1/400/400',
  followerCount: 5200000, songCount: 42, totalPlays: 800000000
};

export const MOCK_CREATOR_SONG_ROWS: CreatorSongRow[] = [
  { songId: 'song-001', title: 'Lạc Trôi', genre: 'V-Pop',
    uploadedAt: '2024-01-15', totalPlays: 15420, uniqueListeners: 8930, completionRate: 0.72 },
  // thêm 4–9 hàng tương tự
];

export const MOCK_HEATMAP: HeatmapDropOff[] = [
  { second: 30, count: 12 }, { second: 60, count: 8 }, { second: 90, count: 45 },
  { second: 120, count: 67 }, { second: 150, count: 23 }, // ...
];

export const MOCK_DAILY_STATS = [
  { date: '08/05', count: 230 }, { date: '09/05', count: 185 },
  { date: '10/05', count: 310 }, { date: '11/05', count: 275 },
  { date: '12/05', count: 420 }, { date: '13/05', count: 380 }, { date: '14/05', count: 290 }
];

export const MOCK_PROFILE: UserProfile = {
  userId: 'user-001', name: 'Nghiep JP', email: 'nghieplasieunhan@gmail.com',
  role: 'Listener', preferredGenres: ['V-Pop', 'Acoustic', 'Indie'],
  preferredArtists: ['Sơn Tùng M-TP', 'Hòa Minzy']
};
```

### Modify: `services/frontend/src/features/recommendation/hooks/useRecommendations.ts`
Cho phép override context từ ngoài:
```typescript
export function useRecommendations(externalContext?: TimeContext | 'none')
// Dùng externalContext nếu được truyền vào, fallback về getTimeContext()
// useEffect reload (với mock: chỉ filter MOCK_RECOMMENDATIONS theo context) khi externalContext thay đổi
```

---

## Phase 1 — Shared UI Components

### New: `services/frontend/src/components/ui/EmptyState.tsx`
```typescript
interface EmptyStateProps {
  variant: 'music' | 'search' | 'bell' | 'group';
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}
```
- Icon map: `music_note` / `search_off` / `notifications_off` / `groups` (Material Symbols)
- Layout: flex-col items-center gap-4, icon trong circle 80px `bg-mid-dark rounded-full`
- CTA: pill button `bg-spotify-green text-near-black` (optional)
- Design ref: `kh_ng_t_m_th_y_k_t_qu_soundwave/` + `th_nh_ph_n_ti_n_ch_soundwave/`

### New: `services/frontend/src/components/ui/SongContextMenu.tsx`
```typescript
interface SongContextMenuProps {
  songId: string;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  onAddToQueue?: () => void;
  onAddToParty?: () => void;
  onGoToArtist?: () => void;
}
```
- Dropdown 200px, `bg-[#282828] rounded-[8px] shadow-heavy border border-border-muted z-[100]`
- Items: Phát ngay, Thêm vào Queue, Thêm vào Party, — divider — Đến trang nghệ sĩ, Chia sẻ
- Đóng khi click ngoài: `useEffect` với `mousedown` listener (pattern từ `CreatorDashboardPage.dropdownRef`)
- Design ref: `th_nh_ph_n_ti_n_ch_soundwave/`

### New: `services/frontend/src/components/ui/UserMenuDropdown.tsx`
```typescript
interface UserMenuDropdownProps {
  profile: { displayName: string; email: string; role: string } | null;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}
```
- Popover 220px từ anchor, `bg-[#282828] rounded-[8px] shadow-heavy`
- Phần trên: avatar 40px + tên + email
- Menu: Profile → `/profile`, Preferences → `/settings/preferences`, — divider — Logout (`text-negative`, gọi `clearAuth()`)
- Design ref: `th_nh_ph_n_ti_n_ch_soundwave/`

---

## Phase 2 — Creator Components

### New: `services/frontend/src/features/creator/components/TimeRangeSelector.tsx`
- Extract pill toggle "7 ngày / 30 ngày" từ `CreatorDashboardPage` (dòng ~448–464)
- Props: `value: '7d' | '30d'; onChange: (v: '7d' | '30d') => void`
- Design ref: `th_nh_ph_n_analytics_soundwave_creator_dashboard/`

### New: `services/frontend/src/features/creator/components/SongStatsCard.tsx`
- Extract `KpiCard` từ `CreatorDashboardPage`, thêm `icon: string` (Material Symbol)
- Props: `icon, value, label, trend?: { label, positive }`
- Design ref: `analytics_chi_ti_t_b_i_h_t_soundwave_creator/`

### New: `services/frontend/src/features/creator/components/DailyListenersChart.tsx`
- Extract `LineChart` SVG từ `CreatorDashboardPage` (dòng ~193–262)
- Props: `data: { date: string; count: number }[]; height?: number`
- Thêm hover tooltip: `<div>` absolute positioned, show `{date}: {count} lượt nghe`
- Design ref: `th_nh_ph_n_analytics_soundwave_creator_dashboard/`

### New: `services/frontend/src/features/creator/components/HeatmapChart.tsx`
- Extract `SkipHeatmap` từ `CreatorDashboardPage` (dòng ~102–191)
- Props: `data: HeatmapDropOff[]; thresholdPct?: number` (default 0.3)
- Thêm đường ngưỡng 30% dạng nét đứt
- Design ref: `analytics_chi_ti_t_b_i_h_t_soundwave_creator/`

### New: `services/frontend/src/features/creator/components/CreatorSongTable.tsx`
- Props: `rows: CreatorSongRow[]; loading?: boolean; onViewAnalytics: (songId: string) => void`
- Table: overflow-x-auto wrapper, columns: `#`, Bài hát (cover 40px + title), Ngày upload, Lượt nghe, Người nghe, Hoàn thành % (progress bar), Actions
- Sort: `useState<{col, dir}>`, client-side, icon `expand_more/expand_less`
- "Xem phân tích" button: opacity-0 → opacity-100 khi hover row
- Pagination: 10 rows/page, `useState(page)`, Prev/Next pills
- Loading: 5 `<SkeletonRow />` (reuse từ `components/ui/SkeletonRow.tsx`)
- Empty: `<EmptyState variant="music" title="Chưa có bài hát nào" ctaLabel="Upload ngay" />`
- Design ref: `danh_s_ch_b_i_h_t_creator_dashboard/`

---

## Phase 3 — Recommendation Components

### New: `services/frontend/src/features/recommendation/components/ContextSelector.tsx`
- Props: `value: TimeContext | 'none'; onChange: (ctx: TimeContext | 'none') => void`
- 4 chips: `{ none: '🎵 Tất cả', morning: '🌅 Sáng', afternoon: '☀️ Chiều', evening: '🌙 Tối', night: '🌃 Khuya' }`
- Active: `bg-spotify-green text-near-black font-bold`; inactive: `bg-mid-dark text-text-secondary`
- `rounded-full px-4 py-2 text-sm transition-colors`
- Design ref: `th_nh_ph_n_trang_ch_soundwave/`

### New: `services/frontend/src/features/recommendation/components/RecommendationFeedRow.tsx`
- Props: `song: RecommendedSong; index: number; onPlay: (song: RecommendedSong) => void`
- Row 64px: số/play icon (swap on hover), cover 56x56 bo 6px, title + reason badge + artist, duration
- Reason badge: `bg-mid-dark px-2 py-0.5 rounded text-[10px] text-text-secondary`
- Title click → `navigate(\`/songs/${song.id}\`)`
- Design ref: `th_nh_ph_n_trang_ch_soundwave/`

---

## Phase 4 — Player: QueueDrawer

### Modify: `services/frontend/src/store/playerStore.ts`
Thêm queue state:
```typescript
queue: CurrentSong[];
addToQueue: (song: CurrentSong) => void;
removeFromQueue: (index: number) => void;
clearQueue: () => void;
```

### New: `services/frontend/src/features/player/components/QueueDrawer.tsx`
- Props: `isOpen: boolean; onClose: () => void`
- Nguồn dữ liệu: `usePlayerStore(s => s.queue)` + `usePlayerStore(s => s.currentSong)`
- Panel: `fixed right-0 top-0 h-full w-[360px] bg-dark-surface border-l border-border-muted/30 z-[60] flex flex-col`
- Slide animation: `translate-x-0` / `translate-x-full` + `transition-transform duration-300`
- Backdrop: `fixed inset-0 bg-black/40 z-[59]` đóng drawer
- Now playing row: `ring-2 ring-spotify-green rounded-md`
- Queue items: drag handle icon (visual only), cover 40px, title + artist, duration, remove button
- Design ref: `th_nh_ph_n_ti_n_ch_soundwave/`

---

## Phase 5 — New Pages (tất cả dùng mock data)

### New: `services/frontend/src/pages/SongDetailPage.tsx`
Route: `/songs/:songId` — wrap trong `<AppShell>`

**Data**: `useState(MOCK_SONG_DETAIL)` + `useState(MOCK_RELATED_SONGS)` — không gọi API

**Layout**:
1. Hero: `relative h-[320px]` — blurred bg image (`blur-3xl scale-110 opacity-50`), gradient overlay, cover art 160x160px, title (24px 700) + artist (clickable → `/artists/:id`) + album + duration badge
2. Actions: Play (green pill, gọi `playSong`), Add to Party (outline pill, mở `CreateRoomModal`), `SongContextMenu`
3. Metadata grid: `grid grid-cols-2 md:grid-cols-4 gap-4` — Genre, Mood, Ngôn ngữ, Ngày phát hành
4. Suggestion card: nếu `song.explainText` tồn tại — `bg-dark-surface rounded-[8px] p-4`
5. Related songs: `<HorizontalSection>` (reuse từ `HomePage`) với `MOCK_RELATED_SONGS`

---

### New: `services/frontend/src/pages/ArtistPage.tsx`
Route: `/artists/:artistId` — wrap trong `<AppShell>`

**Data**: `useState(MOCK_ARTIST)` + `useState(MOCK_RELATED_SONGS as songs)` — không gọi API

**Layout**:
1. Hero banner: `relative h-[280px]` — background image + gradient overlay, avatar tròn 120px
2. Artist name: 48px font-bold
3. Stats bar: Songs | Plays | Followers
4. Actions: Play (green pill, gọi `playSong` với bài đầu tiên) + Follow (outline pill, `useState(isFollowing)` toggle)
5. Popular tracks: reuse `SongsList` pattern từ `SearchPage`
6. Fans Also Like: cuộn ngang với artist cards mock

---

### New: `services/frontend/src/pages/creator/CreatorSongAnalyticsPage.tsx`
Route: `/dashboard/songs/:songId` — wrap trong `<AppShell>`

**Role guard**: redirect nếu `role !== 'Creator' && role !== 'Admin'`

**Data**: `useState(MOCK_SONG_DETAIL)`, `useState(MOCK_HEATMAP)`, `useState(MOCK_DAILY_STATS)` — không gọi API

**Layout**:
1. Breadcrumb: `<Link to="/dashboard">Dashboard</Link> › {song.title}`
2. Song info card: cover 64px + title + genre
3. `<TimeRangeSelector>` right-aligned (thay đổi chỉ ảnh hưởng UI, không reload data)
4. 3 `<SongStatsCard>`: Lượt nghe (`headphones`), Người nghe (`person`), Hoàn thành (`task_alt`)
5. `<DailyListenersChart data={MOCK_DAILY_STATS} />`
6. `<HeatmapChart data={MOCK_HEATMAP} />`

---

### New: `services/frontend/src/pages/ProfilePage.tsx`
Route: `/profile` — wrap trong `<AppShell>`

**Data**: `useState(MOCK_PROFILE)` — không gọi API

**Layout**:
1. Avatar 120px tròn + hover overlay (icon `photo_camera`) — click `<input type="file">` (local preview via `URL.createObjectURL`)
2. Display name: click-to-edit inline (`editingName ? <input> : <span onClick>`)
3. Email + icon `lock` (read-only)
4. Role badge pill
5. Genre chips + Artist chips
6. Link "Chỉnh sửa sở thích" → `/settings/preferences`
7. Logout: gọi `clearAuth()` + `navigate('/login')`

---

### New: `services/frontend/src/pages/PreferencesPage.tsx`
Route: `/settings/preferences` — wrap trong `<AppShell>`

**Data**: `useState(MOCK_PROFILE.preferredGenres)` — không gọi API. Save button chỉ cập nhật local state + show toast

**Layout**:
1. Page title + subtitle
2. Genre grid: **reuse** `<GenreGrid>` từ `features/onboarding/components/GenreGrid.tsx`
3. Artist search: `<Input>` + filter `MOCK_ARTIST_RESULTS` (local mock array, không debounce API)
4. Selected artist chips với `×` remove
5. Sticky save bar: `fixed bottom-[72px] lg:bottom-0 left-0 lg:left-[280px] right-0`
6. Validation: `selectedGenres.length < 3` → disable Save + cảnh báo
7. Save: cập nhật local state → `ToastContext` success toast (không gọi API)

**Reuse**: `<GenreGrid>` (onboarding), `<Input>` (ui), `ToastContext`

---

## Phase 6 — Enhanced Existing Pages

### Modify: `services/frontend/src/pages/HomePage.tsx`
1. Import `ContextSelector`, `RecommendationFeedRow`
2. `useState<TimeContext | 'none'>` cho context
3. Thêm `<ContextSelector value={selectedContext} onChange={setSelectedContext} />`
4. Truyền `selectedContext` vào `useRecommendations(selectedContext)`
5. Thêm section với `<RecommendationFeedRow>` (row layout, hiện explain badge)

### Modify: `services/frontend/src/pages/SearchPage.tsx`
1. Thêm `filterTab: 'all' | 'songs' | 'artists'` state
2. Tab bar underline dưới search input
3. Filter kết quả theo tab
4. Thay inline no-results div bằng `<EmptyState variant="search" />`
5. Nâng cấp `ArtistsRow` dùng `ArtistCard` (160x200px, circular avatar, floating play)
6. `ArtistCard` click → `navigate(\`/artists/${artist.id}\`)`

### Modify: `services/frontend/src/pages/CreatorDashboardPage.tsx`
1. Import `CreatorSongTable`
2. Thêm `rows={MOCK_CREATOR_SONG_ROWS}` — không gọi API
3. `onViewAnalytics={(id) => navigate(\`/dashboard/songs/${id}\`)}`
4. Thay inline TimeRangeSelector bằng component đã extract

---

## Phase 7 — Sidebar & Navigation

### Modify: `services/frontend/src/components/layout/Sidebar.tsx`
1. Wrap user bottom section trong `<button onClick={() => navigate('/profile')}>`
2. Tích hợp `<UserMenuDropdown>` — toggle khi click avatar

### Modify: `services/frontend/src/components/layout/MobileNav.tsx`
1. Thêm `/profile` link với icon `person`

---

## Phase 8 — Route Registration

### Modify: `services/frontend/src/App.tsx`
```typescript
import SongDetailPage from './pages/SongDetailPage';
import ArtistPage from './pages/ArtistPage';
import ProfilePage from './pages/ProfilePage';
import PreferencesPage from './pages/PreferencesPage';
import CreatorSongAnalyticsPage from './pages/creator/CreatorSongAnalyticsPage';

<Route path="/songs/:songId" element={<SongDetailPage />} />
<Route path="/artists/:artistId" element={<ArtistPage />} />
<Route path="/profile" element={<ProfilePage />} />
<Route path="/settings/preferences" element={<PreferencesPage />} />
<Route path="/dashboard/songs/:songId" element={<CreatorSongAnalyticsPage />} />
```

---

## Phase 9 — BottomPlayerBar: Queue Integration

### Modify: `services/frontend/src/components/layout/BottomPlayerBar.tsx`
1. `const [showQueue, setShowQueue] = useState(false)`
2. Nút `queue_music` → `setShowQueue(true)`
3. Render `<QueueDrawer isOpen={showQueue} onClose={() => setShowQueue(false)} />`
4. Z-index: `QueueDrawer` = `z-[60]`, `NowPlayingOverlay` nâng lên `z-[70]`

---

## Key Notes

1. **Mock data nhất quán**: Dùng cùng `songId: 'song-001'` trong tất cả mock để navigate giữa pages hoạt động (ví dụ: click song từ SearchPage → SongDetailPage hiện đúng data).

2. **Chart extraction**: Khi tách `LineChart`, `SkipHeatmap`, `KpiCard` ra khỏi `CreatorDashboardPage`, helper `formatSeconds` và path-building logic phải đi kèm component — không để lại trong page cũ.

3. **PreferencesPage sticky bar offset**: `AppShell` thêm `pb-[128px] lg:pb-[72px]` vào main. Sticky bar phải `bottom-[72px] lg:bottom-0`.

4. **playerStore queue**: Nếu extend phức tạp, có thể dùng `useState` local trong `BottomPlayerBar` cho MVP.

5. **`useRecommendations` backward compat**: `externalContext` là optional — các call site hiện tại không cần thay đổi.

6. **ArtistPage `artistId` param**: Với mock data, `artistId` trong URL không cần match — luôn trả về `MOCK_ARTIST`.

---

## Verification Checklist

- [ ] `tsc --noEmit` pass (không có type error)
- [ ] `npm run build` pass
- [ ] `EmptyState` render đủ 4 variants
- [ ] `SongContextMenu` đóng khi click ngoài
- [ ] `CreatorSongTable` sort và pagination với mock data
- [ ] `ContextSelector` active chip có `bg-spotify-green`
- [ ] `QueueDrawer` slide in/out animation mượt
- [ ] `/songs/song-001` hiện hero với mock song data
- [ ] `/dashboard/songs/song-001` chỉ accessible với Creator/Admin (redirect về `/` nếu là Listener)
- [ ] `/profile` hiện mock profile info
- [ ] `/settings/preferences` nút Save disabled khi < 3 genre
- [ ] `/settings/preferences` save → toast success (không gọi API)
- [ ] `SearchPage` tab filter hoạt động, no-results dùng `EmptyState`
- [ ] `HomePage` ContextSelector chip thay đổi context
- [ ] `CreatorDashboardPage` "Xem phân tích" navigate sang `/dashboard/songs/song-001`
- [ ] 5 routes mới không bị 404
- [ ] Protected routes redirect về `/login` khi chưa đăng nhập

---

## Files Summary

### Files mới tạo (16 files)
```
services/frontend/src/components/ui/EmptyState.tsx
services/frontend/src/components/ui/SongContextMenu.tsx
services/frontend/src/components/ui/UserMenuDropdown.tsx
services/frontend/src/features/creator/components/TimeRangeSelector.tsx
services/frontend/src/features/creator/components/SongStatsCard.tsx
services/frontend/src/features/creator/components/DailyListenersChart.tsx
services/frontend/src/features/creator/components/HeatmapChart.tsx
services/frontend/src/features/creator/components/CreatorSongTable.tsx
services/frontend/src/features/recommendation/components/ContextSelector.tsx
services/frontend/src/features/recommendation/components/RecommendationFeedRow.tsx
services/frontend/src/features/player/components/QueueDrawer.tsx
services/frontend/src/pages/SongDetailPage.tsx
services/frontend/src/pages/ArtistPage.tsx
services/frontend/src/pages/ProfilePage.tsx
services/frontend/src/pages/PreferencesPage.tsx
services/frontend/src/pages/creator/CreatorSongAnalyticsPage.tsx
```

### Files chỉnh sửa (11 files)
```
services/frontend/src/types/domain.ts
services/frontend/src/services/userService.ts
services/frontend/src/store/playerStore.ts
services/frontend/src/mocks/data.ts
services/frontend/src/features/recommendation/hooks/useRecommendations.ts
services/frontend/src/pages/HomePage.tsx
services/frontend/src/pages/SearchPage.tsx
services/frontend/src/pages/CreatorDashboardPage.tsx
services/frontend/src/components/layout/Sidebar.tsx
services/frontend/src/components/layout/MobileNav.tsx
services/frontend/src/components/layout/BottomPlayerBar.tsx
services/frontend/src/App.tsx
```
