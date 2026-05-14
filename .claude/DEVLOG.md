# DEVLOG — Smart Music Streaming Platform
---
[2026-05-14] [FRONTEND / CSS AUDIT PHASE 1 — 6 CONFIRMED VIOLATIONS] [DONE]

**Task:** Fix 6 violations đã xác nhận trước khi audit toàn bộ 44 files.
**Plan file:** `.claude/plan/tr-c-khi-th-c-task-prancy-lovelace.md`

**Kết quả:**
1. `Sidebar.tsx` — `w-[240px]` → `w-[280px]` ✅
2. `AppShell.tsx` — `ml-[240px]` → `ml-[280px]` ✅
3. `Modal.tsx` — `rounded-lg` → `rounded-[8px]` ✅
4. `SongCard.tsx` — arbitrary shadow → `shadow-level-2` + hover `shadow-level-3` ✅
5. `SearchPage.tsx` — `border border-border-muted` + arbitrary inset → `shadow-input-inset` ✅
6. `tailwind.config.ts` — verified, tokens đã đúng spec, không cần sửa ✅

**Tests:** 314/314 xanh — không regression.
**Build TS errors:** 3 lỗi pre-existing (mocks/data.ts, ToastContext.test.tsx, PartyRoomPage.test.tsx) — không liên quan CSS fixes, tồn tại trước commit này.
**Tiếp theo:** Full audit 38 files còn lại — Bước 3 trong plan.

---
[2026-05-14] [FRONTEND / PHASE 8 — NOTIFICATIONS + POLISH] [DECISION × 3]

**Decision 1 — ToastProvider (global context vs. local state)**
Chọn `ToastProvider` bọc toàn app (trong `App.tsx`) thay vì local `useState` trong từng page. Lý do: nhiều async actions xảy ra cross-page (upload xong → navigate về Home → toast vẫn hiện). Pattern: one-at-a-time toast (replace, không queue). `useToast().show(message, variant)` gọi được từ bất kỳ component nào trong cây.
**Lesson / Warning:** `useToast` phải được gọi bên trong `ToastProvider`. Test cần wrap render với `<ToastProvider>`. Nếu quên wrap → throw "useToast must be used within ToastProvider".

**Decision 2 — Mock handler trả ALL notifications**
Handler `GET /api/v1/notifications/unread` đổi từ trả filtered (chỉ unread) → trả ALL items + `totalUnread` count. Lý do: `NotificationsPage` cần hiển thị cả read và unread trong tab "Tất cả". API Design V2 chỉ có 1 endpoint — không thêm endpoint mới. Sidebar vẫn đọc đúng `totalUnread` field.
**Lesson / Warning:** Đây là hành vi mock mode — real backend vẫn trả unread-only. Nếu wire real API sau này, cần tách `fetchAllNotifications` riêng hoặc thêm endpoint.

**Decision 3 — MobileNav + BottomPlayerBar stacking**
`MobileNav`: `fixed bottom-0 lg:hidden z-[60]`, `h-14` (56px). `BottomPlayerBar`: đổi từ `bottom-0` → `bottom-14 lg:bottom-0` (56px trên mobile, 0 trên desktop). `AppShell` main: `pb-[128px] lg:pb-[72px]`. Khi không có song phát: padding-bottom dư 72px trên mobile — acceptable cho demo.
**Lesson / Warning:** BottomPlayerBar test không check CSS positioning class → đổi safe. Nếu cần zero waste padding khi không có song: `MobileNav` đọc `playerStore.currentSong` để biết BottomPlayerBar có visible không và tự adjust position.

---
[2026-05-14] [FRONTEND / PHASE 7 — UPLOAD PAGE] [BUG]

**Problem:** 4/15 tests thất bại: "shows error for invalid MIME", "shows success screen", "shows error on failure", "resets form". Tất cả timeout ở ~1042ms.
**Root cause:** `uploadSong()` trong `musicService.ts` dùng `axios.post` với `FormData`. Trong vitest/jsdom environment, axios với FormData không được MSW (`msw/node`) intercept đúng cách — request bị "bypass" thay vì bị intercept, dẫn đến network error → `catch` block set `status = 'error'` thay vì success. Riêng "invalid MIME" test fail vì `userEvent.upload` trên `aria-hidden` input không fire `onChange` event.
**Fix / Decision:**
  1. Đổi sang `vi.mock('../../services/musicService')` — mock toàn bộ service thay vì dùng MSW. Đơn giản hơn, không phụ thuộc vào FormData serialization.
  2. Đổi từ `userEvent.upload` sang `fireEvent.change` + `Object.defineProperty(input, 'files', ...)` cho tất cả file input tests — reliable hơn với hidden inputs.
**Lesson / Warning:** Khi upload endpoint dùng FormData (multipart): trong vitest tests, không nên dùng MSW để intercept — mock service function trực tiếp bằng `vi.mock`. MSW chỉ reliable cho JSON endpoints. Pattern: `vi.mock('../services/xyzService', () => ({ uploadFn: vi.fn() }))`.

---
[2026-05-14] [FRONTEND / POST-PHASE 6] [BUG × 3]

**Problem 1:** `http proxy error: /ws/v1/parties/{roomId}/negotiate?negotiateVersion=1` trong Vite dev server console.
**Root cause:** SignalR negotiate là HTTP POST trước khi upgrade lên WebSocket. `vite.config.ts` dùng `target: 'ws://localhost:5005'` — Vite không proxy HTTP request đến `ws://` target đúng cách.
**Fix:** Đổi sang `target: 'http://localhost:5005', changeOrigin: true` — Vite tự handle WS upgrade từ `http://` target khi có `ws: true`.

**Problem 2:** RoomPlayer bị nén — `div` với `max-w-md mx-auto` (448px) trong layout 60% width làm player squeeze content.
**Fix:** Bỏ `max-w-md mx-auto`, dùng `w-full` để player fill toàn bộ section được cấp.

**Problem 3:** `/party` route dẫn đến `PartyLandingPage` gây vỡ layout vì page thiếu context đầy đủ khi access trực tiếp từ Sidebar.
**Fix:** Đổi Sidebar `/party` nav item từ `<Link>` thành `<button>` → click mở `CreateRoomModal` trực tiếp. Thêm `onSwitchToJoin` prop vào `CreateRoomModal` để render nút "THAM GIA PHÒNG" chuyển sang `JoinRoomModal` mà không cần navigate. Sidebar giờ render cả 2 modals và handle navigate sau khi create/join thành công.
**Lesson / Warning:** WS proxy trong Vite phải dùng `http://` làm target, không phải `ws://` — `ws: true` flag là đủ để Vite handle upgrade protocol.

---
[2026-05-14] [FRONTEND / PHASE 6] [BUG]

**Problem:** 3 test failures khi viết tests cho Listening Party components.
**Root cause:**
1. `CreateRoomModal` - `toHaveValue(expect.stringContaining(...))` không hoạt động với jest-dom — `toHaveValue` không nhận `asymmetric matcher`. Phải dùng `(input as HTMLInputElement).value.toContain(...)`.
2. `JoinRoomModal` - Preview card dùng `aria-label="Thông tin phòng"` trên `<div>` (không phải `role="region"`) nên `getByRole('region', ...)` không tìm thấy. Phải dùng `getByLabelText(...)`.
3. `PartyLandingPage` - `getByText(/Listening Party/)` tìm thấy 2 elements: Sidebar nav link + h1 heading. `getByRole('button', { name: /TẠO PHÒNG/i })` tìm thấy 2: landing card + modal submit. Cần scope với `getByRole('heading', ...)` và `within(dialog).getByRole(...)`.
**Fix:** (1) Đổi sang `(element as HTMLInputElement).value.toContain()`. (2) Đổi sang `getByLabelText()`. (3) Dùng `getByRole('heading')` và import `within` từ testing-library để scope search trong dialog.
**Lesson / Warning:** Khi component được render bên trong AppShell (có Sidebar), tất cả text trong Sidebar nav (Home, Search, Listening Party...) sẽ xuất hiện trong DOM. Tránh dùng `getByText` với text mà Sidebar cũng dùng. Dùng `getByRole('heading')`, `within(dialog)`, hoặc `getByRole` có scope cụ thể hơn.

---
[2026-05-14] [FRONTEND / PHASE 6] [BUG]

**Problem:** `partyService.ts` dùng `import api from './api'` nhưng `api.ts` không có default export, chỉ export named `apiClient`.
**Root cause:** Nhầm pattern — các service khác (searchService, analyticsService) đều dùng `apiClient` named import.
**Fix:** Đổi thành `import { apiClient } from './api'` và thay `api.post(...)` bằng `apiClient.post(...)`.
**Lesson / Warning:** Khi tạo service mới, luôn kiểm tra export pattern của `api.ts` trước. `api.ts` export `apiClient` (named) và `getAccessToken`, `setAccessToken` — không có default export.

