# Google Stitch UI Prompts — Smart Music Streaming Platform
> Design system: Spotify-inspired dark theme (DESIGN.md)
> Language: Tiếng Việt
> Output: Reference cho Claude phát triển frontend React/TypeScript

---

## Design Token Reference (dùng chung cho tất cả prompts)

```
Background:     #121212
Surface:        #181818
Surface Alt:    #1f1f1f
Card:           #252525
Accent Green:   #1ed760
Text Primary:   #ffffff
Text Secondary: #b3b3b3
Error:          #f3727f
Warning:        #ffa42b
Info:           #539df5
Border:         #4d4d4d
Font:           SpotifyMixUI, SpotifyMixUITitle (fallback: Helvetica Neue, Arial)
```

---

## NHÓM 1 — Auth Screens (Login + Register)

### Prompt 1A — Login Page

```
Design a full-page dark music streaming login screen in Vietnamese.

LAYOUT:
- Full viewport, centered card on a #121212 background
- Card: #181818 background, 8px border-radius, padding 48px, max-width 480px
- Subtle shadow: rgba(0,0,0,0.5) 0px 8px 24px

HEADER:
- Logo: music note icon + text "SoundWave" in SpotifyMixUITitle 24px weight 700, #ffffff, centered
- Tagline below: "Nghe nhạc không giới hạn" in SpotifyMixUI 14px weight 400, #b3b3b3, centered

FORM FIELDS (top to bottom, full width, gap 16px):
- Label "Email" — 14px weight 700, #ffffff
  Input: #1f1f1f background, #ffffff text, 500px border-radius (pill), padding 12px 20px
  Placeholder: "email@example.com" in #b3b3b3
  Inset border: rgb(124,124,124) 0px 0px 0px 1px inset
- Label "Mật khẩu" — 14px weight 700, #ffffff
  Input: same style as email, type password
  Placeholder: "Nhập mật khẩu"
  Right side: eye icon toggle (#b3b3b3)
- "Quên mật khẩu?" — 12px weight 400, #1ed760, right-aligned, clickable

PRIMARY BUTTON:
- "ĐĂNG NHẬP" — full width, background #1ed760, text #000000, weight 700
- 14px uppercase, letter-spacing 2px
- 500px border-radius (pill), padding 14px 0
- Hover: slightly darker green #1db954

DIVIDER:
- Thin line with "hoặc" text centered, #4d4d4d line, #b3b3b3 text 12px

SOCIAL LOGIN:
- Button "Tiếp tục với Google" — full width, #1f1f1f background, #ffffff text
- 500px radius, padding 12px, border 1px solid #4d4d4d
- Google icon left-aligned

FOOTER:
- "Chưa có tài khoản? Đăng ký" — 14px, #b3b3b3 + #1ed760 link, centered

ERROR STATE (show as variant):
- Below email input: "Email hoặc mật khẩu không đúng"
- 12px, #f3727f, with warning icon

ACCOUNT LOCKED STATE (show as variant):
- Banner inside card: #f3727f/10 background, #f3727f border-left 3px
- "Tài khoản tạm khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau."
- 14px, #f3727f

STYLE RULES:
- No light surfaces anywhere
- All inputs are pill-shaped
- Green (#1ed760) used ONLY on primary CTA and links
- Background stays #121212 — no gradients
```

---

### Prompt 1B — Register Page

```
Design a full-page dark music streaming registration screen in Vietnamese.

LAYOUT:
- Full viewport, centered card on #121212 background
- Card: #181818 background, 8px border-radius, padding 48px, max-width 480px
- Shadow: rgba(0,0,0,0.5) 0px 8px 24px

HEADER:
- Logo: music note icon + "SoundWave" SpotifyMixUITitle 24px weight 700, #ffffff, centered
- "Tạo tài khoản miễn phí" — 18px weight 600, #ffffff, centered, margin-top 8px

FORM FIELDS (full width, gap 16px):
1. Label "Họ và tên" — 14px weight 700, #ffffff
   Input pill: #1f1f1f, placeholder "Nguyễn Văn A", padding 12px 20px, 500px radius
   Inset border: rgb(124,124,124) 0px 0px 0px 1px inset

2. Label "Email" — same style
   Input pill: placeholder "email@example.com"

3. Label "Mật khẩu" — same style
   Input pill: placeholder "Tối thiểu 8 ký tự"
   Eye icon toggle right side, #b3b3b3
   Password strength bar below input:
   - Thin bar full-width, 4px height, 9999px radius
   - Weak: #f3727f (1/3 filled), Medium: #ffa42b (2/3), Strong: #1ed760 (full)
   - Label: "Yếu / Trung bình / Mạnh" — 12px, matching color

4. Label "Xác nhận mật khẩu" — same style
   Input pill: placeholder "Nhập lại mật khẩu"
   Valid state: right-side checkmark icon #1ed760
   Invalid state: right-side X icon #f3727f + border #f3727f inset

5. Label "Bạn là:" — 14px weight 700, #ffffff
   Two pill toggle buttons side by side:
   - "🎧 Người nghe" — selected: #1ed760 background #000000 text, unselected: #1f1f1f #b3b3b3
   - "🎵 Nghệ sĩ" — same toggle pattern
   Full width split 50/50, 500px radius each, 8px gap

TERMS CHECKBOX:
- Custom checkbox: #1f1f1f background, #1ed760 checkmark when checked, 4px radius
- "Tôi đồng ý với Điều khoản dịch vụ và Chính sách bảo mật"
- 12px weight 400, #b3b3b3, links #1ed760

PRIMARY BUTTON:
- "TẠO TÀI KHOẢN" — full width, #1ed760 background, #000000 text
- 14px weight 700 uppercase, letter-spacing 2px, 500px radius, padding 14px 0
- Disabled state (checkbox unchecked): #4d4d4d background, #b3b3b3 text, cursor not-allowed

FOOTER:
- "Đã có tài khoản? Đăng nhập" — 14px, #b3b3b3 + #1ed760 link, centered

VALIDATION ERROR STATES:
- Inline below each field: 12px #f3727f with icon
- "Email đã được sử dụng"
- "Mật khẩu không khớp"
- "Vui lòng điền đầy đủ thông tin"

STYLE RULES:
- Same dark immersive style as Login
- Role toggle is the key UX differentiator — make it prominent
- Password strength bar uses semantic colors only
```

