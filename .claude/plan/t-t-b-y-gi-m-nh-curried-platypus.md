# Plan: Frontend Refactor — Spotify-inspired Design System

## Context

Codebase frontend hiện tại (React 19 + TypeScript + Vite) đã có 4 pages cơ bản (Home, Login, Search, CreatorDashboard) nhưng dùng inline styles + vanilla CSS không nhất quán, chưa đủ 13 màn hình theo thiết kế.

Google Stitch đã generate 18 screens HTML dùng **Tailwind CSS** + custom design tokens. Mục tiêu refactor: đồng bộ toàn bộ UI với Stitch designs, thêm Tailwind, tái cấu trúc folder theo SKILL.md, và implement đủ 13 screens.

**Quyết định đã xác nhận:**
- Thêm Tailwind CSS (tận dụng 1:1 với Stitch HTML output)
- Scope: toàn bộ 13 screens
- Register: build UI đầy đủ + mock API (chờ contract)

---

## Stitch Design Files

Base path: `design/stitch_soundwave_dark_login_interface/`

| Folder | Screen |
|---|---|
| `ng_nh_p_soundwave` | Login |
| `ng_k_soundwave` | Register |
| `ch_n_th_lo_i_onboarding_step_1` | Onboarding Step 1 (Genre) |
| `ch_n_ngh_s_onboarding_step_2` | Onboarding Step 2 (Artist) |
| `ho_n_t_t_onboarding_soundwave` | Onboarding Step 3 (Complete) |
| `trang_ch_soundwave` | Home |
| `ang_ph_t_m_r_ng_soundwave` | Now Playing |
| `t_m_ki_m_tr_ng_soundwave` | Search (empty) |
| `k_t_qu_t_m_ki_m_soundwave` | Search (results) |
| `t_o_ph_ng_listening_party` | Party Create Modal |
| `tham_gia_ph_ng_listening_party` | Party Join Modal |
| `ph_ng_nghe_nh_c_listening_party` | Party Room |
| `t_i_nh_c_l_n_soundwave_creator` | Upload Song |
| `analytics_dashboard_soundwave_creator` | Analytics Dashboard |
| `th_ng_b_o_soundwave` | Notifications |
| `ng_nh_p_l_i_soundwave` | Login Error state |
| `t_i_kho_n_b_kh_a_soundwave` | Account Locked state |
| `soundwave_design_system` | Design System reference |

---

## Critical Files

**Đọc trước khi implement mỗi phase:**
- `design/stitch_soundwave_dark_login_interface/<folder>/code.html` — HTML/Tailwind source
- `design/stitch_soundwave_dark_login_interface/<folder>/screen.png` — Visual reference
- `DESIGN.md` — Design token reference
- `STITCH_PROMPTS.md` — Prompt notes
- `.claude/skills/react-spa/SKILL.md` — Folder structure + coding conventions
- `.claude/rules/security-non-negotiable/RULE.md` — Auth patterns (token storage)

**Files thay đổi chính:**
- `services/frontend/package.json` — thêm Tailwind + deps
- `services/frontend/tailwind.config.ts` — custom tokens (tạo mới)
- `services/frontend/src/index.css` — thay bằng Tailwind directives + CSS vars
- `services/frontend/src/App.tsx` — thêm routes mới
- `services/frontend/src/styles/tokens.ts` — giữ làm reference, migrate sang Tailwind config

---

## Target Folder Structure (sau refactor)