---

**Dành cho:** nhóm dev + Claude (đọc khi debug để tránh lặp lại vấn đề cũ).

**Khi nào ghi:**
---
[2026-05-14] [FRONTEND / PHASE 5] [BUG]

**Problem:** 3 loại bug khi chạy test SearchPage + NowPlayingOverlay.
**Root cause:**
1. SearchPage renders `const searchInput = <SearchInput/>` ở 2 vị trí DOM (mobile + desktop header). JSDOM không apply `lg:hidden` CSS nên cả 2 input đều visible → `getByRole('textbox', ...)` throw "Found multiple elements". Tương tự cho clear button ("Xóa tìm kiếm").
2. NowPlayingOverlay: `MOCK_LYRICS[2]` là `'Và chuyến xe này sẽ đi về đâu'` (chữ thường sau "Và") nhưng test assert `'Chuyến xe này sẽ đi về đâu'` (chữ hoa C) — substring không match.
3. TopResultCard test: mock `song-001` có score 0.98 > `artist-1` score 0.95 → SearchPage chọn song làm top result, nhưng test expect artist.
**Fix:** (1) Thêm helper `getSearchInput()` dùng `getAllByRole(...)[0]` cho cả input và clear button. (2) Sửa lyrics test assert thành lowercase `'chuyến xe này sẽ đi về đâu'`. (3) Đổi mock `artist-1` score từ 0.95 → 0.99 để artist thực sự là highest-scored item.
**Lesson / Warning:** Khi component được reuse ở nhiều DOM positions (responsive show/hide bằng CSS class), luôn dùng `getAllBy*` + index thay vì `getBy*`. JSDOM không apply media query / Tailwind responsive classes.

---
[2026-05-14] [FRONTEND / PHASE 5] [BUG]

**Problem:** Nút play trong BottomPlayerBar và NowPlayingOverlay hiển thị màu đen cho icon.
**Root cause:** BottomPlayerBar dùng `bg-white text-black` trên button container. NowPlayingOverlay có `bg-text-emphasis` trên button và `text-near-black` hardcoded trên cả 2 thẻ `<span>` bên trong — span override màu từ parent.
**Fix:** BottomPlayerBar: bỏ `bg-white text-black`, thêm `text-text-secondary hover:text-white`. NowPlayingOverlay: bỏ `bg-text-emphasis`, bỏ `text-near-black` khỏi cả 2 span để thừa kế màu từ button cha.
**Lesson / Warning:** Khi icon Material Symbols bị hardcode màu trực tiếp trên `<span>`, class màu trên `<button>` cha không có tác dụng. Phải xóa màu trên span để inheritance hoạt động đúng.

---
[2026-05-14] [FRONTEND / MOCK MODE] [DECISION]

**Problem:** Team cần test giao diện mà không cần backend chạy — mỗi lần demo phải khởi động đầy đủ stack (PostgreSQL, Redis, Kafka, MinIO...) rất tốn thời gian.
**Root cause:** Tất cả services giao tiếp qua HTTP thật, không có lớp mock nào.
**Fix / Decision:** Dùng MSW (Mock Service Worker) browser mode. Tạo `src/mocks/handlers.ts` với 18 handlers phủ toàn bộ API endpoints. Bật/tắt qua `VITE_MOCK=true/false` trong `.env.development`. Khi bật: mọi axios request bị intercept trước khi ra network. `onUnhandledRequest: 'bypass'` — request không mock sẽ đi qua bình thường.
**Lesson / Warning:** MSW browser mode cần file `public/mockServiceWorker.js` (generate bằng `npx msw init public/`). File này phải được serve từ cùng origin. Không commit `.env` thật — chỉ `.env.development` với `VITE_MOCK=true` là safe vì không có secret.

---
[2026-05-14] [FRONTEND / CREATOR DASHBOARD] [DECISION]

**Problem:** `toLocaleString('vi-VN')` dùng `.` làm thousands separator (ví dụ: 8420 → "8.420"), nhưng test dùng regex `/8.420|8,420/` — dấu `.` trong regex match bất kỳ ký tự nào, gây false positive. Ngoài ra `text-transform: uppercase` trong Tailwind chỉ là CSS visual — `getByText('LƯỢT NGHE ĐỘC NHẤT')` sẽ fail vì DOM text vẫn là "Lượt nghe độc nhất".
**Root cause:** Tailwind utility classes thay đổi visual rendering nhưng không thay đổi DOM text content. `getByText` đọc actual DOM text.
**Fix / Decision:** (1) Dùng `getByText('8.420')` thay regex. (2) Dùng label text đúng case ("Lượt nghe độc nhất" không phải "LƯỢT NGHE ĐỘC NHẤT"). (3) Khi cùng text xuất hiện nhiều lần (ví dụ "72%" ở KPI card và donut chart), dùng `getAllByText(...).length >= 1` thay vì `getByText`.
**Lesson / Warning:** Rule chung: khi test text bị style bởi Tailwind (uppercase, lowercase, capitalize) — luôn assert bằng original text case, không phải CSS-transformed. Khi text có thể xuất hiện nhiều nơi trong cùng page layout (vì component dùng trong nhiều section) — dùng `getAllByText`.

---
[2026-05-13] [FRONTEND / PHASE 4] [DECISION]

**Problem:** Sidebar cần hiển thị tên user thật và notification dot, nhưng data này không có trong authStore.
**Root cause:** authStore chỉ lưu accessToken, userId, role — không có displayName hay unreadCount.
**Fix / Decision:** Sidebar tự fetch `/users/me` và `/notifications/unread` trong useEffect khi accessToken có. Không tạo thêm Zustand store — keep isolated per-component. Tests dùng MSW để mock cả 2 endpoints. Tất cả pages render Sidebar qua AppShell phải mock 2 endpoints này.
**Lesson / Warning:** Mọi page test render AppShell cần mock: (1) `/api/v1/notifications/unread`, (2) `/api/v1/users/me`. Nếu thiếu và `onUnhandledRequest: 'error'`, test sẽ throw.

---
[2026-05-13] [FRONTEND / PHASE 4] [DECISION]

**Problem:** API `/recommendations` trả 1 flat list, nhưng Stitch design yêu cầu 3 sections riêng biệt.
**Root cause:** Backend Rule Engine gắn `reason.type` (CONTEXT | TRENDING | PREFERENCE) vào mỗi item.
**Fix / Decision:** `useRecommendations` hook split items theo `reason.type` thành 3 groups: contextItems, trendingItems, preferenceItems. Mỗi group render vào 1 section riêng trong HomePage. Empty groups không render section (tránh empty heading).
**Lesson / Warning:** mockItems trong test phải có đủ 3 reason types để test 3 section headings.

---
[2026-05-13] [MUSIC SERVICE / STREAMING SERVICE / INFRA] [DECISION]

**Problem:** Dự án cần storage backend thực tế để lưu file .mp3 và ảnh bìa, không muốn phụ thuộc vào AWS credentials hay duy trì MinIO local trong production/demo.
**Root cause:** MinIO chỉ phù hợp local dev; AWS S3 yêu cầu credit card; nhóm muốn dùng free tier GCS + Cloudinary cho demo.
**Fix / Decision:** Chuyển storage sang 2 provider:
  - Google Cloud Storage (GCS): lưu file audio .mp3. Authen qua Service Account Key JSON (`GOOGLE_APPLICATION_CREDENTIALS`). Pre-signed URL vẫn 900s.
  - Cloudinary: lưu avatar user + ảnh bìa album/playlist. SDK upload qua `CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET`.
  File key JSON phải đặt tại `infra/secrets/google-cloud-key.json` (đã có trong `.gitignore`).
**Lesson / Warning:** `GOOGLE_APPLICATION_CREDENTIALS` là biến đặc biệt — Google SDK tự động đọc, không cần inject thủ công vào constructor. KHÔNG commit file .json lên Git.

---
[2026-05-12] [USER SERVICE / FRONTEND] [DECISION]