---

## NHÓM 2 — Onboarding Screen

### Prompt 2A — Onboarding: Chọn Genre & Artist

```
Design a full-page dark onboarding screen for a music streaming app in Vietnamese.
This screen appears only on first login. User must select minimum 3 genres or artists to proceed.

LAYOUT:
- Full viewport, #121212 background
- Centered container, max-width 680px, padding 48px 24px
- No sidebar, no bottom player — this is a standalone flow

PROGRESS INDICATOR (top):
- 3-step stepper: "Chọn thể loại" → "Chọn nghệ sĩ" → "Hoàn tất"
- Current step has #1ed760 dot + bold text #ffffff 14px weight 700
- Inactive: #4d4d4d dot + #b3b3b3 text
- Connected by thin #4d4d4d line

STEP 1 — Chọn thể loại (Genre Selection):

Header:
- "Bạn thích thể loại nhạc nào?" — SpotifyMixUITitle 24px weight 700, #ffffff, centered
- "Chọn ít nhất 3 thể loại để bắt đầu" — 14px weight 400, #b3b3b3, centered

Genre Grid (3 columns, gap 12px, responsive):
Each genre card:
- 160px × 100px, 6px border-radius
- Gradient background unique per genre (e.g. Pop: #8b5cf6→#ec4899, Rock: #ef4444→#f97316, Jazz: #0ea5e9→#6366f1, etc.)
- Genre name: 16px weight 700, #ffffff, bottom-left
- Genre icon/emoji top-right
- Unselected state: normal
- Selected state: white checkmark circle overlay (top-right), brightness increase, border 2px solid #1ed760

Genres to show (9 cards):
Pop, Rock, R&B, Jazz, Classical, Electronic, Hip-Hop, Acoustic, Indie

STEP 2 — Chọn nghệ sĩ (Artist Selection, show as next screen variant):

Header:
- "Chọn nghệ sĩ bạn yêu thích" — same header style
- "Chọn ít nhất 3 nghệ sĩ"

Artist Grid (4 columns, gap 16px):
Each artist card (vertical, centered):
- Avatar: 88px circle, object-fit cover
- Selected: #1ed760 border 3px on circle + checkmark badge bottom-right
- Artist name: 14px weight 700, #ffffff, centered below avatar
- Genre tag: 12px weight 400, #b3b3b3, centered

Artists to show (8 cards):
Sơn Tùng M-TP, BLACKPINK, BTS, Ed Sheeran, Taylor Swift, Doja Cat, Coldplay, Adele

SELECTION COUNTER:
- Fixed bottom bar (above CTA): #181818 background, top border 1px #4d4d4d
- "Đã chọn: 2/3" — left, 14px #b3b3b3 (turns #1ed760 when ≥ 3)
- Progress mini bar: thin #1ed760 fill

BOTTOM CTA:
- "TIẾP THEO →" button: full width, #1ed760 bg, #000000 text, 500px radius, 14px uppercase weight 700
- Disabled (< 3 selected): #4d4d4d bg, #b3b3b3 text
- "BỎ QUA" text link: 14px #b3b3b3, centered below button

STEP 3 — Hoàn tất (show as final variant):
- Centered: large checkmark circle #1ed760 (64px)
- "Tất cả đã sẵn sàng!" — 24px weight 700, #ffffff
- "Chúng tôi đã cá nhân hóa playlist cho bạn" — 14px #b3b3b3
- "KHÁM PHÁ NGAY" button — #1ed760, full width, 500px radius

STYLE RULES:
- Genre cards use colorful gradients — only place in the app with non-achromatic surfaces
- Artist avatars are circular (50%) — core Spotify pattern
- Minimum 3 enforcement is a hard gate (button disabled)
- No sidebar or bottom player on this flow
```

---

## NHÓM 3 — Main App Layout + Home

### Prompt 3A — App Shell: Sidebar + Bottom Player Bar

