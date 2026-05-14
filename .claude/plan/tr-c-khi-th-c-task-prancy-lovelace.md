# Plan: CSS Audit — DESIGN_STITCH.md Compliance

## Context

DESIGN_STITCH.md vừa được thêm vào repo với toàn bộ design rules của hệ thống (màu sắc, typography, border-radius, shadow, layout). Frontend đã implement xong 8 phases nhưng chưa có lần audit nào đối chiếu CSS với design spec. Task này kiểm tra từng component/page và fix các violation.

---

## Scope: Files cần audit (44 files)

### Shared Tokens (kiểm tra trước tiên)
- `services/frontend/tailwind.config.ts` — token values phải match DESIGN_STITCH.md

### Layout Components
- `components/layout/AppShell.tsx`
- `components/layout/Sidebar.tsx`
- `components/layout/BottomPlayerBar.tsx`
- `components/layout/MobileNav.tsx`

### UI Components
- `components/ui/Button.tsx`
- `components/ui/Input.tsx`
- `components/ui/Modal.tsx`
- `components/ui/Toast.tsx`
- `components/ui/SkeletonRow.tsx`
- `components/ui/Spinner.tsx`

### Pages
- `pages/LoginPage.tsx`
- `pages/RegisterPage.tsx`
- `pages/OnboardingPage.tsx`
- `pages/HomePage.tsx`
- `pages/SearchPage.tsx`
- `pages/NotificationsPage.tsx`
- `pages/party/PartyLandingPage.tsx`
- `pages/party/PartyRoomPage.tsx`
- `pages/creator/UploadPage.tsx`
- `pages/CreatorDashboardPage.tsx`

### Feature Components
- `features/recommendation/components/SongCard.tsx`
- `features/player/components/NowPlayingOverlay.tsx`
- `features/party/components/CreateRoomModal.tsx`
- `features/party/components/RoomPlayer.tsx`
- `features/party/components/HostControls.tsx`
- `features/party/components/MemberList.tsx`
- `features/notifications/components/NotificationRow.tsx`
- `features/notifications/components/FilterPills.tsx`
- `features/auth/components/LoginForm.tsx`
- `features/auth/components/RegisterForm.tsx`
- `features/onboarding/components/GenreGrid.tsx`
- `features/onboarding/components/ArtistGrid.tsx`
- `features/creator/components/FileDropzone.tsx`
- `features/creator/components/MetadataForm.tsx`

---

## Design Rules Checklist (từ DESIGN_STITCH.md)

### Rule 1 — Color Palette
| Token | Expected Value | Tailwind class |
|-------|---------------|----------------|
| Background deepest | `#121212` | `bg-near-black` |
| Surface Level 1 | `#181818` | `bg-dark-surface` |
| Surface Level 2 | `#1f1f1f` | `bg-mid-dark` |
| Card | `#252525` | `bg-dark-card` |
| Text primary | `#ffffff` | `text-text-base` |
| Text secondary | `#b3b3b3` | `text-text-secondary` |
| Accent | `#1ed760` | `bg-spotify-green` / `text-spotify-green` |
| Error | `#f3727f` | `text-negative` |
| Border | `#4d4d4d` | `border-border-muted` |

**Kiểm tra:** Không dùng màu hex hardcoded trong className (trừ SVG). Không có màu nền sáng trên primary surfaces.

### Rule 2 — Typography
| Role | Size | Weight | Transform | Tracking |
|------|------|--------|-----------|---------|
| Section Title | 24px | 700 | — | normal |
| Feature Heading | 18px | 600 | — | normal |
| Button Uppercase | 14px | 700 | uppercase | 1.4px |
| Nav Link active | 14px | 700 | — | normal |
| Nav Link inactive | 14px | 400 | — | normal |
| Caption | 14px | 400 | — | normal |
| Small Bold | 12px | 700 | — | normal |
| Micro | 10px | 400 | — | normal |

**Kiểm tra:** Tất cả button primary phải có `uppercase` + `tracking-widest` (1.4px). Font không được nhỏ hơn 10px.