```
src/
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   ├── onboarding/
│   │   └── OnboardingPage.tsx       # 3-step wizard
│   ├── HomePage.tsx
│   ├── SearchPage.tsx
│   ├── NotificationsPage.tsx
│   ├── player/
│   │   └── NowPlayingPage.tsx
│   ├── party/
│   │   └── PartyRoomPage.tsx
│   └── creator/
│       ├── UploadPage.tsx
│       └── AnalyticsPage.tsx
├── features/
│   ├── auth/
│   │   ├── components/LoginForm.tsx, RegisterForm.tsx
│   │   ├── hooks/useAuth.ts, useProtectedRoute.ts
│   │   └── authSlice.ts
│   ├── onboarding/
│   │   ├── components/GenreGrid.tsx, ArtistGrid.tsx, SelectionCounter.tsx
│   │   └── hooks/useOnboarding.ts
│   ├── player/
│   │   ├── components/AudioPlayer.tsx, SeekBar.tsx, NowPlayingOverlay.tsx
│   │   ├── hooks/useAudioPlayer.ts
│   │   └── playerSlice.ts
│   ├── recommendation/
│   │   ├── components/SongCard.tsx, RecommendationSection.tsx
│   │   └── hooks/useRecommendations.ts
│   ├── search/
│   │   ├── components/SearchInput.tsx, SearchResults.tsx
│   │   └── hooks/useSearch.ts
│   ├── party/
│   │   ├── components/CreateRoomModal.tsx, JoinRoomModal.tsx,
│   │   │              MemberList.tsx, HostControls.tsx, RoomPlayer.tsx
│   │   ├── hooks/useListeningParty.ts (rename từ usePartyWebSocket.ts)
│   │   └── partySlice.ts
│   ├── creator/
│   │   ├── components/FileDropzone.tsx, MetadataForm.tsx,
│   │   │              KPICard.tsx, HeatmapBar.tsx, LineChart.tsx
│   │   └── hooks/useAnalytics.ts, useUpload.ts
│   └── notifications/
│       ├── components/NotificationRow.tsx, FilterPills.tsx
│       └── hooks/useNotifications.ts
├── components/
│   ├── ui/
│   │   ├── Button.tsx            # GreenButton, PillButton, OutlinedButton
│   │   ├── Input.tsx             # PillInput (inset shadow pattern)
│   │   ├── Modal.tsx             # Base modal with backdrop
│   │   ├── Toast.tsx             # Error/success toasts
│   │   ├── Spinner.tsx
│   │   └── SkeletonRow.tsx
│   └── layout/
│       ├── AppShell.tsx          # Sidebar + Content + PlayerBar
│       ├── Sidebar.tsx           # Role-aware nav
│       └── BottomPlayerBar.tsx   # Persistent player
├── services/
│   ├── api.ts                    # Axios instance (rename từ client.ts)
│   ├── authService.ts
│   ├── userService.ts
│   ├── musicService.ts
│   ├── streamingService.ts
│   ├── recommendationService.ts
│   ├── searchService.ts
│   ├── notificationService.ts
│   ├── analyticsService.ts
│   └── partyService.ts
├── store/
│   ├── authStore.ts              # giữ nguyên logic
│   └── playerStore.ts            # giữ nguyên logic
├── types/
│   ├── api.ts                    # ApiResponse<T>, ApiError, ApiMeta
│   └── domain.ts                 # Song, User, Party, Role
└── utils/
    ├── errorMessages.ts          # error code → tiếng Việt
    └── time.ts                   # context detection (morning/evening)
```

---

## Implementation Phases

### Phase 0 — Tailwind Setup + Design Token Migration
**Mục tiêu:** Cài Tailwind, map design tokens từ Stitch vào tailwind.config, xóa inline styles khỏi files hiện tại.

**Tasks:**
1. `npm install -D tailwindcss @tailwindcss/vite`
2. Tạo `tailwind.config.ts` với custom tokens từ Stitch:
   - Colors: `spotify-green`, `near-black`, `dark-surface`, `mid-dark`, `dark-card`, `text-base`, `text-secondary`, `border-muted`, v.v.
   - FontFamily: `body`, `title` (SpotifyMixUI + fallback)
   - BorderRadius: `card` (8px), `pill` (500px), `full` (9999px)
   - BoxShadow: `level-1`, `level-2`, `level-3`, `input-inset`
   - Typography plugin config cho các type styles
3. Update `index.css`: thay bằng `@tailwind base/components/utilities` + giữ CSS vars cho dynamic theming
4. Update `vite.config.ts` để load Tailwind plugin
5. Tạo `src/types/api.ts` và `src/types/domain.ts`
6. Tạo `src/utils/errorMessages.ts` và `src/utils/time.ts`
7. Tạo `src/services/api.ts` (di chuyển từ `api/client.ts`)