```
Design the persistent app shell for a dark music streaming web app in Vietnamese.
This layout wraps all main screens. Show with Home page content visible.

OVERALL STRUCTURE:
- Left sidebar (fixed, 240px wide)
- Main content area (fills remaining width, scrollable)
- Bottom player bar (fixed, full width, 72px height, above everything)
- Background: #121212

LEFT SIDEBAR (#121212 background):

Logo section (top, padding 24px 16px):
- Music note icon + "SoundWave" — SpotifyMixUITitle 16px weight 700, #1ed760

Primary Navigation (padding 8px):
Each nav item: icon (20px) + label, 14px SpotifyMixUI
- 🏠 Trang chủ — active: weight 700 #ffffff, inactive: weight 400 #b3b3b3
- 🔍 Tìm kiếm
- 🔔 Thông báo (badge: unread count, #1ed760 circle, 10px)
- 🎉 Listening Party

Divider: 1px #4d4d4d, margin 8px 16px

Library section header:
- "THƯ VIỆN" — 12px weight 700 uppercase letter-spacing 2px, #b3b3b3
- "+" icon button right side

Playlist items (recent):
- Each: thumbnail (40px, 4px radius) + name 14px #ffffff + type tag 12px #b3b3b3

Creator section (if role = Creator):
Divider + items:
- 📤 Tải nhạc lên
- 📊 Analytics

Bottom of sidebar:
- User avatar (32px circle) + display name 14px weight 700 #ffffff + "···" menu
- Background: #181818, padding 16px, border-top 1px #4d4d4d

BOTTOM PLAYER BAR (#181818 background, border-top 1px #4d4d4d):

Left section (song info, 30% width):
- Album art: 56px square, 4px radius
- Song title: 14px weight 700 #ffffff, truncated
- Artist name: 12px weight 400 #b3b3b3, truncated
- Heart icon (like toggle): #b3b3b3, turns #1ed760 when liked

Center section (playback controls, 40% width, centered):
- Controls row: ⏮ Shuffle · ⏭ Prev · ▶ Play · ⏭ Next · 🔁 Repeat
- Play button: 32px circle, #1ed760 background, #000000 icon (50% radius)
- Other controls: 20px, #b3b3b3, hover #ffffff
- Progress bar below: thin (4px height), #4d4d4d track, #ffffff fill, 9999px radius
  - Current time left: "1:23" — 12px #b3b3b3
  - Total time right: "3:45" — 12px #b3b3b3
  - Hover: progress thumb dot appears (#ffffff, 12px circle)

Right section (volume + extras, 30% width, right-aligned):
- 🎵 Lyrics icon · 📋 Queue icon · 💻 Device icon
- Volume: speaker icon + thin slider (#4d4d4d track, #ffffff fill)
- All icons: 20px, #b3b3b3 hover #ffffff
- Active icon: #1ed760

HOME PAGE CONTENT (main area):

Top bar (sticky, #121212/80% blur backdrop):
- User greeting: "Chào buổi sáng, Nghiệp 👋" — 24px SpotifyMixUITitle weight 700, #ffffff
- Right: bell icon + user avatar 32px

Section 1 — "Gợi ý cho bạn sáng nay":
- Section title: 18px SpotifyMixUI weight 600, #ffffff
- Subtitle: "Vì bạn nghe nhạc buổi sáng" — 12px #b3b3b3
- Horizontal scroll row of 5 song cards:
  Card: 160px wide, #181818 bg, 6px radius, hover shadow rgba(0,0,0,0.3) 0px 8px 8px
  - Album art: 160px square, 6px radius top
  - Title: 14px weight 700 #ffffff, truncated
  - Artist: 12px weight 400 #b3b3b3
  - Context tag chip: "☀️ Buổi sáng" — 10px #b3b3b3, #1f1f1f bg, 9999px radius, padding 2px 8px
  - On hover: green circular play button (40px, #1ed760) slides up from bottom-right

Section 2 — "Đang thịnh hành":
- Same card grid (5 cards), different gradient overlays on album art

Section 3 — "Vì bạn nghe Indie Rock":
- 5 cards, same pattern

STYLE RULES:
- Sidebar always visible on desktop (≥1024px)
- Bottom player always visible when a song is playing
- Green ONLY on play button, active nav, active like
- Section titles use weight 600 not 700 to create hierarchy below page title
- Cards hover state lifts slightly with shadow
```

---

## NHÓM 4 — Player + Search

### Prompt 4A — Now Playing / Song Detail