**Problem:** FE Onboarding plan cần truyền `artists` lên `POST /users/me/preferences` và cần cờ `hasCompletedOnboarding` sau khi login, nhưng BE hiện tại dùng `PreferredLanguages` và không trả về cờ nào.
**Root cause:** API implementation cũ của BE không khớp với UI/UX plan mới cho Onboarding (Spotify wizard).
**Fix / Decision:** Cập nhật BE `UserService`: đổi `PreferredLanguages` thành `PreferredArtists` trong DTOs/Entities, tạo EF Core Migration `UpdatePreferencesArtists`. Sửa `UserProfileDto` để trả về `hasCompletedOnboarding` (logic: `prefs != null && prefs.PreferredGenres.Count >= 3`). FE đọc cờ này ở `authService.login` và redirect sang `/onboarding` nếu false.
**Lesson / Warning:** Khi Frontend UI/UX thay đổi, nếu API không khớp, cần chủ động update DTO/Entities phía Backend để keep mọi thứ in-sync thay vì dùng workaround trên FE.

---
---
[2026-05-12] [FRONTEND / TAILWIND] [BUG]

**Problem:** Giao diện Onboarding bị ép hẹp ngang nghiêm trọng ở các class như max-w-sm, max-w-lg trong quá trình hoàn thiện Step 1 và Step 3 (vỡ tương tự như màn hình Account Locked). Ngoài ra, Step 1 và Step 2 cần 2 thiết kế Stepper và Bottom bar khác biệt nhau nhưng đang bị gộp chung.
**Root cause:** 
1. Tương tự lỗi Account Locked, khi Tailwind v4 ánh xạ max-w-[size] sang scale spacing, các custom tokens như sm: 8px, lg: 24px trong 	ailwind.config.ts làm hỏng hoàn toàn độ rộng tối đa chuẩn. max-w-sm thành 8px thay vì 384px.
2. Code cũ gộp chung render layout cho Step 1 và 2, bỏ qua khác biệt nhỏ lẻ trong bản thiết kế HTML gốc.
**Fix / Decision:** 
1. Thay toàn bộ class kích thước max-w dùng chữ sang hardcoded arbitrary values: max-w-sm -> max-w-[384px], max-w-lg -> max-w-[512px].
2. Tách Component OnboardingPage thành 3 luồng return layout riêng biệt 100% thay vì tái sử dụng wrapper chung, để đảm bảo khớp thiết kế từng Pixel.
**Lesson / Warning:** Khi thực thi Design System có nhiều page flow (như Onboarding), không vội vã tạo wrapper chung nếu thiết kế các bước có khác biệt cấu trúc cơ bản (như Stepper dot vs Stepper line). Vẫn quy tắc Tailwind v4 cũ: cảnh giác cao độ với max-w-sm/md/lg nếu đã override spacing.
---
---
[2026-05-12] [FRONTEND / TAILWIND] [BUG]