**Files tạo mới:** `tailwind.config.ts`
**Files sửa:** `package.json`, `vite.config.ts`, `index.css`
**Không xóa:** `styles/tokens.ts` (giữ làm reference trong quá trình migrate)

---

### Phase 1 — Shared UI Components
**Mục tiêu:** Tạo atomic components dùng chung trước khi build pages.

**Components cần tạo** (reference: `soundwave_design_system/code.html`):

| Component | File | Variants |
|---|---|---|
| Button | `components/ui/Button.tsx` | green (primary), pill-dark, outlined, circular |
| Input | `components/ui/Input.tsx` | pill với inset shadow, password toggle, error state |
| Modal | `components/ui/Modal.tsx` | backdrop blur, heavy shadow |
| Toast | `components/ui/Toast.tsx` | error (#f3727f), success (#1ed760) |
| Spinner | `components/ui/Spinner.tsx` | inline loading |
| SkeletonRow | `components/ui/SkeletonRow.tsx` | shimmer animation |

**Layout components** (reference: `trang_ch_soundwave/code.html`):
- `AppShell.tsx` — refactor từ file hiện tại, dùng Tailwind
- `Sidebar.tsx` — tách ra khỏi AppShell, role-aware
- `BottomPlayerBar.tsx` — tách ra khỏi AudioPlayer

---

### Phase 2 — Auth Screens
**Mục tiêu:** Login + Register + error states.

**Screens:** Login, Register (mock API), Account Locked state
**Stitch refs:** `ng_nh_p_soundwave`, `ng_k_soundwave`, `ng_nh_p_l_i_soundwave`, `t_i_kho_n_b_kh_a_soundwave`

**Tasks:**
1. Refactor `LoginPage.tsx` → dùng Tailwind classes từ Stitch
2. Tạo `RegisterPage.tsx` với full form (name, email, password, confirm, role toggle, terms)
   - Mock `POST /api/v1/auth/register` với `// TODO: wire real endpoint when API contract is defined`
3. Tạo `features/auth/components/LoginForm.tsx`, `RegisterForm.tsx`
4. Tạo `features/auth/hooks/useAuth.ts` (extract logic từ LoginPage hiện tại)
5. Tạo `features/auth/hooks/useProtectedRoute.ts` (extract auth guard logic)
6. Update `App.tsx`: thêm route `/register`
7. `PasswordStrengthBar` component trong RegisterForm

**Security constraints (từ RULE.md):**
- Access token: in-memory only (giữ nguyên authStore pattern)
- Refresh token: HTTP-only Cookie (không thay đổi)
- Không log token, email, password

---

### Phase 3 — Onboarding Flow
**Mục tiêu:** 3-step wizard (Genre → Artist → Complete), chỉ hiện lần đầu đăng nhập.

**Screens:** Onboarding Step 1, 2, 3
**Stitch refs:** `ch_n_th_lo_i_onboarding_step_1`, `ch_n_ngh_s_onboarding_step_2`, `ho_n_t_t_onboarding_soundwave`

**Tasks:**
1. Tạo `OnboardingPage.tsx` với stepper state (step 1/2/3)
2. Tạo `features/onboarding/components/`:
   - `GenreGrid.tsx` — 9 cards với gradient backgrounds, selected state
   - `ArtistGrid.tsx` — circular avatar cards, selected state
   - `SelectionCounter.tsx` — bottom bar "Đã chọn: X/3"
3. Tạo `features/onboarding/hooks/useOnboarding.ts`
   — gọi `POST /api/v1/users/me/preferences`
   — kiểm tra min 3 items (disable button nếu < 3)
4. Logic: sau login check `hasCompletedOnboarding` từ user profile → redirect `/onboarding` nếu chưa
5. Update `App.tsx`: thêm route `/onboarding`

---

### Phase 4 — App Shell + Home Page
**Mục tiêu:** Refactor layout shell và Home page theo Stitch.

**Screens:** Home (với sidebar + bottom player)
**Stitch refs:** `trang_ch_soundwave`

**Tasks:**
1. Refactor `AppShell.tsx`:
   - Sidebar fixed 240px (hidden trên mobile)
   - Main content với `ml-[240px]` offset
   - Bottom player 72px fixed (hidden khi không có song)
2. Tạo `Sidebar.tsx`:
   - Role-aware nav items (Creator: thêm Upload + Analytics)
   - Notification badge count
   - User avatar + name + "···" menu ở bottom
3. Tạo `BottomPlayerBar.tsx`:
   - Song info (left) + controls (center) + volume (right)
   - Circular play button (#1ed760 bg, #000 icon)
   - Seek bar với hover expand effect
4. Refactor `HomePage.tsx`:
   - Greeting header với time context ("Chào buổi sáng")
   - 3 recommendation sections (horizontal scroll)
   - `SongCard.tsx` với hover play button
5. Tạo `features/recommendation/hooks/useRecommendations.ts`
   — gọi `GET /api/v1/recommendations?context={timeContext}`
   — detect context từ `utils/time.ts`

---

### Phase 5 — Player + Search
**Mục tiêu:** Now Playing expanded view + Search page với 2 states.

**Screens:** Now Playing overlay, Search empty, Search results
**Stitch refs:** `ang_ph_t_m_r_ng_soundwave`, `t_m_ki_m_tr_ng_soundwave`, `k_t_qu_t_m_ki_m_soundwave`

**Tasks:**
1. Tạo `NowPlayingOverlay.tsx` (fullscreen, toggle từ BottomPlayerBar):
   - Album art với dynamic glow (màu từ dominant color)
   - Seek bar interactive
   - Tabs: Lời bài hát / Hàng chờ / Liên quan
2. Refactor `SearchPage.tsx`:
   - Empty state: search input + genre browse grid
   - Active state: top result + tracks list + artists row
   - Fallback: empty array on timeout (không throw error — per API contract)
3. Tạo `features/search/hooks/useSearch.ts`
   — gọi `GET /api/v1/search?q=...`
   — debounce 300ms

---

### Phase 6 — Listening Party
**Mục tiêu:** Create/Join modals + Room view với Host/Member roles.

**Screens:** Create modal, Join modal, Room view
**Stitch refs:** `t_o_ph_ng_listening_party`, `tham_gia_ph_ng_listening_party`, `ph_ng_nghe_nh_c_listening_party`

**Tasks:**
1. Tạo `CreateRoomModal.tsx`:
   — gọi `POST /api/v1/parties`
2. Tạo `JoinRoomModal.tsx` với 6-char code input:
   — gọi `POST /api/v1/parties/{joinCode}/join`
3. Tạo `PartyRoomPage.tsx`:
   - `RoomPlayer.tsx` — album art, progress (read-only for Member)
   - `HostControls.tsx` — chỉ render nếu `userId === hostId`
   - `MemberList.tsx` — avatar + role badge (👑 Host, Thành viên)
   - "LIVE" blinking indicator
4. Rename `usePartyWebSocket.ts` → `features/party/hooks/useListeningParty.ts`
   — SignalR WebSocket connection
   — SYNC_STATE events

---

### Phase 7 — Creator Screens
**Mục tiêu:** Upload song + Analytics dashboard.

**Screens:** Upload, Analytics
**Stitch refs:** `t_i_nh_c_l_n_soundwave_creator`, `analytics_dashboard_soundwave_creator`

**Tasks:**
1. Tạo `UploadPage.tsx`:
   - `FileDropzone.tsx` — drag-and-drop, validate MIME + size (≤50MB)
   - `MetadataForm.tsx` — title, genre select, mood select, language, explicit toggle
   - Upload progress bar
   - S3 atomicity: chỉ hiện success sau khi API confirm
   - RBAC: chỉ Creator role được access (RoleGuard)
2. Refactor `CreatorDashboardPage.tsx` → `AnalyticsPage.tsx`:
   - `KPICard.tsx` — 4 stats cards với trend badge
   - `LineChart.tsx` — daily listeners (CSS-based hoặc recharts nếu cần)
   - `HeatmapBar.tsx` — skip-rate timeline
   - `DonutChart.tsx` — completion rate
   - Song selector dropdown
   - Time range pills (7d / 30d)
   - RBAC: Creator (own songs only) + Admin (all)

---

### Phase 8 — Notifications + Polish
**Mục tiêu:** Notifications page + global error/loading states + responsive.

**Screens:** Notifications
**Stitch ref:** `th_ng_b_o_soundwave`

**Tasks:**
1. Tạo `NotificationsPage.tsx`:
   - `NotificationRow.tsx` với unread indicator (green dot)
   - `FilterPills.tsx` — Tất cả / Chưa đọc / Bài hát mới
   - "Đánh dấu tất cả đã đọc" action
   - Skeleton loading state
   - Empty state
2. Refactor `NotificationBell.tsx` (component hiện tại) → dùng Tailwind
3. **Global polish:**
   - `Toast.tsx` — error/success notifications toàn app
   - `errorMessages.ts` — map tất cả error codes sang tiếng Việt
   - Responsive breakpoints: sidebar collapse trên mobile, bottom nav
   - `RoleGuard.tsx` tách ra thành component riêng

---

## Routing (App.tsx sau refactor)

```tsx
<BrowserRouter>
  <Routes>
    {/* Public */}
    <Route path="/login"    element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />

    {/* Protected — all roles */}
    <Route element={<AuthGuard />}>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route element={<AppShell />}>
        <Route path="/"              element={<HomePage />} />
        <Route path="/search"        element={<SearchPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/party/:roomId" element={<PartyRoomPage />} />
      </Route>
    </Route>

    {/* Protected — Creator + Admin */}
    <Route element={<AuthGuard />}>
      <Route element={<RoleGuard roles={['Creator', 'Admin']} />}>
        <Route element={<AppShell />}>
          <Route path="/upload"    element={<UploadPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Route>
      </Route>
    </Route>
  </Routes>
</BrowserRouter>
```

---

## Reusable Patterns (từ Stitch HTML)

### Input pill + inset shadow
```tsx
className="w-full bg-mid-dark rounded-full py-3 px-5
           shadow-input-inset border-none
           placeholder:text-text-secondary
           focus:bg-dark-card focus:outline-none
           transition-colors duration-200"
```

### Primary CTA button
```tsx
className="w-full bg-spotify-green text-near-black
           font-button-uppercase rounded-full py-3
           hover:scale-105 active:scale-95
           transition-transform duration-200"
```

### Song card (horizontal scroll)
```tsx
className="w-40 flex-shrink-0 bg-dark-surface p-3
           rounded-[6px] hover:bg-[#282828]
           transition-colors group relative cursor-pointer"
```

### Circular play button
```tsx
className="w-12 h-12 bg-spotify-green rounded-full
           flex items-center justify-center
           hover:scale-105 active:scale-95
           transition-transform duration-200"
```

---

## Register Mock API

Vì `POST /api/v1/auth/register` chưa có trong API Design V2:

```typescript
// services/authService.ts
export async function register(data: RegisterRequest): Promise<void> {
  // TODO: wire real endpoint when API contract is defined
  // Mock: simulate success after 1s
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

Comment trong RegisterPage:
```typescript
// TODO: replace mock with real API when POST /api/v1/auth/register is defined
```

---

## Verification

Sau mỗi phase, verify:
1. `npm run build` — TypeScript strict mode không có lỗi
2. `npm run test` — existing tests vẫn pass
3. `npm run dev` — render đúng trên localhost:3000
4. Kiểm tra visually: so sánh với `screen.png` tương ứng trong Stitch folder
5. Kiểm tra responsive: sidebar collapse ở < 1024px
6. Kiểm tra role guard: `/upload` redirect nếu role = Listener

---

## Phase Order & Dependencies

```
Phase 0 (Tailwind Setup)
    ↓
Phase 1 (Shared UI Components)
    ↓
Phase 2 (Auth) ──────────────────────────────────┐
    ↓                                             │
Phase 3 (Onboarding)          cần AuthGuard từ Phase 2
    ↓
Phase 4 (AppShell + Home) ───── cần BottomPlayerBar từ Phase 1
    ↓
Phase 5 (Player + Search) ────── cần AppShell từ Phase 4
    ↓
Phase 6 (Listening Party) ─────── cần AppShell từ Phase 4
    ↓
Phase 7 (Creator) ──────────────── cần RoleGuard từ Phase 2
    ↓
Phase 8 (Notifications + Polish) ── cần tất cả phases trên
```