```
Design a Now Playing expanded view for a dark music streaming app in Vietnamese.
This appears when user clicks the player bar to expand, or clicks a song. Fullscreen overlay.

LAYOUT:
- Full screen overlay on top of app, #121212 background
- Two-column layout: left (album art) + right (controls), 50/50, centered vertically
- Chevron-down "⌄" button top-left to collapse back, 24px #b3b3b3

LEFT COLUMN (album art):
- Album art: 320px square, 8px border-radius
- Dynamic glow: box-shadow matching dominant album color (e.g. rgba(30,215,96,0.2) 0px 0px 80px 20px)
- Rotates subtly when playing (very slow, 20s per rotation, pauses on pause)

RIGHT COLUMN (song info + controls):

Song Info:
- Song title: SpotifyMixUITitle 32px weight 700, #ffffff
- Artist name: 18px weight 400, #b3b3b3, clickable (underline on hover, #ffffff)
- Album name: 14px weight 400, #b3b3b3
- Context tag: "☀️ Gợi ý buổi sáng · Vì bạn thích Indie Rock"
  — 12px, #b3b3b3, #1f1f1f pill bg, 9999px radius, padding 4px 12px

Action row (below title):
- ♡ Like · ··· More — 20px icons, #b3b3b3 hover #ffffff
- ♡ turns #1ed760 solid when liked

Progress section:
- Full-width progress bar: 4px height, #4d4d4d track, #ffffff fill, 9999px radius
- Hover: grow to 6px height, #1ed760 fill (smooth transition)
- Thumb: 12px white circle on hover
- Time left: "1:23" 12px #b3b3b3 — Time total right: "3:45" 12px #b3b3b3

Playback controls (centered row, gap 24px):
- 🔀 Shuffle — 24px, #b3b3b3, active: #1ed760 + dot indicator below
- ⏮ Previous — 24px, #b3b3b3 hover #ffffff
- ▶/⏸ Play/Pause — 56px circle, #ffffff background, #000000 icon (50% radius, 12px padding)
  Hover: scale 1.05, shadow rgba(255,255,255,0.1)
- ⏭ Next — 24px, #b3b3b3 hover #ffffff
- 🔁 Repeat — 24px, #b3b3b3, active: #1ed760 + "1" badge for repeat-one

Volume row:
- Speaker icon + pill slider (same style as player bar)
- Width 160px, right-aligned

Tabs below controls:
- "Lời bài hát" · "Hàng chờ" · "Liên quan"
- 14px weight 700 active #ffffff + #1ed760 underline 2px
- Inactive: #b3b3b3

Lyrics panel (when "Lời bài hát" active):
- Scrollable, current line: 18px weight 700 #ffffff
- Other lines: 14px weight 400 #b3b3b3
- Auto-scroll to current line

STYLE RULES:
- Album glow is the ONLY dynamic color — changes per song
- Play button is white (not green) at this size — green reserved for smaller contexts
- Lyrics panel uses size hierarchy (not color) to show current line
- This is the most immersive screen — album art and glow dominate
```

---

### Prompt 4B — Search Page

```
Design a Search page for a dark music streaming app in Vietnamese.
Two states: empty/browse and active search results.

LAYOUT:
- Main content area (sidebar + bottom player present as usual)
- Padding: 24px

STATE 1 — Empty (Browse):

Header:
- "Tìm kiếm" — SpotifyMixUITitle 24px weight 700, #ffffff

Search input (full width, max 680px):
- #1f1f1f background, 500px border-radius (pill)
- Padding: 12px 20px 12px 48px
- 🔍 icon inside left: 20px, #b3b3b3
- Placeholder: "Bài hát, nghệ sĩ, thể loại…" — #b3b3b3
- Inset border: rgb(124,124,124) 0px 0px 0px 1px inset
- Focus: border becomes #ffffff, outline 1px solid

Browse section:
- "Khám phá thể loại" — 18px weight 600, #ffffff, margin-top 32px
- 3-column grid, genre cards (160px height):
  Each card: gradient background, genre name 16px weight 700 #ffffff bottom-left
  Same gradient-per-genre as Onboarding (consistent color mapping)
  6px border-radius, hover: brightness(1.1)

STATE 2 — Active Search (query = "sơn tùng"):

Search input: filled, "sơn tùng" as value, X clear button right side

Results layout (top-to-bottom sections):

"Kết quả hàng đầu" — 18px weight 600, #ffffff:
- Large featured card (leftmost, full section height):
  240px × 240px, #181818 bg, 8px radius
  Artist avatar: 120px circle, top-center
  Name: "Sơn Tùng M-TP" — 18px weight 700 #ffffff
  Type badge: "Nghệ sĩ" — 12px #b3b3b3, #1f1f1f pill
  Play button: 48px circle #1ed760, #000000 icon, bottom-right, shows on hover

"Bài hát" — 18px weight 600, #ffffff (right of featured card):
- Vertical list of 4 tracks:
  Each row: index number · album art (40px, 4px radius) · title + artist · duration
  Index: 14px #b3b3b3 → turns to ▶ on hover
  Title: 14px weight 700 #ffffff
  Artist: 12px weight 400 #b3b3b3
  Duration: 12px #b3b3b3, right-aligned
  Row hover: #ffffff/5 background highlight

"Nghệ sĩ" — horizontal scroll row:
- Artist card: 120px circle avatar, name below 14px weight 700 #ffffff, "Nghệ sĩ" 12px #b3b3b3

"Bài hát liên quan" — 5 song cards (same card style as Home)

No results state:
- "Không tìm thấy kết quả cho "xyz""
- 16px #b3b3b3, centered, margin-top 48px
- Suggestion: "Thử tìm theo thể loại bên dưới" — same browse grid below

STYLE RULES:
- Search input pill is the defining UI element of this page
- Genre cards are the only colorful elements
- Result rows use hover highlight not border
- No error state — empty array is returned gracefully (per API contract)
```

---

## NHÓM 5 — Listening Party

### Prompt 5A — Listening Party Flow (Create + Join + Room)