**Problem:** Nút submit có màu đen chìm vào nền thay vì màu xanh Spotify, mặc dù DOM chứa class g-spotify-green. Checkbox thì vẫn lên màu xanh (checked:bg-spotify-green).
**Root cause:** Tailwind v4 (với Vite) có thể lỗi trong việc ánh xạ các custom colors từ 	ailwind.config.ts sang các utility class nhất định nếu thứ tự cascade CSS hoặc override bị conflict.
**Fix / Decision:** Thêm toàn bộ custom colors vào @theme bên trong index.css để đảm bảo tương thích chuẩn v4. Ngoài ra, thêm các utility rules cứng (.bg-spotify-green { background-color: #1ed760 !important; }) vào index.css cho các màu quan trọng nhất.
**Lesson / Warning:** Khi nâng cấp hoặc setup Tailwind v4 với config cũ (v3), viết fallback utilities cứng với !important là giải pháp an toàn cho brand colors.

---
[2026-05-12] [FRONTEND / TAILWIND] [BUG]

**Problem:** Giao diện Form Đăng nhập bị khóa (Account Locked) hiển thị dọc, ép hẹp lại thành một dải cực nhỏ (~16px chiều ngang), chữ xếp chồng lên nhau từng ký tự một.
**Root cause:** 	ailwind.config.ts định nghĩa override bộ spacing (cụ thể: md: '16px'). Form Account Locked lại dùng class max-w-md. Trong Tailwind v4, việc ghi đè spacing có thể làm hỏng các built-in scale của max-width, khiến max-w-md bị ánh xạ thành 16px.
**Fix / Decision:** Đổi class max-w-md thành class kích thước tĩnh max-w-[480px].
**Lesson / Warning:** Khi custom Tailwind themes (đặc biệt ghi đè toàn bộ spacing), tránh dùng các class sizing chuẩn có suffix trùng tên (như sm, md, lg) cho max-w-* hoặc dùng Arbitrary Values để an toàn.
---
[2026-05-12] [FRONTEND] [DECISION]

**Problem:** Chuyển đổi Auth Screens sang thiết kế mới nhưng giữ nguyên tính độc lập với backend cho màn hình đăng ký.
**Root cause:** Phase 2 yêu cầu áp dụng Tailwind tokens mới và thêm chức năng Đăng ký, nhưng endpoint `/api/v1/auth/register` chỉ có tạm cho demo, không ở document chính thức.
**Fix / Decision:** Tách riêng `authService.ts`, `useAuth`, `LoginForm`, `RegisterForm`. Endpoint register được mock timeout 1s cho an toàn tại `authService.register`. Giữ các constraints token.
**Lesson / Warning:** Tách API service, React hook và component UI giúp mock API dễ dàng hơn mà không ảnh hưởng luồng render.

---
[2026-05-12] [FRONTEND] [BUG]

**Problem:** `notificationService.fetchUnreadNotifications` trả sai items — `res.data.data` là `{ items: [...], hasMore: bool }` nhưng code cũ gán `items: res.data.data ?? []` (treat cả object làm array).
**Root cause:** Phase 0 refactor service signature nhưng không đọc đúng nested response shape từ API contract (`data: { items, hasMore }`).
**Fix / Decision:** Đổi generic type sang `ApiResponse<{ items: Notification[]; hasMore: boolean }>`, đọc `payload.items` và `payload.hasMore`. Cập nhật test mock để dùng `notificationId`/`message` (domain type) thay vì `id`/`title` (old type).
**Lesson / Warning:** Khi service return type là `Notification[]` nhưng API `data` field là `{ items: Notification[] }`, phải dùng generic đúng shape. Luôn verify response shape trong service unit tests trước khi rely vào integration.

---
[2026-05-12] [FRONTEND] [BUG]

**Problem:** `getTimeContext()` tests fail vì expect `'none'` nhưng Phase 0 đã đổi return values sang `'night' | 'morning' | 'afternoon' | 'evening'` (xóa `'none'`).
**Root cause:** Tests viết trước Phase 0 migration, chưa cập nhật theo `TimeContext` type mới trong `domain.ts`.
**Fix / Decision:** Update test assertions: `'none'` (hour 0–5, 22–23) → `'night'`, `'none'` (hour 12–17) → `'afternoon'`.
**Lesson / Warning:** Khi đổi enum/union type trong `domain.ts`, phải grep tất cả test files dùng giá trị cũ và update cùng lúc.

---
[2026-05-12] [FRONTEND] [DECISION]

**Task:** Phase 0 — Tailwind CSS setup + service layer migration
**Decisions:**
- Dùng `@tailwindcss/vite` plugin (không phải PostCSS) — phù hợp với Vite 8 + Tailwind v4.
- Google Fonts `@import` phải đứng TRƯỚC `@import "tailwindcss"` trong index.css — Tailwind v4 báo warning nếu ngược lại.
- `src/api/*` files (client.ts, recommendationApi.ts, analyticsApi.ts, notificationApi.ts, searchApi.ts) giữ nguyên nhưng không dùng nữa — các service mới ở `src/services/*` thay thế hoàn toàn.
- Domain types thống nhất ở `src/types/domain.ts` — tránh duplicate type giữa service files. `CreatorDashboardPage` dùng `AnalyticsStats` shape từ API contract (`dailyListeners[]`, `uniqueUsers`) thay vì `SongStats` cũ (`totalPlays`, `totalSkips`).
- `NotificationBell` dùng `notificationId` (domain type) thay vì `id` (old type) — cần update key prop và markRead call.
**Lesson:** Khi migrate type, phải trace toàn bộ JSX dùng old property names, không chỉ import line. Hook IDE diagnostics giúp catch nhanh.
---

[2026-05-12] [FRONTEND] [DECISION]

**Problem:** AppShell cần render `<AudioPlayer>` trong bottom bar, nhưng tests hiện tại tìm `aria-label="Đóng player"` ở trong pages (HomePage, SearchPage). Nếu chuyển close button sang AppShell, tests vẫn cần tìm được nó.
**Root cause:** Tests render `<HomePage />` wrapped với `MemoryRouter` — AppShell được render bên trong page, nên toàn bộ DOM của AppShell (bao gồm bottom bar + close button) vẫn nằm trong render tree của test.
**Fix / Decision:** Close button giữ nguyên `aria-label="Đóng player"` trong AppShell — tests vẫn tìm được vì AppShell render cùng cây với page. Không cần thay đổi test structure cho Phase 2.
**Lesson / Warning:** Khi pages dùng AppShell wrapper, test queries (getByLabelText, getByRole) sẽ tìm trong toàn bộ DOM bao gồm AppShell — đây là behavior mong muốn.
---

---
[2026-05-12] [FRONTEND / TESTING] [BUG]

**Problem:** Tests của `HomePage` và `SearchPage` fail với lỗi `intercepted a request without a matching request handler: GET /api/v1/notifications/unread`.
**Root cause:** Khi bọc các trang này bằng `<AppShell>`, `<NotificationBell />` bên trong `AppShell` sẽ được render và tự động gọi API fetch notifications. MSW server trong test các trang này chưa mock endpoint đó.
**Fix / Decision:** Thêm `notificationsHandler` vào `setupServer` trong file test của `HomePage`, `SearchPage`.
**Lesson / Warning:** Khi wrap components/pages bằng một global layout có chứa side effects (ví dụ fetch API trong header/bell), phải đảm bảo mock luôn các endpoints đó trong unit test của page.

---
[2026-05-12] [FRONTEND / TESTING] [BUG]

**Problem:** Test `closes AudioPlayer when close button is clicked` fail. Test cố gắng check nút đóng player biến mất nhưng query lại match các state cũ (leaked state) làm test bị timeout hoặc pass lộn xộn.
**Root cause:** `usePlayerStore` (Zustand) là global state. Nếu test A nhấn play bài hát, `currentSong` được set. Khi chạy sang test B, `currentSong` vẫn còn giữ giá trị cũ khiến `<AppShell>` render `<AudioPlayer>` ngay từ đầu, phá vỡ logic test. Đồng thời, hành động click nút Đóng sẽ clear state nhưng việc render lại DOM có thể cần chờ đợi.
**Fix / Decision:** Bổ sung `usePlayerStore.getState().clearSong();` vào khối `afterEach` trong file `src/tests/setup.ts` để reset global store cho mọi test. Chuyển assertion thành `await waitFor(() => expect(screen.queryByLabelText('Đóng player')).not.toBeInTheDocument());`.
**Lesson / Warning:** LUÔN LUÔN reset Zustand stores (`useAuthStore`, `usePlayerStore`) trong `afterEach` để chặn rò rỉ state giữa các test. Khi có các cập nhật trạng thái làm mất DOM elements (như đóng player), nên wrap assertion bằng `waitFor`.
---

**Khi nào ghi:**
---
[2026-05-12] [FRONTEND / RECOMMENDATION API] [BUG]

**Problem:** `streaming/undefined/url` 404 + React key warning "Each child in a list should have a unique key prop" trong HomePage.
**Root cause:** Python FastAPI (Recommendation Service) trả `song_id` (snake_case) nhưng TypeScript type `RecommendationItem` expect `songId` (camelCase). `item.songId === undefined` → key là undefined, AudioPlayer gọi `/api/v1/streaming/undefined/url`.
**Fix / Decision:** Map response tại API boundary trong `recommendationApi.ts`: `song_id → songId`, `reason.text → explainText`. Cập nhật mock data trong `HomePage.test.tsx` sang Python format (`song_id`, `reason: { type, text }`).
**Lesson / Warning:** Python FastAPI dùng snake_case theo convention. Bất kỳ API nào từ Python service đều cần map sang camelCase ở frontend. Không assume camelCase từ Python endpoints.
---

---
[2026-05-12] [NOTIFICATION SERVICE] [BUG]

**Problem:** notification-service liên tục crash, API Gateway trả 502 cho `/api/v1/notifications/unread`.
**Root cause:** 4 bugs xếp chồng:
  1. Kafka topics `New_Release` và `Notification_Sent` chưa được tạo → `ConsumeException: Unknown topic or partition`
  2. Catch block trong `KafkaConsumerBackgroundService` không có delay → tight loop → escalate fatal error
  3. `consumer.Consume(ct)` là synchronous blocking call, không có `await` trước nó → block toàn bộ host startup → Kestrel không start (dù container "Up")
  4. `MongoDB__ConnectionString` thiếu trong `docker-compose.yml` + duplicate `/health` route (cả MapGet lẫn HealthController)
**Fix / Decision:**
  - Tạo 5 Kafka topics bằng `kafka-topics --create --if-not-exists`
  - Thêm `await Task.Delay(5s, ct)` trong catch block
  - Wrap blocking call: `await Task.Run(() => consumer.Consume(ct), ct)`
  - Thêm `MongoDB__ConnectionString=${MONGO_URI}` + `mongodb: condition: service_healthy` vào docker-compose
  - Xóa `app.MapGet("/health", ...)` trùng với `HealthController`
  - Thêm `BackgroundServiceExceptionBehavior.Ignore` trong Program.cs làm safety net
**Lesson / Warning:** Trong .NET 8, `BackgroundService.ExecuteAsync` nếu throw → host STOP (StopHost default). Bất kỳ blocking I/O nào trong ExecuteAsync PHẢI được wrap bằng `await Task.Run()` để không block startup thread. Confluent.Kafka `Consume()` là blocking — LUÔN dùng `await Task.Run(() => consumer.Consume(ct), ct)`.
---

- Bug mất > 30 phút mới tìm ra nguyên nhân
- Quyết định kỹ thuật quan trọng (chọn A thay vì B, và tại sao)
- Workaround/hack đang dùng tạm — để người khác không "fix" nó thành broken
- Gotcha với infrastructure local (Docker, Kafka, Redis, MinIO)

**Format mỗi entry:**
```
---
[YYYY-MM-DD] [SERVICE/LAYER] [LOẠI: BUG | DECISION | BLOCKER | NOTE]

**Problem:** Mô tả vấn đề — triệu chứng quan sát được
**Root cause:** Tại sao xảy ra
**Fix / Decision:** Cách giải quyết
**Lesson / Warning:** Điều cần nhớ / tránh lặp lại
---
```

---

## Entries

---

[2026-05-10] [ALL C# SERVICES / PROMETHEUS] [BUG]

**Problem:** `UseHttpMetrics()` và `MapMetrics()` không được nhận dạng sau khi thêm `prometheus-net.AspNetCore` vào .csproj qua Edit tool.
**Root cause:** Hai vấn đề song song: (1) Package chưa được restore — `dotnet restore` báo "all up-to-date" nhưng thực ra chưa download. (2) Extension methods nằm trong `Prometheus` namespace nhưng top-level Program.cs không có `using Prometheus;` — implicit usings không tự include.
**Fix / Decision:** Chạy `dotnet add package prometheus-net.AspNetCore` (force restore) + thêm `using Prometheus;` vào đầu tất cả 9 Program.cs. Sau đó `dotnet restore SmartMusic.sln` để sync toàn bộ solution.
**Lesson / Warning:** Khi thêm package bằng Edit tool vào .csproj: phải chạy `dotnet restore` hoặc `dotnet add package` để download. Prometheus extension methods LUÔN cần `using Prometheus;` trong file dùng chúng — không nằm trong implicit usings.

---

[2026-05-10] [AUTH SERVICE] [DECISION]

**Problem:** Register endpoint cần tạo user nhưng Auth Service không có database user riêng — user data nằm ở User Service.
**Root cause:** Architecture đúng: User Service là source of truth cho user data. Auth Service chỉ quản lý tokens.
**Fix / Decision:** Thêm `CreateUser` RPC vào `user.proto` — Auth Service gọi User Service qua cùng gRPC channel đã có. User Service hash BCrypt, tạo user trong PostgreSQL. Auth Service trả 201 với `{ userId, email, displayName, role }`. Không trả tokens — user phải login riêng.
**Lesson / Warning:** Register sử dụng gRPC channel Auth→User đã có. `ALREADY_EXISTS` status code từ gRPC được map sang `VALIDATION_ERROR` (400) vì `USER_ALREADY_EXISTS` chưa có trong error catalogue — có TODO comment trong code.

---

[2026-05-10] [OBSERVABILITY / ALL SERVICES] [DECISION]

**Problem:** Prometheus port strategy — expose `/metrics` trên port riêng (9091) hay cùng port với HTTP API?
**Root cause:** Plan nói port 9091 nhưng docker-compose không có port mapping cho 9091 trên bất kỳ service nào.
**Fix / Decision:** Expose `/metrics` trên cùng HTTP port (port 80 trong container) dùng `app.MapMetrics()` từ `prometheus-net.AspNetCore`. Prometheus scrape `http://service:80/metrics` — không cần port mapping riêng. Đơn giản hơn, không cần config Kestrel thêm.
**Lesson / Warning:** `UseHttpMetrics()` phải đặt sau `UseRouting()` và trước `UseAuthentication()` — nếu đặt sau auth thì request bị reject trước khi metrics ghi nhận. Đặt trước `MapControllers()` trong pipeline.

---

[2026-05-10] [RECOMMENDATION SERVICE / PYTHON] [NOTE]

**Problem:** IDE Pylance báo lỗi `Cannot find module prometheus_fastapi_instrumentator` ngay sau khi thêm import.
**Root cause:** Package chưa install trong `.venv` — chỉ mới thêm vào `requirements.txt`.
**Fix / Decision:** Chạy `.venv/Scripts/pip install prometheus-fastapi-instrumentator>=6.1.0` để cài vào .venv local. Trong Docker build, `pip install -r requirements.txt` sẽ cài tự động.
**Lesson / Warning:** Pattern giống warning Pylance về các package khác (đã ghi trong CURRENT_STATE Known Issues). Không coi Pylance error là blocker nếu package chỉ chưa install local.

---

[2026-05-07] [LISTENING PARTY SERVICE / SIGNALR] [DECISION]

**Problem:** Hub cần `GetRoomId()` và `GetUserId()` từ HttpContext/ClaimsPrincipal — khó mock trong unit tests nếu đọc trực tiếp từ `Context.GetHttpContext().Request.Query` và `Context.UserIdentifier`.
**Root cause:** `Context.GetHttpContext()` là extension method trên `HubCallerContext`; không thể setup trực tiếp trên mock vì nó đọc từ `IFeatureCollection`. Mock toàn bộ HttpContext + Request + QueryString rất verbose và brittle.
**Fix / Decision:** Tách thành 2 `protected virtual` methods: `GetRoomId()` và `GetUserId()`. Unit tests dùng `TestablePartyHub` kế thừa Hub và override 2 methods này → inject roomId/userId trực tiếp mà không cần HttpContext.
**Lesson / Warning:** Mọi lần Hub cần đọc context data (query string, header, claim) — tách ra virtual method ngay từ đầu. Áp dụng cho tất cả Hub implementations về sau.

---

[2026-05-07] [LISTENING PARTY SERVICE / SIGNALR] [BUG]

**Problem:** Unit test `Mock<IClientProxy>` cho `Clients.Caller` bị lỗi `CS1503: cannot convert from IClientProxy to ISingleClientProxy`.
**Root cause:** Trong ASP.NET Core SignalR 8+, `IHubCallerClients.Caller` trả về `ISingleClientProxy` (không phải `IClientProxy`). `ISingleClientProxy` là interface con của `IClientProxy` nhưng không tương thích assignment ngược.
**Fix / Decision:** Mock `Clients.Caller` bằng `Mock<ISingleClientProxy>`; mock `Clients.Group(...)` và `Clients.OthersInGroup(...)` bằng `Mock<IClientProxy>` (vẫn trả `IClientProxy`).
**Lesson / Warning:** Khi mock `IHubCallerClients` trong SignalR 8+ — luôn dùng `Mock<ISingleClientProxy>` cho `.Caller`, `Mock<IClientProxy>` cho `.Group()`, `.All`, `.OthersInGroup()`.

---

[2026-05-07] [FRONTEND / TESTING] [BUG]

**Problem:** Test "shows loading skeleton while fetching" không catch được transient `loading=true` state khi dùng MSW + fake timers. Dù `vi.advanceTimersByTime(350)` kích hoạt debounce, MSW resolve fetch ngay trong cùng một `act()` microtask flush — không có window nào để assert `loading=true`.
**Root cause:** MSW xử lý request synchronously trong `act()` scope, nên state đi qua `loading=true → false` mà không flush DOM giữa chừng. Không có cách intercept transient state mà không dùng manual Promise resolution.
**Fix / Decision:** Đổi test để verify behavior thực tế: kết quả KHÔNG xuất hiện trước khi debounce fire (trước 300ms), rồi xuất hiện sau khi fire. Đây là hành vi người dùng quan tâm, không phải loading flag nội bộ.
**Lesson / Warning:** Không cố test transient loading states với MSW trong vitest — quá brittle. Test behavior: "trước → sau", không test "đang trong quá trình". Áp dụng cho mọi component có debounce + async fetch.

---

[2026-05-07] [FRONTEND / TESTING] [DECISION]

**Problem:** Package.json ban đầu không có test dependencies — cần thiết lập toàn bộ test stack lần đầu.
**Root cause:** Scaffold tuần trước chỉ có Vite + React, chưa cấu hình vitest/testing-library/msw.
**Fix / Decision:** Cài vitest + @testing-library/react + msw + jsdom. Dùng `jsdom` thay vì `happy-dom` (SKILL.md đề xuất happy-dom nhưng jsdom tương thích tốt hơn với React 19 + @testing-library). MSW v2 dùng `http`/`HttpResponse` API (không phải `rest` từ v1). Test script: `vitest run` (CI) + `vitest` (watch).
**Lesson / Warning:** Khi viết test cho component dùng Zustand store, PHẢI reset store giữa các test: `useAuthStore.setState({...})` trong `afterEach`. Không reset → state leak giữa tests → flaky results.

---

[2026-05-07] [FRONTEND / TESTING] [BUG]

**Problem:** Test "does NOT render explainText badge" dùng `document.querySelectorAll('[style*="1db95422"]')` → trả về 0 phần tử trong jsdom, dù component render đúng.
**Root cause:** jsdom xử lý inline style khác với browser — shorthand hex màu có thể được normalize hoặc không match substring. Query bằng style string literal không reliable trong test environment.
**Fix / Decision:** Thêm `data-testid="explain-badge"` vào span badge trong component, dùng `screen.getAllByTestId('explain-badge')` trong test.
**Lesson / Warning:** Không query DOM bằng style string (`[style*="..."]`) trong tests — dùng `data-testid`, `aria-label`, hoặc text content thay thế.

---

---

[2026-05-06] [FRONTEND / TYPES] [BUG]

**Problem:** `services/frontend/src/types/listening-party.ts` có nội dung sai — dùng các interface khác với contract trong `shared_contracts.md` Section 6 (ví dụ `PlayerAction` là union type thay vì interface, thiếu `SyncState`, `MemberLeave`, etc.).
**Root cause:** File được tạo từ scaffold với type definitions tạm, chưa sync với contract thật.
**Fix / Decision:** Overwrite hoàn toàn với nội dung từ `shared_contracts.md` Section 6.
**Lesson / Warning:** Trước khi implement Track A (frontend hooks), kiểm tra `types/listening-party.ts` có match `shared_contracts.md` Section 6 không.

---

[2026-05-06] [LISTENING PARTY SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Integration tests fail với `RedisConnectionException: NOAUTH` — `ConnectionMultiplexer.Connect()` được gọi synchronously ngay trong `AddInfrastructure()` khi `WebApplicationFactory` khởi tạo app. `ConfigureWebHost.ConfigureServices` chạy sau nên không kịp replace trước khi connection thực sự được tạo.
**Root cause:** `services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(str))` — gọi `Connect()` inline trong lambda argument (eager evaluation), không phải lazy factory.
**Fix / Decision:** Đổi sang lazy factory: `services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(str))`. Với factory pattern, connection chỉ tạo khi `IConnectionMultiplexer` được resolve lần đầu (tức khi request thật đến), không phải khi DI setup. `WebApplicationFactory` có thể `RemoveAll<IConnectionMultiplexer>()` và thay mock trước khi request đầu tiên.
**Lesson / Warning:** Khi đăng ký `IConnectionMultiplexer` (Redis), `IMongoClient`, hoặc bất kỳ connection singleton nào — LUÔN dùng factory lambda `_ => new ...()`, không gọi constructor/Connect inline. Pattern này áp dụng cho mọi service có connection singleton cần test với WebApplicationFactory.

---

**Problem:** Integration tests fail với `RedisConnectionException: NOAUTH` — `ConnectionMultiplexer.Connect()` được gọi synchronously ngay trong `AddInfrastructure()` khi `WebApplicationFactory` khởi tạo app. `ConfigureWebHost.ConfigureServices` chạy sau nên không kịp replace trước khi connection thực sự được tạo.
**Root cause:** `services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(str))` — gọi `Connect()` inline trong lambda argument (eager evaluation), không phải lazy factory.
**Fix / Decision:** Đổi sang lazy factory: `services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(str))`. Với factory pattern, connection chỉ tạo khi `IConnectionMultiplexer` được resolve lần đầu (tức khi request thật đến), không phải khi DI setup. `WebApplicationFactory` có thể `RemoveAll<IConnectionMultiplexer>()` và thay mock trước khi request đầu tiên.
**Lesson / Warning:** Khi đăng ký `IConnectionMultiplexer` (Redis), `IMongoClient`, hoặc bất kỳ connection singleton nào — LUÔN dùng factory lambda `_ => new ...()`, không gọi constructor/Connect inline. Pattern này áp dụng cho mọi service có connection singleton cần test với WebApplicationFactory.

---

---

[2026-05-06] [NOTIFICATION SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Integration test factory sử dụng `builder.UseEnvironment("Testing")` nhưng `IWebHostBuilder` không có extension này mà không có `using Microsoft.AspNetCore.Hosting`.
**Root cause:** `UseEnvironment` là extension method nằm trong `Microsoft.AspNetCore.Hosting` namespace — không được auto-imported bởi `ImplicitUsings` của test project.
**Fix / Decision:** Thêm `using Microsoft.AspNetCore.Hosting;` vào integration test file.
**Lesson / Warning:** Khi dùng `WebApplicationFactory.ConfigureWebHost`, luôn add `using Microsoft.AspNetCore.Hosting` nếu gọi bất kỳ method nào trên `IWebHostBuilder`.

---

[2026-05-06] [USER SERVICE / DOMAIN] [DECISION]

**Problem:** `follows` table tồn tại trong PostgreSQL schema (DATABASE_SCHEMA.md) nhưng chưa có EF Core mapping. Notification Service cần query followers qua User Service internal API.
**Root cause:** User Service chỉ map `users` và `user_preferences`. `follows` được dự kiến query bởi Notification Service nhưng chưa implement.
**Fix / Decision:** Thêm `Follow` domain model + `Follows` DbSet + EF Core mapping. Cần tạo migration `AddFollowsTable` trước khi deploy: `dotnet ef migrations add AddFollowsTable` từ UserService.Api project.
**Lesson / Warning:** Khi thêm DbSet mới vào DbContext đã có migration, PHẢI chạy `dotnet ef migrations add` ngay sau khi code. Migration files là code — commit cùng với source.

---

---

[2026-05-06] [ANALYTICS SERVICE / INFLUXDB] [BUG]

**Problem:** `using var writeApi = client.GetWriteApiAsync()` — compiler error CS1674: `WriteApiAsync` does not implement `IDisposable`.
**Root cause:** InfluxDB.Client v4.x `WriteApiAsync` là plain class, không implement `IDisposable`. Không cần dispose thủ công.
**Fix / Decision:** Bỏ `using` — gọi thẳng `var writeApi = client.GetWriteApiAsync()`.
**Lesson / Warning:** Trong InfluxDB.Client v4.x, chỉ `WriteApi` (synchronous) mới `IDisposable`. `WriteApiAsync` thì không.

---

[2026-05-06] [ANALYTICS SERVICE / INFLUXDB] [BUG]

**Problem:** `File` ambiguous giữa `InfluxDB.Client.Api.Domain.File` và `System.IO.File` trong `InfluxAnalyticsRepository.cs`.
**Root cause:** InfluxDB.Client package expose một type tên `File` trong namespace được auto-import.
**Fix / Decision:** Dùng fully-qualified `System.IO.File.AppendAllTextAsync(...)`.
**Lesson / Warning:** Khi dùng InfluxDB.Client, tránh dùng tên `File` bare — luôn qualify `System.IO.File`.

---

[2026-05-06] [ANALYTICS SERVICE / FLUX] [BUG]

**Problem:** Flux query với record literal `{count: 0}` bên trong `$"""` raw string → CS9006 interpolated raw string literal error.
**Root cause:** `$"""` với `{{` interpret double-braces là escaped `{`, nhưng Flux dùng `{` bare cho record syntax — conflict.
**Fix / Decision:** Đổi sang `$$"""` (double-dollar) — cho phép `{{expr}}` làm interpolation holes, còn `{` bare là literal.
**Lesson / Warning:** Khi Flux query có record literals `{key: val}`, dùng `$$"""` thay vì `$"""` để tránh brace conflict.

---

---

[2026-05-05] [SEARCH SERVICE / APPLICATION] [BUG]

**Problem:** `SearchService.SearchAsync` không catch exception khi `ISearchCache.GetAsync` throw — Redis failure làm crash request thay vì fallback.
**Root cause:** Try/catch chỉ bao `repository.SearchAsync`, không bao `cache.GetAsync`. Redis exception propagate ra ngoài.
**Fix / Decision:** Wrap `cache.GetAsync` trong try/catch riêng — Redis failure → log warning + treat as cache miss, không throw.
**Lesson / Warning:** Tất cả I/O operations (Redis, Elasticsearch, HTTP) phải có try/catch riêng. Fallback chain phải bền vững với mọi dependency failure.

---

[2026-05-05] [SEARCH SERVICE / CSPROJ] [BUG]

**Problem:** `SearchService.Application` không build được — `ILogger<>` not found dù dùng `Microsoft.Extensions.Logging`.
**Root cause:** Application project chưa có `Microsoft.Extensions.Logging.Abstractions` package reference. `ILogger<>` không phải transitive dependency của ASP.NET Core.
**Fix / Decision:** Thêm `Microsoft.Extensions.Logging.Abstractions 8.0.*` vào `SearchService.Application.csproj`.
**Lesson / Warning:** Khi Application layer inject `ILogger<T>`, phải explicit add `Microsoft.Extensions.Logging.Abstractions`. Không tự resolve từ web SDK project.

---

[2026-05-03] [USER SERVICE / EF CORE / INTEGRATION TESTS] [BUG]

**Problem:** `dotnet test` throws `InvalidOperationException: Relational-specific methods can only be used when the context is using a relational database provider` trong `DbInitializer.SeedAsync`.
**Root cause:** `TestWebApplicationFactory` override `DbContext` dùng `InMemoryDatabase`, nhưng `DbInitializer` gọi `await db.Database.MigrateAsync()` — method này chỉ chạy được với relational provider.
**Fix / Decision:** Thêm `if (db.Database.IsRelational())` check trước `MigrateAsync()`. Fallback dùng `EnsureCreatedAsync()` cho InMemory tests.
**Lesson / Warning:** Luôn check `IsRelational()` trong seed/initializer nếu project dùng InMemory database cho integration tests.

---

[2026-05-03] [USER SERVICE / EF CORE / MIGRATION] [BUG]

**Problem:** `dotnet ef database update` fails với `password authentication failed for user "smartmusic"` dù `.env` đã cấu hình.
**Root cause:** Native Windows Postgres (port 5432) intercept connection thay vì Docker container. Native postgres dùng username `postgres`, password `4L27hN04@`.
**Fix / Decision:** Cập nhật `appsettings.json` connection string: `Host=localhost;Port=5432;Database=user_db;Username=postgres;Password=4L27hN04@`.
**Lesson / Warning:** Cẩn thận port collision giữa Docker services và Windows native services. Khi migration fail với auth error, check xem đang connect vào postgres nào.

---

[2026-05-03] [ALL C# SERVICES] [BUG]

**Problem:** `dotnet build` thất bại sau scaffold — EF Core, MVC Testing, FluentAssertions, Moq đều resolve version 10.x.
**Root cause:** NuGet `Version="*"` lấy latest stable — tại thời điểm này là 10.x, không tương thích `net8.0`.
**Fix / Decision:** Pin cứng version: `EF Core 8.0.*`, `Mvc.Testing 8.0.*`, `FluentAssertions 6.12.*`, `Moq 4.20.*`, `Testcontainers 3.8.*`.
**Lesson / Warning:** KHÔNG dùng `Version="*"` cho bất kỳ package Microsoft.* nào. Khi thêm package mới, kiểm tra `<TargetFramework>` rồi chọn version major tương ứng.

---

[2026-05-03] [ALL C# SERVICES / DOCKER] [BUG]

**Problem:** Tất cả C# containers exit ngay sau start — log: `Failed to bind to address http://[::]:80`.
**Root cause:** .NET 8 đổi default HTTP port từ 80 → 8080. Container lắng nghe 8080 nhưng docker-compose expose 80.
**Fix / Decision:** Thêm `ASPNETCORE_HTTP_PORTS=80` vào environment của mỗi C# service trong docker-compose.
**Lesson / Warning:** Áp dụng cho tất cả C# service mới. Nếu thấy container exit code 1 ngay sau start mà không có error rõ → check port binding trước.

---

[2026-05-03] [API GATEWAY / YARP] [BUG]

**Problem:** api-gateway container crash với `InvalidOperationException` khi start — YARP không tìm thấy config `ReverseProxy`.
**Root cause:** YARP bắt buộc có section `ReverseProxy` trong `appsettings.json` khi `LoadFromConfig(...)` được gọi, dù chưa có route thật.
**Fix / Decision:** Thêm placeholder vào `appsettings.json`: `"ReverseProxy": { "Routes": {}, "Clusters": {} }`.
**Lesson / Warning:** Khi implement YARP routes, update trực tiếp vào object đó — không xóa placeholder vì YARP throw nếu section missing.

---

[2026-05-03] [INFRA / DOCKER-COMPOSE] [BUG]

**Problem:** `docker-compose up --build` báo `unable to prepare context: path not found` cho tất cả C# services.
**Root cause:** `docker-compose.yml` nằm trong `infra/`, build context `./services/X` resolve từ `infra/` nên không tìm thấy.
**Fix / Decision:** Đổi tất cả build contexts sang `../services/X` (relative từ `infra/`).
**Lesson / Warning:** Khi thêm service mới vào docker-compose, luôn dùng `../services/<tên-service>` làm context.

---

[2026-05-04] [RECOMMENDATION SERVICE / KAFKA] [NOTE]

**Problem:** `Song_Played` consumer nhận duplicate events sau khi restart container — cùng event được process 2 lần, làm tăng sai preference weight.
**Root cause:** Kafka consumer group offset chưa commit trước khi container bị kill. Khi restart, consumer đọc lại từ offset chưa commit.
**Fix / Decision:** Idempotency dedup via Redis SET NX, key `rec:idempotency:{event_id}`, TTL 24h. Event đã có key → skip.
**Lesson / Warning:** KHÔNG tắt idempotency check dù "chỉ để test local". Áp dụng cho tất cả 5 Kafka topics. Chạy `infra/verify-infra.sh` sau mỗi lần reset infrastructure.

---

[2026-05-04] [STREAMING SERVICE / S3] [DECISION]

**Problem:** Nên generate pre-signed URL ở Streaming Service hay API Gateway?
**Root cause:** Kiến trúc chưa rõ ràng về ai là owner của S3 access logic.
**Fix / Decision:** Pre-signed URL chỉ được generate ở Streaming Service. API Gateway không có business logic; expiry 900s là business rule của Streaming.
**Lesson / Warning:** Nếu sau này thêm CDN signed URL (CloudFront), logic vẫn ở Streaming Service — chỉ thay signing method.

---

[2026-05-04] [AUTH SERVICE / USER SERVICE / GRPC] [DECISION]

**Problem:** Auth Service cần verify password nhưng `password_hash` nằm ở `user_db` (User Service). Auth Service không được connect trực tiếp `user_db`.
**Root cause:** `user.proto` ban đầu chỉ có `GetUserProfile(user_id)`, không có cơ chế verify credentials.
**Fix / Decision:** Thêm RPC `VerifyCredentials(username, password)` vào `user.proto`. Auth Service gọi qua gRPC → User Service verify bcrypt → trả về `user_id` + `role` → Auth Service mới cấp JWT.
**Lesson / Warning:** Giữ nguyên Data Boundary: User Service làm chủ Identity/Credentials, Auth Service chuyên Token Lifecycle.

---

[2026-05-05] [USER SERVICE / MIGRATIONS] [BUG]

**Problem:** User service migrations không tồn tại trong repo — Docker build không có migration C# files, `MigrateAsync()` chạy nhưng không có gì apply, bảng `users` không được tạo.
**Root cause:** Migration files chưa bao giờ được `git add` và commit sau khi `dotnet ef migrations add`.
**Fix / Decision:** Chạy lại `dotnet ef migrations add InitialCreate`, git add `UserService.Infrastructure/Migrations/`, commit ngay.
**Lesson / Warning:** Sau mỗi lần tạo migration, PHẢI `git add services/*/src/*/Migrations/` và commit ngay. Migration files là code, không phải artifacts.

---

[2026-05-05] [ALL SERVICES / POSTGRESQL] [DECISION]

**Problem:** Docker postgres và native Windows postgres chạy song song gây nhầm lẫn — migrations apply vào postgres sai.
**Root cause:** `dotnet ef database update` chạy từ Windows host connect native postgres (`localhost:5432`), nhưng containers connect Docker postgres (khác credentials).
**Fix / Decision:** Dùng native postgres (`postgres/4L27hN04@`) cho tất cả migrations và integration tests. Services trong Docker connect qua `host.docker.internal:5432`.
**Lesson / Warning:** Khi chạy `dotnet ef database update`, phải rõ đang apply lên postgres nào. Kiểm tra connection string trong `appsettings.json` trước.

---

[2026-05-05] [ALL DOWNSTREAM SERVICES] [DECISION]

**Problem:** Downstream services (music, streaming, recommendation...) dùng `[Authorize]` với JWT Bearer — fail vì API Gateway đã remove Authorization header trước khi forward.
**Root cause:** Trong API Gateway pattern, chỉ Gateway validate JWT. Downstream nhận `X-User-Id` và `X-User-Role` headers do Gateway inject.
**Fix / Decision:** Tất cả downstream services dùng `GatewayAuthHandler` — trust `X-User-Id`/`X-User-Role` headers, không re-validate JWT. Pattern này áp dụng cho mọi service implement sau: music, streaming, analytics, notification, search, listening-party.
**Lesson / Warning:** KHÔNG thêm JWT Bearer vào downstream services. Không cần `JWT_SECRET` trong env của downstream.

---

[2026-05-05] [USER SERVICE / GRPC] [BUG]

**Problem:** gRPC call từ auth-service đến user-service fail với `HTTP_1_1_REQUIRED`.
**Root cause:** Kestrel `HttpProtocols.Http1AndHttp2` không support h2c (HTTP/2 cleartext) trong .NET 8. Chỉ support HTTP/2 qua TLS (ALPN).
**Fix / Decision:** Tách port: port 80 dùng `Http1` (REST), port 5300 dùng `Http2` (gRPC h2c). Docker-compose expose cả hai. Auth-service gọi `http://user-service:5300`.
**Lesson / Warning:** Pattern này áp dụng cho MỌI service có gRPC server: REST port 80, gRPC port 5300. PHẢI dùng `Http2` (không phải `Http1AndHttp2`) cho gRPC port.

---

[2026-05-05] [USER SERVICE / EF CORE] [BUG]

**Problem:** Docker build fail với `FileNotFoundException: Microsoft.EntityFrameworkCore.Relational, Version=8.0.26.0`.
**Root cause:** `UserService.Api.csproj` pin `EF Core Design Version="8.0.0"` (exact) trong khi Infrastructure dùng `8.0.*` → resolve 8.0.26. Version mismatch giữa Design và Relational DLL.
**Fix / Decision:** Đổi thành `Version="8.0.*"` để cả hai projects resolve cùng version.
**Lesson / Warning:** KHÔNG pin exact version `8.0.0` cho EF Core packages. Dùng `8.0.*` cho tất cả. Build warning về conflict thường báo hiệu runtime failure.

---

[2026-05-05] [API GATEWAY / JWT] [DECISION]

**Problem:** Plan ghi Redis blacklist key là `rt:blacklist:{jti}`, nhưng Auth Service thực tế viết `token:blacklist:{jti}`.
**Root cause:** Spec trong plan không đồng bộ với implementation.
**Fix / Decision:** Gateway đọc `token:blacklist:{jti}` — theo code thực tế Auth Service, không theo plan.
**Lesson / Warning:** Khi implement service cần đọc Redis key của service khác, grep code thực tế (`StringSetAsync`, `KeyExpireAsync`) thay vì chỉ đọc plan.

---

[2026-05-05] [API GATEWAY / CIRCUIT BREAKER] [BUG]

**Problem:** Test `InvokeAsync_ClientDisconnects_DoesNotReturn503` fail — middleware throw `TaskCanceledException` khi client disconnect thay vì swallow.
**Root cause:** `catch (OperationCanceledException) when (cts.IsCancellationRequested && !originalAborted.IsCancellationRequested)` — khi client disconnect, cả hai token đều cancelled → condition false → exception không được catch.
**Fix / Decision:** Thêm catch block riêng: `catch (OperationCanceledException) when (originalAborted.IsCancellationRequested)` để swallow client disconnect. Circuit breaker catch đứng SAU.
**Lesson / Warning:** Thứ tự `catch when` rất quan trọng với linked CancellationTokenSource. Client-disconnect catch phải đứng trước circuit-breaker catch.

---

[2026-05-05] [MUSIC SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Integration tests dùng `EnsureCreatedAsync` + schema isolation — schema mới không được tạo vì database đã tồn tại.
**Root cause:** `EnsureCreatedAsync` là no-op khi database đã exist, bất kể schema state. Hai vấn đề: (1) Docker postgres intercept connection; (2) `EnsureCreated` không tạo schema mới trong existing DB.
**Fix / Decision:** Integration tests dùng native postgres (`postgres/4L27hN04@`, `music_db` đã tồn tại). Bỏ schema isolation — mỗi test seed data riêng và cleanup trong `DisposeAsync`. Thêm `Pooling=false` vào connection string.
**Lesson / Warning:** Không dùng `EnsureCreatedAsync` cho schema isolation với pre-existing database. Dùng cleanup-based isolation thay thế.

---

[2026-05-05] [MUSIC SERVICE / API RESPONSE] [DECISION]

**Problem:** `ApiResponse<T>` dùng `Error: string?`, thiếu `meta` fields đúng contract. `POST /music/songs` trả 200 thay vì 201.
**Fix / Decision:** Rewrite `ApiResponse<T>` với `ApiError(Code, Message)` record và `ApiMeta` class. POST upload trả 201. `cache` field chỉ xuất hiện cho endpoints có caching.
**Lesson / Warning:** Kiểm tra `ApiResponse` shape theo `api-contract-first/RULE.md` trước khi viết bất kỳ controller nào.

---

[2026-05-05] [MUSIC SERVICE / CLEAN ARCHITECTURE] [DECISION]

**Problem:** `SongService` (Application layer) import `StackExchange.Redis` và `IConfiguration` — infrastructure concerns leak vào Application.
**Fix / Decision:** Tạo `ISongCache` abstraction ở Application, implement `RedisSongCache` ở Infrastructure. `IStorageService` thêm `BucketName` property để Application không cần `IConfiguration`.
**Lesson / Warning:** Application layer KHÔNG được reference Infrastructure packages. Nếu service cần config hoặc external clients, thêm typed abstraction vào `Application/Interfaces`.

---

[2026-05-05] [INFRA / MINIO / SEED] [DECISION]

**Problem:** Plan W3-4 mô tả dùng LocalStack S3, nhưng docker-compose đã có MinIO (port 9000).
**Fix / Decision:** Không thêm LocalStack — dùng MinIO đã có. Seed script dùng `mc` (MinIO Client) qua `docker exec` thay AWS CLI. Upload dùng `mc pipe` (stdin) vì Git Bash trên Windows convert path gây lỗi.
**Lesson / Warning:** Trên Windows Git Bash, `docker cp` và `docker exec` với path `/tmp/` bị MSYS convert. Workaround: `MSYS_NO_PATHCONV=1` hoặc pipe stdin.

---

[2026-05-05] [STREAMING SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Test `GetChunk_WithRangeHeader_Returns206PartialContent` fails — `Content-Range` không tìm thấy trong `response.Headers`.
**Root cause:** `Content-Range` là content header theo RFC 7233. .NET `HttpClient` phân loại nó vào `response.Content.Headers`, không phải `response.Headers`.
**Fix / Decision:** Đổi assertion sang `response.Content.Headers.Should().ContainKey("Content-Range")`.
**Lesson / Warning:** Check `response.Content.Headers` cho content headers (Content-Range, Content-Type, Content-Length). Dùng `response.Headers` cho response headers (X-Correlation-Id, Set-Cookie, Location).

---

[2026-05-05] [STREAMING SERVICE / INTEGRATION TESTS] [BUG]

**Problem:** Test `GetChunk_WithInvalidRangeHeader_Returns416` throws `HttpHeaderParser.ParseValue` exception khi thêm `Range: invalid-range`.
**Root cause:** `HttpRequestMessage.Headers.Add("Range", ...)` validate format theo RFC. String `"invalid-range"` không hợp lệ → exception ở client side trước khi gửi request.
**Fix / Decision:** Dùng `request.Headers.TryAddWithoutValidation("Range", "invalid-range")` để bypass validation.
**Lesson / Warning:** Khi test edge case với invalid headers, dùng `TryAddWithoutValidation` thay vì `Add`.

---

[2026-05-05] [STREAMING SERVICE] [DECISION]

**Problem:** Chunk endpoint cần chọn: proxy S3 bytes trực tiếp hay redirect về CDN URL.
**Fix / Decision:** S3 proxy — Streaming Service fetch bytes bằng `GetObjectRequest` với `ByteRange`, stream qua `Response.Body`. Không cần CDN cho local dev MinIO.
**Lesson / Warning:** Proxy đơn giản cho local dev nhưng tốn bandwidth ở service layer. Nếu cần scale, thêm CDN redirect ở `/url` endpoint, giữ `/chunk` như backup.

---

[2026-05-05] [RECOMMENDATION SERVICE / PYPROJECT] [BUG]

**Problem:** `pytest` fails với `Invalid statement (at line 1, column 1)` khi đọc `pyproject.toml`.
**Root cause:** File `pyproject.toml` và `pytest.ini` được tạo với UTF-8 BOM (`\xef\xbb\xbf`). TOML parser không chấp nhận BOM.
**Fix / Decision:** Dùng Write tool để overwrite — ghi UTF-8 không BOM. Xóa `pytest.ini` cũ, chuyển config sang `[tool.pytest.ini_options]` trong `pyproject.toml`.
**Lesson / Warning:** File config (`.toml`, `.ini`, `.cfg`) có nguy cơ BOM nếu tạo bởi Windows tools. Khi gặp parse error lạ ở dòng 1 column 1: `python -c "open('f','rb').read(4)"` để check BOM.

---

[2026-05-05] [RECOMMENDATION SERVICE / SETUPTOOLS] [BUG]

**Problem:** `pip install -e .` fails với `BackendUnavailable: Cannot import 'setuptools.backends.legacy'`.
**Root cause:** `setuptools.backends.legacy:build` là backend mới từ setuptools 69+. Venv dùng version cũ hơn.
**Fix / Decision:** Đổi `build-backend` sang `"setuptools.build_meta"` — backend chuẩn, tương thích rộng hơn.
**Lesson / Warning:** Dùng `"setuptools.build_meta"` cho tất cả Python projects. `setuptools.backends.legacy` chỉ dùng khi chắc setuptools >= 69.

---

[2026-05-05] [RECOMMENDATION SERVICE] [DECISION]

**Problem:** IDE VS Code Pylance báo `Cannot find module 'fastapi'`, `Cannot find module 'redis.asyncio'` trên tất cả Python files.
**Root cause:** IDE dùng global Python interpreter (`E:\Python311`) thay vì `.venv`. Packages chỉ install vào `.venv`.
**Fix / Decision:** Không sửa code — đây là IDE config issue. Tests chạy đúng với `.venv/Scripts/python -m pytest`. Fix IDE: chọn interpreter `.venv/Scripts/python.exe` trong VS Code Python extension.
**Lesson / Warning:** Khi thấy "Cannot find module X" trong IDE nhưng tests pass → interpreter mismatch, không phải code bug. Không commit workaround chỉ để làm IDE happy.

---

[2026-05-07] [FRONTEND / TESTING] [BUG]

**Problem:** Vitest mock của `@microsoft/signalr.HubConnectionBuilder` với `vi.fn().mockImplementation(() => ({...}))` throw `is not a constructor` — hook dùng `new HubConnectionBuilder()`.
**Root cause:** Arrow function không thể làm constructor. `vi.fn().mockImplementation(() => obj)` dùng arrow function nên `new` keyword throw TypeError.
**Fix / Decision:** Dùng `function MockHubConnectionBuilder() { return mockBuilder; }` (regular function). Builder object là 1 shared object, tất cả chained methods (`withUrl`, `withAutomaticReconnect`, `configureLogging`) return chính object đó — không phải `mockReturnThis()` (trả về mock function, không phải builder).
**Lesson / Warning:** Khi mock class dùng `new` trong vitest: (1) dùng `function` keyword, không phải arrow; (2) builder pattern cần tất cả chained methods return cùng 1 object — khai báo object trước, rồi `method.mockReturnValue(thatObject)`.

---

[2026-05-07] [FRONTEND / ARCHITECTURE] [DECISION]

**Problem:** Plan W9 nói CreatorDashboardPage "gọi GET /api/v1/music/songs — dùng artist filter" nhưng endpoint này không tồn tại trong API Design V2.
**Root cause:** Plan được viết trước API Design V2 được finalize. Chỉ có `POST /music/songs` (upload) và `GET /music/songs/{songId}` (by ID).
**Fix / Decision:** CreatorDashboardPage dùng Song ID input — Creator nhập songId để xem analytics. Đây là đủ cho MVP demo flow. Không implement endpoint ngoài contract.
**Lesson / Warning:** Trước khi implement bất kỳ API call nào từ plan, kiểm tra API_DESIGN_V2.md để confirm endpoint tồn tại. Plan file có thể out-of-date so với contract.

---