### Rule 3 — Border Radius
| Context | Spec | Tailwind class |
|---------|------|----------------|
| Primary buttons / Search input | 9999px / 500px | `rounded-full` hoặc `rounded-pill` |
| Play button (circular) | 50% | `rounded-full` |
| Cards, album art | 6–8px | `rounded-[6px]` hoặc `rounded-[8px]` |
| Modals / Dialogs | 8px | `rounded-[8px]` |
| Nav pills | 9999px | `rounded-full` |
| Badges | 2px | `rounded-[2px]` hoặc `rounded-sm` |

**⚠️ Violation đã phát hiện:** `Modal.tsx` dùng `rounded-lg` = 2rem (32px) → phải đổi thành `rounded-[8px]`.

### Rule 4 — Shadows / Elevation
| Level | Spec | Tailwind |
|-------|------|----------|
| Dialog (Level 3) | `rgba(0,0,0,0.5) 0px 8px 24px` | `shadow-level-3` |
| Card (Level 2) | `rgba(0,0,0,0.3) 0px 8px 8px` | `shadow-level-2` |
| Input inset | `rgb(18,18,18) 0px 1px 0px, rgb(124,124,124) 0px 0px 0px 1px inset` | `shadow-input-inset` |

**⚠️ Violation đã phát hiện:** `SongCard.tsx` dùng `shadow-[rgba(0,0,0,0.3)_0px_4px_8px]` — offset sai (4px thay vì 8px). Phải đổi thành `shadow-level-2`.

### Rule 5 — Layout / Sidebar Width
| Property | Spec | Current |
|----------|------|---------|
| Sidebar width | 280px | `w-[240px]` — **VIOLATION** |
| AppShell offset | 280px | `ml-[240px]` — phải cập nhật đồng bộ |

**⚠️ Violation đã phát hiện:** Sidebar width là 240px thay vì 280px per spec.

### Rule 6 — Buttons
- Primary CTA: `bg-spotify-green text-near-black rounded-full uppercase tracking-[1.4px]` (hoặc `tracking-widest`)
- Secondary pill: `bg-mid-dark text-text-base rounded-full`
- Outlined: `bg-transparent border border-border-pill rounded-full`
- Circular play: `rounded-full` với size `w-12 h-12` (48px)
- **KHÔNG** dùng square/rectangle buttons (thiếu `rounded-full`)

### Rule 7 — Inputs
- Search: `bg-mid-dark rounded-full` với `shadow-input-inset`
- **KHÔNG** dùng `border border-*` thay cho inset shadow pattern trên search input

**⚠️ Violation đã phát hiện:** `SearchPage.tsx` search input dùng `border border-border-muted` — phải đổi sang `shadow-input-inset`.

### Rule 8 — Responsive
- Sidebar: visible từ `lg` (1024px) trở lên — `hidden lg:flex`
- Bottom nav: `flex lg:hidden` (mobile only)
- AppShell content offset: `ml-0 lg:ml-[280px]` (sau khi fix sidebar width)

---

## Violations Đã Xác Nhận (Pre-audit)

| # | File | Rule | Issue | Fix |
|---|------|------|-------|-----|
| V1 | `Sidebar.tsx` | Layout | `w-[240px]` → phải là `w-[280px]` | Đổi width, cập nhật AppShell `ml-[280px]` |
| V2 | `AppShell.tsx` | Layout | `ml-[240px]` → phải là `ml-[280px]` | Đồng bộ với V1 |
| V3 | `Modal.tsx` | Border Radius | `rounded-lg` (32px) → phải là `rounded-[8px]` | Đổi class |
| V4 | `SongCard.tsx` | Shadow | `shadow-[rgba(0,0,0,0.3)_0px_4px_8px]` → `shadow-level-2` | Dùng token |
| V5 | `SearchPage.tsx` | Input | `border border-border-muted` trên search → phải là `shadow-input-inset` | Đổi class |
| V6 | `tailwind.config.ts` | Tokens | Xác nhận `shadow-level-2`, `shadow-level-3`, `shadow-input-inset` đúng spec | Verify/fix values |