```
Design 3 screens for a Listening Party feature in a dark music streaming app in Vietnamese.
Show as: Modal/overlay on top of main app.

SCREEN 1 — Create Room Modal:

Modal: 480px wide, #181818 bg, 8px radius, padding 32px
Shadow: rgba(0,0,0,0.5) 0px 8px 24px
Backdrop: #000000/60 overlay on main app

Header:
- "🎉 Tạo phòng nghe nhạc" — 20px SpotifyMixUITitle weight 700, #ffffff
- X close button top-right, 20px #b3b3b3

Form:
- Label "Tên phòng" — 14px weight 700, #ffffff
  Input pill: #1f1f1f, placeholder "VD: Tối thứ 6 với Indie 🎸", 500px radius, inset border
- Label "Bài hát đầu tiên" (optional search):
  Search pill input with 🔍 icon, placeholder "Tìm bài hát…"
  Below: mini song result list (3 rows, same row style as Search)

Footer buttons:
- "TẠO PHÒNG" — full width, #1ed760 bg, #000000 text, 500px radius, 14px uppercase weight 700
- "Hủy" — 14px #b3b3b3, centered link

---

SCREEN 2 — Join Room Modal:

Modal: same sizing as Create
Header: "🔗 Tham gia phòng" — 20px weight 700, #ffffff

Content:
- Label "Nhập mã phòng" — 14px weight 700, #ffffff
- 6-character code input:
  Row of 6 separate boxes (48px × 56px each, gap 8px, centered)
  Each box: #1f1f1f bg, 8px radius, 24px weight 700 #ffffff centered
  Inset border: rgb(124,124,124) 0px 0px 0px 1px inset
  Active box: #1ed760 border
  Filled: #ffffff text
- Helper: "Nhờ Host gửi mã 6 chữ số cho bạn" — 12px #b3b3b3, centered

Room preview (after valid code entered):
- Card: #252525 bg, 8px radius, padding 16px
- "🎵 Phòng của Nghiệp" — 14px weight 700 #ffffff
- "3 thành viên · Đang phát: Nơi Này Có Anh" — 12px #b3b3b3
- "Tham gia ngay →" link #1ed760

Footer:
- "THAM GIA" button — same green pill style, disabled until code valid
- Error state: "Mã phòng không tồn tại" — 12px #f3727f below input

---

SCREEN 3 — Room View (Full page, replaces main content):

LAYOUT:
- Sidebar still visible left
- Main area split: left (room player 60%) + right (member list 40%)
- Bottom player bar hidden — replaced by room-specific controls

LEFT — Room Player:

Room header:
- "🎉 Phòng của Nghiệp" — 20px weight 700, #ffffff
- Join code badge: "Mã: XK29F1" — 12px, #1f1f1f pill, #b3b3b3, copy icon
- "3 thành viên" — 12px #b3b3b3
- "Rời phòng" — 12px #f3727f, pill outlined border #f3727f

Album art: 280px square, 8px radius, centered
  Dynamic glow: rgba(dominant-color, 0.2) 0px 0px 60px 20px

Song info:
- Title: 24px weight 700 #ffffff, centered
- Artist: 16px weight 400 #b3b3b3, centered
- Sync indicator: "🔄 Đồng bộ với Host" — 12px #1ed760, centered

Progress bar: same style as Now Playing, but READ-ONLY for Members
  Label: "LIVE" badge — 10px uppercase, #1ed760 bg, #000000 text, 4px radius, blinking dot

HOST controls (show for Host role):
- Full playback controls row (same as Now Playing)
- Play button: 56px circle #1ed760 bg #000000 icon
- "▶ Phát" / "⏸ Dừng" / "⏭ Bỏ qua"
- Queue button: "📋 Hàng chờ" pill #1f1f1f

MEMBER view (no playback controls):
- Progress bar read-only, controls row grayed out
- Label below: "Chỉ Host mới điều khiển phát nhạc"
- 12px #b3b3b3, centered, italic

RIGHT — Member List (#181818 bg, 8px radius):

Header: "Thành viên (3)" — 16px weight 700 #ffffff, padding 16px

Member rows:
Each: avatar (40px circle) + name + role badge
- Host: crown icon 👑 + "Chủ phòng" badge — #ffa42b bg, #000000 text, 9999px radius, 10px
- Member: "Thành viên" — #4d4d4d bg, #b3b3b3 text
- Online indicator: 8px #1ed760 circle on avatar bottom-right
- "Bạn" label next to current user's name — 12px #b3b3b3

Invite section (bottom of list):
- Dashed border card: #4d4d4d, 8px radius, padding 16px, centered
- "+ Mời bạn bè" — 14px weight 700 #1ed760
- "Chia sẻ mã: XK29F1" — 12px #b3b3b3

STYLE RULES:
- "LIVE" blinking dot is the only animated element besides album art glow
- Host controls are visually distinct from Member's read-only view
- Join code is always visible and easily copyable
- Rời phòng uses error red — destructive action signal
```

---

## NHÓM 6 — Creator Screens

### Prompt 6A — Upload Song Page

```
Design an Upload Song page for music creators in a dark streaming app in Vietnamese.
This is only accessible to users with Creator role.

LAYOUT:
- Main content area with sidebar + no bottom player
- Centered container, max-width 720px, padding 32px

HEADER:
- "📤 Tải nhạc lên" — SpotifyMixUITitle 24px weight 700, #ffffff
- "Chia sẻ âm nhạc của bạn với thế giới" — 14px #b3b3b3

FORM (vertical stack, gap 24px):

SECTION 1 — File Upload:
Card: #181818 bg, 8px radius, padding 32px
- Drag-and-drop zone: dashed border 2px #4d4d4d, 8px radius, padding 48px, centered
  Icon: 🎵 48px, #b3b3b3
  Text: "Kéo thả file nhạc vào đây" — 16px weight 700 #ffffff
  Subtext: "Hỗ trợ: MP3, WAV, OGG · Tối đa 50MB" — 12px #b3b3b3
  Button: "CHỌN FILE" — outlined pill, #ffffff text, border 1px #7c7c7c, 9999px radius
  Drag-over state: border #1ed760, background #1ed760/5

After file selected (show as variant):
  Green bar: "✅ indie_song.mp3 · 8.2MB" — #1ed760 bg/10, #1ed760 text 14px, 8px radius
  Progress bar (uploading): #1ed760 fill animated, "Đang xử lý... 67%" 12px #b3b3b3
  X cancel button right side

SECTION 2 — Song Metadata:
Card: #181818 bg, 8px radius, padding 24px

Grid 2-column, gap 16px:
1. "Tên bài hát" * (required)
   Input pill: #1f1f1f, placeholder "VD: Nơi Này Có Anh", inset border

2. "Thể loại" *
   Select pill: #1f1f1f, 500px radius
   Options: Pop, Rock, R&B, Jazz, Electronic, Hip-Hop, Acoustic, Indie, Classical
   Custom dropdown: #181818 bg, items with hover #1f1f1f, checkmark on selected #1ed760

3. "Tâm trạng" (Mood)
   Select pill: same style
   Options: Vui vẻ, Buồn, Năng động, Thư giãn, Romantic, Buổi sáng, Khuya

4. "Ngôn ngữ"
   Select pill: Tiếng Việt / English / Không lời

Full-width:
5. "Bìa album" (Cover Art):
   Image upload area: 120px × 120px square dashed zone + "Tải ảnh bìa" label
   After upload: preview thumbnail 120px, 8px radius, X button overlay

6. "Nội dung nhạy cảm" toggle:
   Row: label "🔞 Nội dung người lớn (Explicit)" 14px #ffffff + toggle right
   Toggle: pill shape, off: #4d4d4d, on: #1ed760, 24px height

SECTION 3 — Preview:
Card: #252525 bg, 8px radius, padding 16px
"XEM TRƯỚC" label — 10px uppercase weight 700, #b3b3b3, letter-spacing 2px

Mini player preview (same as song card):
- Thumbnail 56px · Song name · Artist name (auto-filled from profile)
- Mini play button (32px #1ed760 circle)
- "Sẽ hiển thị như thế này với người nghe"

SUBMIT SECTION:
- Legal note: "Bằng cách tải lên, bạn xác nhận bạn sở hữu quyền với nội dung này."
  — 12px #b3b3b3, centered
- "TẢI LÊN" button: full width, #1ed760 bg, #000000 text, 500px radius, 14px uppercase weight 700
  Processing state: spinner icon left + "Đang tải lên…" text, cursor not-allowed, opacity 0.7
- "Hủy" — 14px #b3b3b3 link, centered

ERROR STATES (inline):
- File > 50MB: "File vượt quá 50MB. Vui lòng nén lại." — #f3727f, below upload zone
- Missing required: red #f3727f inset border on field + "Vui lòng điền thông tin này"
- Upload error 503: toast top-right "#f3727f bg: Tải lên thất bại. Vui lòng thử lại."

SUCCESS STATE:
- Green toast: "🎵 Bài hát đã được tải lên và đang xử lý!"
- Redirect to Analytics after 2s

STYLE RULES:
- Two-column metadata grid on desktop, single column on mobile
- File upload zone is the hero element — make it large and inviting
- Progress during upload is the key feedback moment
- Explicit toggle uses #ffa42b warning color for the icon
```

---

### Prompt 6B — Analytics Dashboard (Creator)