---

## Implementation Plan

### Bước 1 — Verify & Fix tailwind.config.ts tokens (30 phút)
Đọc `tailwind.config.ts`, đối chiếu từng giá trị với DESIGN_STITCH.md:
- `colors.*` — từng hex value
- `boxShadow.level-1/2/3/input-inset` — từng shadow string
- `borderRadius.*` — scale values
- `fontSize.*` — size + lineHeight + letterSpacing
- `spacing.*` — scale values
- `fontFamily.*` — Plus Jakarta Sans (replacement hợp lệ cho SpotifyMixUI)

Fix bất kỳ giá trị sai, sau đó run `npm run build` để xác nhận không có lỗi.

### Bước 2 — Fix confirmed violations (V1–V6) (20 phút)
Thực hiện 6 fixes đã xác nhận ở bảng trên. Thứ tự:
1. Fix `tailwind.config.ts` shadow tokens (V6) trước — V4 phụ thuộc vào đây
2. Fix `Sidebar.tsx` width (V1) + `AppShell.tsx` offset (V2) cùng lúc
3. Fix `Modal.tsx` border-radius (V3)
4. Fix `SongCard.tsx` shadow (V4)
5. Fix `SearchPage.tsx` input border (V5)

### Bước 3 — Full file-by-file audit (60 phút)
Đọc từng file trong danh sách scope, kiểm tra theo 8 Rules. Ghi violations mới vào checklist, fix ngay.

**Thứ tự audit (theo impact):**
1. `Button.tsx` — letter-spacing, uppercase, size
2. `Input.tsx` — inset shadow đúng spec chưa
3. Layout: `BottomPlayerBar.tsx`, `MobileNav.tsx`
4. Pages: `LoginPage/RegisterPage`, `OnboardingPage`, `HomePage`, `SearchPage`, `NotificationsPage`
5. Features: `SongCard`, `NowPlayingOverlay`, `CreateRoomModal`, `RoomPlayer`, `HostControls`, `MemberList`
6. Creator: `UploadPage`, `CreatorDashboardPage`, `FileDropzone`, `MetadataForm`
7. Auth/Onboarding: `LoginForm`, `RegisterForm`, `GenreGrid`, `ArtistGrid`
8. Notifications: `NotificationRow`, `FilterPills`

**Checklist per file:**
- [ ] Backgrounds dùng đúng surface token?
- [ ] Text colors dùng `text-text-*` / `text-negative` / `text-spotify-green`?
- [ ] Buttons có `rounded-full` + `uppercase` + `tracking-widest`?
- [ ] Cards dùng `rounded-[6px]`/`rounded-[8px]` (không phải `rounded-lg`/`rounded-xl`)?
- [ ] Shadows dùng `shadow-level-*` tokens (không phải arbitrary `shadow-[...]`)?
- [ ] Inputs dùng `shadow-input-inset` (không phải `border border-*`)?
- [ ] Không có hardcoded hex trong `className` (trừ SVG)?
- [ ] Font sizes trong range 10px–24px?

### Bước 4 — Regression test (10 phút)
```bash
cd services/frontend
npm run test -- --run   # 314 tests phải vẫn xanh
npm run build           # TypeScript strict, 0 errors
```

---

## Critical Files
- `services/frontend/tailwind.config.ts` — ground truth cho tất cả tokens
- `services/frontend/src/components/ui/Button.tsx` — pattern button chuẩn
- `services/frontend/src/components/ui/Input.tsx` — pattern input chuẩn
- `services/frontend/src/components/layout/Sidebar.tsx` — layout root (width ảnh hưởng toàn app)
- `services/frontend/src/components/layout/AppShell.tsx` — layout root (ml offset)

## Verification
1. `npm run test -- --run` → 314/314 xanh (không regress)
2. `npm run build` → 0 TypeScript errors
3. Visual check: `npm run dev` → sidebar đủ 280px, modals đúng radius, cards đúng shadow
4. Cross-check: mỗi file đã audit có thể mark [✓] trong checklist