```
Design an Analytics Dashboard for music creators in a dark streaming app in Vietnamese.
Accessible to Creator (own songs only) and Admin (all songs).

LAYOUT:
- Main content area, sidebar visible
- Full-width content, padding 32px
- No bottom player (or collapsed) to maximize data space

HEADER:
- "📊 Analytics" — SpotifyMixUITitle 24px weight 700, #ffffff
- Song selector dropdown: "Nơi Này Có Anh ▾" — 14px weight 700, #1f1f1f bg, 500px radius, padding 8px 16px
  Dropdown shows: thumbnail + song name + upload date

Time range pills (right-aligned):
- "7 ngày" · "30 ngày" — pill toggle, selected: #1ed760 bg #000000 text, unselected: #1f1f1f #b3b3b3
- 9999px radius, 8px 16px padding, 14px weight 700

---

STATS OVERVIEW ROW (4 KPI cards, equal width):

Each card: #181818 bg, 8px radius, padding 20px 24px
- Metric value: 24px SpotifyMixUITitle weight 700, #ffffff
- Metric label: 12px weight 400 uppercase #b3b3b3, letter-spacing 1.4px
- Trend badge: "↑ 12%" — 12px, #1ed760 bg/15 #1ed760 text, or #f3727f for negative, 9999px radius

Cards:
1. "1,420" listeners — "LƯỢT NGHE ĐỘC NHẤT"  ↑ 8%
2. "8,340" plays — "TỔNG LƯỢT PHÁT" ↑ 12%
3. "62%" completion — "TỶ LỆ NGHE ĐỦ BÀI" — #ffa42b if < 50%
4. "230" today — "LƯỢT NGHE HÔM NAY" ↑ 3%

---

CHART 1 — Daily Listeners Line Chart (full width):

Card: #181818 bg, 8px radius, padding 24px
Header: "Lượt nghe theo ngày" — 16px weight 700 #ffffff left + "7 ngày" pill right

Line chart (100% width, ~240px height):
- Background: #181818, no grid lines (only horizontal ghost lines #4d4d4d/30)
- Line: #1ed760, 2px stroke, smooth curve
- Area fill: gradient #1ed760/20 → #1ed760/0 below line
- Data points: 6px circle #1ed760, hover expands to 10px + tooltip
- X axis: dates "24/4 · 25/4 · …" — 12px #b3b3b3
- Y axis: "0 · 100 · 200" — 12px #b3b3b3

Tooltip on hover:
- #252525 bg, 8px radius, padding 8px 12px, shadow
- "26/4/2026" — 12px #b3b3b3
- "234 lượt nghe" — 14px weight 700 #ffffff

---

CHART 2 — Skip Rate Heatmap (full width):

Card: #181818 bg, 8px radius, padding 24px
Header: "Heatmap tỷ lệ bỏ qua (skip)" — 16px weight 700 #ffffff
Subheader: "Điểm người nghe hay bỏ qua nhất" — 12px #b3b3b3

Heatmap visualization:
- Horizontal timeline bar (full width, 40px height, 4px radius)
- Base color: #1f1f1f
- Heat overlay cells (every 10 seconds segment):
  Low (0-10 skips): #1f1f1f
  Medium (10-30): #ffa42b/50
  High (30-50): #ffa42b
  Critical (50+): #f3727f
- X axis: song timeline "0:00 · 0:30 · 1:00 · … · 3:45" — 12px #b3b3b3
- Hover on segment: tooltip "1:50 - 2:00: 45 lượt bỏ qua"

Critical drop-off callout (auto-detected peak):
- Arrow annotation: "⚠️ Đỉnh bỏ qua lúc 2:00" — 12px #ffa42b
- Vertical dashed line #ffa42b at that position

Legend below:
- "Ít" → gradient bar → "Nhiều"
- Colors: #1f1f1f · #ffa42b/50 · #ffa42b · #f3727f
- 12px #b3b3b3 labels

---

CHART 3 — Unique Listeners Bar Chart:

Card: #181818 bg, 8px radius, padding 24px (half width, side by side with donut)
Header: "Người nghe theo ngày" — 16px weight 700 #ffffff

Bar chart:
- Vertical bars, rounded top (4px)
- Bar color: #1ed760, hover: #1db954
- Gap between bars: 4px
- Same axis labeling style

CHART 4 — Completion Rate Donut (other half):
Card: #181818 bg, 8px radius, padding 24px

Donut chart (160px diameter):
- #1ed760 arc for completion %
- #4d4d4d arc for skip %
- Center: "62%" — 24px weight 700 #ffffff + "Nghe đủ" 12px #b3b3b3

Legend below donut:
- ● #1ed760 "Nghe đủ bài: 62%"
- ● #4d4d4d "Bỏ qua: 38%"

---

EMPTY STATE (no songs uploaded yet):
- Centered: 🎵 icon 64px #b3b3b3
- "Bạn chưa có bài hát nào" — 18px weight 700 #ffffff
- "Tải nhạc lên để bắt đầu xem analytics" — 14px #b3b3b3
- "TẢI NHẠC LÊN" pill button #1ed760 bg

STYLE RULES:
- All chart backgrounds are #181818 — no white/light chart backgrounds
- #1ed760 for positive metrics, #ffa42b for warnings, #f3727f for critical
- No decorative colors — every color in charts is semantic
- Skip heatmap is the most important insight — place it prominently
- Trend badges must be tiny (not flashy) — data is the hero
```

---

## NHÓM 7 — Notifications

### Prompt 7A — Notifications Page

```
Design a Notifications page for a dark music streaming app in Vietnamese.

LAYOUT:
- Main content area (sidebar + bottom player present)
- Centered container, max-width 680px, padding 32px

HEADER row:
- "🔔 Thông báo" — SpotifyMixUITitle 24px weight 700, #ffffff
- "Đánh dấu tất cả đã đọc" — 14px #1ed760, right-aligned, clickable

Filter pills (below header, gap 8px):
- "Tất cả" · "Chưa đọc (3)" · "Bài hát mới"
- Selected: #1f1f1f bg #ffffff text weight 700, 9999px radius, 8px 16px padding
- Unselected: transparent bg, #b3b3b3 text, border 1px #4d4d4d

NOTIFICATION LIST (vertical, gap 0 — use dividers):

Each notification row:
Height: 72px, padding 12px 16px
Hover: #ffffff/5 background

Left: unread indicator (8px circle)
- Unread: #1ed760 solid
- Read: transparent (just spacing)

Content (flex row):
- Artist/song thumbnail: 48px circle (artist) or 48px square 4px radius (song)
- Text block:
  Primary: "Sơn Tùng M-TP vừa ra bài hát mới!" — 14px weight 700, #ffffff (unread) / #b3b3b3 (read)
  Secondary: "Nơi Này Có Anh · 2 giờ trước" — 12px weight 400 #b3b3b3
- Right: "▶ Nghe ngay" pill button — 9999px radius, #1f1f1f bg, #ffffff text, 12px weight 700, 4px 12px padding
  Only shows on hover

Unread rows:
- Slightly brighter background: #181818 (vs #121212 for read)
- Bold primary text

Read rows:
- #121212 background
- Regular weight primary text

Divider between rows: 1px #4d4d4d/30

---

NOTIFICATION TYPES (show as variants):

Type 1 — New Release:
🎵 thumbnail (song cover) · "Sơn Tùng M-TP vừa phát hành Nơi Này Có Anh"

Type 2 — System:
⚙️ icon circle (#4d4d4d bg) · "Cập nhật hệ thống: trải nghiệm nghe nhạc được cải thiện"
— 14px weight 400 #b3b3b3 (always read-style)

---

EMPTY STATE:
Centered, margin-top 80px:
- 🔔 icon with slash: 64px, #b3b3b3
- "Không có thông báo nào" — 18px weight 700 #ffffff
- "Theo dõi các nghệ sĩ yêu thích để nhận thông báo bài hát mới" — 14px #b3b3b3, centered
- "TÌM NGHỆ SĨ" pill button — outlined, border 1px #7c7c7c, #ffffff text, 9999px radius

LOADING STATE:
Skeleton rows (3):
- Gray shimmer animation: #181818 → #252525 → #181818 gradient
- Circle 48px + two lines (70% width, 30% width)

STYLE RULES:
- Unread indicator green dot is the primary signal — don't over-design
- "Nghe ngay" only appears on hover — keeps list clean
- New Release is the primary notification type — design for it
- Read/unread distinction through text weight and background, not color
- Cursor pagination (infinite scroll) — no "Load more" button
```

---

## Ghi chú cho Claude (Future Reference)

### Mapping Screen → Component trong React

| Screen | Page file | Key components |
|---|---|---|
| Login | `pages/auth/LoginPage.tsx` | `AuthCard`, `PillInput`, `GreenButton` |
| Register | `pages/auth/RegisterPage.tsx` | `AuthCard`, `PillInput`, `RoleToggle`, `PasswordStrengthBar` |
| Onboarding | `pages/auth/OnboardingPage.tsx` | `GenreGrid`, `ArtistGrid`, `SelectionCounter` |
| Home | `pages/HomePage.tsx` | `AppShell`, `SongCard`, `RecommendationSection` |
| Now Playing | `components/player/NowPlayingOverlay.tsx` | `AlbumGlow`, `SeekBar`, `LyricsPanel` |
| Search | `pages/SearchPage.tsx` | `SearchInput`, `GenreGrid`, `SearchResultList` |
| Party Create | `components/party/CreateRoomModal.tsx` | `Modal`, `PillInput`, `SongSearch` |
| Party Join | `components/party/JoinRoomModal.tsx` | `Modal`, `CodeInput` |
| Party Room | `pages/party/RoomPage.tsx` | `RoomPlayer`, `MemberList`, `HostControls` |
| Upload | `pages/creator/UploadPage.tsx` | `FileDropzone`, `MetadataForm`, `ProgressBar` |
| Analytics | `pages/creator/AnalyticsPage.tsx` | `KPICard`, `LineChart`, `HeatmapBar`, `DonutChart` |
| Notifications | `pages/NotificationsPage.tsx` | `NotificationRow`, `FilterPills` |

### Persistent Layout Components

| Component | File | Notes |
|---|---|---|
| `AppShell` | `components/layout/AppShell.tsx` | Wraps Sidebar + Content + PlayerBar |
| `Sidebar` | `components/layout/Sidebar.tsx` | Role-aware nav items |
| `BottomPlayerBar` | `components/player/BottomPlayerBar.tsx` | Always mounted, hidden when no song |
| `AuthGuard` | `components/auth/AuthGuard.tsx` | Redirect to /login if no token |
| `RoleGuard` | `components/auth/RoleGuard.tsx` | 403 if wrong role |

### Design Token → CSS Variable Mapping

```css
:root {
  --bg-base:        #121212;
  --bg-surface:     #181818;
  --bg-surface-alt: #1f1f1f;
  --bg-card:        #252525;
  --accent:         #1ed760;
  --accent-dark:    #1db954;
  --text-primary:   #ffffff;
  --text-secondary: #b3b3b3;
  --text-error:     #f3727f;
  --text-warning:   #ffa42b;
  --text-info:      #539df5;
  --border:         #4d4d4d;
  --border-light:   #7c7c7c;
  --shadow-heavy:   rgba(0,0,0,0.5) 0px 8px 24px;
  --shadow-medium:  rgba(0,0,0,0.3) 0px 8px 8px;
  --shadow-inset:   rgb(18,18,18) 0px 1px 0px, rgb(124,124,124) 0px 0px 0px 1px inset;
  --radius-pill:    500px;
  --radius-full:    9999px;
  --radius-circle:  50%;
  --radius-card:    8px;
  --radius-sm:      6px;
}
```
