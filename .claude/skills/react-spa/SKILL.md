# SKILL: react-spa

> Claude đọc file này mỗi khi tạo hoặc chỉnh sửa Frontend React TypeScript SPA.
> Service chạy trên port **3000**. Stack: React + TypeScript (strict) + Vite.
> Ngắn gọn — đọc để làm, không phải đọc để học.

---

## 1. Folder Structure

```
src/
├── pages/                   ← Route-level components (1 file = 1 route)
│   ├── LoginPage.tsx
│   ├── HomePage.tsx
│   ├── PlayerPage.tsx
│   ├── PartyPage.tsx
│   └── CreatorDashboardPage.tsx
│
├── features/                ← Feature modules (self-contained: UI + logic + types)
│   ├── auth/
│   │   ├── components/      ← LoginForm, OnboardingWizard
│   │   ├── hooks/           ← useAuth, useProtectedRoute
│   │   └── authSlice.ts     ← Zustand slice hoặc Redux slice
│   ├── player/
│   │   ├── components/      ← AudioPlayer, SeekBar, VolumeControl
│   │   ├── hooks/           ← useAudioPlayer, usePlaybackEvents
│   │   └── playerSlice.ts
│   ├── party/
│   │   ├── components/      ← PartyRoom, MemberList, HostControls
│   │   ├── hooks/           ← useListeningParty, useSignalR
│   │   └── partySlice.ts
│   └── recommendation/
│       ├── components/      ← RecommendationList, SongCard
│       ├── hooks/           ← useRecommendations
│       └── recommendationSlice.ts
│
├── components/              ← Shared, reusable, feature-agnostic UI
│   ├── ui/                  ← Button, Input, Modal, Spinner, Toast
│   └── layout/              ← AppShell, Navbar, Sidebar
│
├── services/                ← API call functions (thin wrappers over axios)
│   ├── api.ts               ← Axios instance + interceptors
│   ├── authService.ts
│   ├── recommendationService.ts
│   ├── streamingService.ts
│   └── partyService.ts
│
├── hooks/                   ← App-wide custom hooks (không thuộc feature nào)
│   └── useCorrelationId.ts
│
├── store/                   ← Global store setup
│   └── index.ts             ← Zustand stores composition
│
├── types/                   ← Shared TypeScript types/interfaces
│   ├── api.ts               ← ApiResponse<T>, ApiMeta, ApiError
│   └── domain.ts            ← Song, User, Party, Role
│
└── utils/                   ← Pure helper functions
    ├── errorMessages.ts     ← Error code → tiếng Việt mapping
    └── time.ts              ← Context detection (morning/evening...)
```

### Quy tắc đặt code

| Đặt ở đâu | Khi nào |
|---|---|
| `pages/` | Component gắn trực tiếp với 1 route; chỉ compose features + layout |
| `features/{name}/components/` | UI component chỉ có nghĩa trong feature đó |
| `components/` | UI component dùng lại ở nhiều features (Button, Modal...) |
| `features/{name}/hooks/` | Hook chứa logic gắn với feature (WebSocket, audio state) |
| `hooks/` | Hook dùng toàn app, không thuộc feature nào |
| `services/` | Hàm gọi API — không chứa React state hay hooks |
| `types/` | Type/interface dùng ở ≥ 2 features |

```
// ❌ Logic API trong component
function LoginPage() {
  const res = await axios.post('/api/v1/auth/login', data);  // ❌
}

// ✅ Gọi qua service
function LoginPage() {
  const res = await authService.login(data);  // ✅
}
```

---

## 2. API Integration

### Axios Instance

```typescript
// services/api.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

let accessToken: string | null = null;  // in-memory only
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,   // send HTTP-only cookie (refresh token)
  timeout: 10_000,
});

// Request interceptor: inject JWT + CorrelationId
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  config.headers['X-Correlation-Id'] = uuidv4();
  return config;
});

// Response interceptor: auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue subsequent requests until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<ApiResponse<{ accessToken: string }>>(
          `${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/refresh`,
          null,
          { withCredentials: true }
        );
        const newToken = data.data!.accessToken;
        setAccessToken(newToken);
        failedQueue.forEach(({ resolve }) => resolve(newToken));
        failedQueue = [];
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        failedQueue.forEach(({ reject }) => reject(refreshError));
        failedQueue = [];
        setAccessToken(null);
        window.location.href = '/login';  // force logout
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

### Response Type Mapping

```typescript
// types/api.ts
export interface ApiMeta {
  apiVersion: string;
  requestId: string;
  timestamp: string;
  cache?: 'HIT' | 'MISS';
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  meta: ApiMeta;
  error: ApiError | null;
}

// Service helper — unwrap hoặc throw
export async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const { data: res } = await promise;
  if (!res.success || res.data === null) {
    throw new AppError(res.error?.code ?? 'UNKNOWN_ERROR', res.error?.message ?? 'Unknown error');
  }
  return res.data;
}
```

### Error Code → User Message

```typescript
// utils/errorMessages.ts
const ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  ACCOUNT_LOCKED:           'Tài khoản tạm thời bị khóa. Vui lòng thử lại sau 15 phút.',
  TOKEN_REUSED:             'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  TOKEN_EXPIRED:            'Phiên đăng nhập đã hết hạn.',
  UNAUTHORIZED:             'Bạn cần đăng nhập để thực hiện thao tác này.',
  FORBIDDEN:                'Bạn không có quyền thực hiện thao tác này.',
  USER_NOT_FOUND:           'Không tìm thấy tài khoản.',
  VALIDATION_ERROR:         'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
  RATE_LIMIT_EXCEEDED:      'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
  IDEMPOTENCY_CONFLICT:     'Yêu cầu trùng lặp, bỏ qua.',
  SONG_NOT_FOUND:           'Không tìm thấy bài hát.',
  ROOM_NOT_FOUND:           'Không tìm thấy phòng nghe nhạc.',
  SERVICE_UNAVAILABLE:      'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.',
  INTERNAL_ERROR:           'Có lỗi xảy ra. Vui lòng thử lại sau.',
};

export class AppError extends Error {
  constructor(public code: string, public serverMessage: string) {
    super(ERROR_MESSAGES[code] ?? serverMessage);
    this.name = 'AppError';
  }

  get userMessage(): string {
    return ERROR_MESSAGES[this.code] ?? 'Có lỗi xảy ra. Vui lòng thử lại sau.';
  }
}

// Usage
try {
  await authService.login(data);
} catch (err) {
  if (err instanceof AppError) {
    toast.error(err.userMessage);   // hiện tiếng Việt
  }
}
```

---

## 3. Authentication Flow

### Token Storage (in-memory only)

```typescript
// ❌ KHÔNG lưu JWT vào localStorage hay sessionStorage
localStorage.setItem('token', accessToken);   // ❌ XSS risk

// ✅ In-memory trong api.ts module scope
setAccessToken(token);   // ✅ mất khi reload — refresh token cookie lo phần đó
```

### Auth Store (Zustand)

```typescript
// features/auth/authSlice.ts
import { create } from 'zustand';
import { setAccessToken } from '@/services/api';
import { authService } from '@/services/authService';

export type Role = 'Listener' | 'Creator' | 'Admin';

interface AuthState {
  userId: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;   // gọi khi app mount
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const { accessToken, userId, role } = await authService.login({ email, password });
    setAccessToken(accessToken);
    set({ userId, role, isAuthenticated: true });
  },

  logout: async () => {
    await authService.logout();
    setAccessToken(null);
    set({ userId: null, role: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    try {
      // Thử refresh — nếu có cookie hợp lệ thì lấy được token mới
      const { accessToken, userId, role } = await authService.refresh();
      setAccessToken(accessToken);
      set({ userId, role, isAuthenticated: true, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },
}));
```

### Protected Route

```typescript
// features/auth/hooks/useProtectedRoute.ts
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../authSlice';
import type { Role } from '../authSlice';

export function useProtectedRoute(requiredRole?: Role): void {
  const { isAuthenticated, role, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) { navigate('/login', { replace: true }); return; }
    if (requiredRole && role !== requiredRole) { navigate('/', { replace: true }); }
  }, [isAuthenticated, role, isLoading, requiredRole, navigate]);
}

// RBAC helper component
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const role = useAuthStore((s) => s.role);
  if (!role || !roles.includes(role)) return null;
  return <>{children}</>;
}

// Usage
function CreatorDashboardPage() {
  useProtectedRoute('Creator');  // redirect nếu không phải Creator
  return <Dashboard />;
}

// Hide UI element theo role
<RequireRole roles={['Creator', 'Admin']}>
  <UploadButton />
</RequireRole>
```

---

## 4. Audio Player

### HTML5 Audio + Pre-signed URL

```typescript
// features/player/hooks/useAudioPlayer.ts
import { useRef, useCallback, useEffect } from 'react';
import { usePlayerStore } from '../playerSlice';
import { recommendationService } from '@/services/recommendationService';

const PLAY_THRESHOLD  = 0.8;   // 80% → PLAY event
const SKIP_THRESHOLD  = 0.3;   // < 30% → SKIP event

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playEventSent = useRef(false);   // guard — gửi 1 lần per song
  const { currentSong, setPosition, setDuration } = usePlayerStore();

  // Browser tự handle HTTP Range Requests khi src là pre-signed URL
  // Không cần xử lý Range header thủ công
  const loadSong = useCallback((streamUrl: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    playEventSent.current = false;
    audio.src = streamUrl;
    audio.load();
    audio.play();
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = seconds;
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;

    const percent = audio.currentTime / audio.duration;
    setPosition(audio.currentTime);

    // PLAY event: chỉ gửi 1 lần khi vượt 80%
    if (percent >= PLAY_THRESHOLD && !playEventSent.current) {
      playEventSent.current = true;
      void sendFeedback('PLAY', percent * 100);
    }
  }, [currentSong]);

  const handleSkip = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong || playEventSent.current) return;

    const percent = audio.currentTime / audio.duration;
    if (percent < SKIP_THRESHOLD) {
      void sendFeedback('SKIP', percent * 100);
    }
    // Nếu skip sau 30% — không gửi event nào (đã "play" đủ)
  }, [currentSong]);

  async function sendFeedback(action: 'PLAY' | 'SKIP', durationPercent: number) {
    if (!currentSong) return;
    try {
      await recommendationService.postFeedback({
        eventId: crypto.randomUUID(),
        version: 'v1',
        songId: currentSong.id,
        action,
        durationPercent: Math.round(durationPercent * 100) / 100,
      });
    } catch {
      // Fire-and-forget: lỗi feedback không ảnh hưởng playback
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [handleTimeUpdate]);

  return { audioRef, loadSong, seek, handleSkip };
}
```

```tsx
// features/player/components/AudioPlayer.tsx
export function AudioPlayer() {
  const { audioRef, seek, handleSkip } = useAudioPlayer();

  return (
    <>
      <audio ref={audioRef} />
      <SeekBar onSeek={seek} />
      <button onClick={handleSkip}>Next</button>  {/* trigger handleSkip trước khi thay đổi src */}
    </>
  );
}
```

**Rules:**
- Không set `Range` header thủ công — browser tự xử lý khi `<audio src="...">` là pre-signed URL
- `playEventSent` ref reset về `false` khi load bài mới
- Feedback là fire-and-forget — lỗi không block playback

---

## 5. WebSocket — Listening Party

### SignalR Client Setup

```typescript
// features/party/hooks/useListeningParty.ts
import * as signalR from '@microsoft/signalr';
import { useEffect, useRef, useCallback } from 'react';
import { getAccessToken } from '@/services/api';
import { usePartyStore } from '../partySlice';

export function useListeningParty(roomId: string) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const retryCountRef = useRef(0);
  const { isHost, setSyncState, setConnected } = usePartyStore();

  const connect = useCallback(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_PARTY_HUB_URL}?roomId=${roomId}`, {
        accessTokenFactory: () => getAccessToken() ?? '',
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) => {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (cap)
          const delay = Math.min(1000 * Math.pow(2, ctx.previousRetryCount), 30_000);
          retryCountRef.current = ctx.previousRetryCount;
          return delay;
        },
      })
      .build();

    // Receive state sync từ server (triggered by Host's PLAYER_ACTION)
    connection.on('SYNC_STATE', (state: SyncState) => {
      setSyncState(state);
    });

    connection.onreconnecting(() => setConnected(false));
    connection.onreconnected(() => { setConnected(true); retryCountRef.current = 0; });
    connection.onclose(() => setConnected(false));

    connection.start().then(() => setConnected(true)).catch(console.error);
    connectionRef.current = connection;
  }, [roomId, setSyncState, setConnected]);

  // Host only: gửi PLAYER_ACTION lên server
  const sendPlayerAction = useCallback((action: PlayerAction) => {
    if (!isHost) return;  // Member không được gửi — reject ở client trước
    connectionRef.current?.invoke('PlayerAction', action).catch(console.error);
  }, [isHost]);

  useEffect(() => {
    connect();
    return () => { connectionRef.current?.stop(); };
  }, [connect]);

  return { sendPlayerAction, isHost };
}
```

### Party Store + Interfaces

```typescript
// features/party/partySlice.ts
import { create } from 'zustand';

export interface SyncState {
  currentSongId: string;
  positionSec: number;
  status: 'playing' | 'paused';
  trackTitle: string;
}

export interface PlayerAction {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'SKIP';
  positionSec?: number;
  songId?: string;
}

interface PartyState {
  roomId: string | null;
  isHost: boolean;
  isConnected: boolean;
  members: string[];
  syncState: SyncState | null;
  setSyncState: (s: SyncState) => void;
  setConnected: (v: boolean) => void;
}

export const usePartyStore = create<PartyState>((set) => ({
  roomId: null, isHost: false, isConnected: false,
  members: [], syncState: null,
  setSyncState: (syncState) => set({ syncState }),
  setConnected: (isConnected) => set({ isConnected }),
}));
```

```tsx
// Host controls — disable cho Member
function PlayerControls() {
  const { isHost, sendPlayerAction } = useListeningParty(roomId);

  return (
    <div>
      <button
        disabled={!isHost}              // ✅ Member thấy button nhưng disabled
        onClick={() => sendPlayerAction({ type: 'PLAY' })}
      >
        Play
      </button>
      {!isHost && <span>Chỉ Host mới điều khiển được nhạc</span>}
    </div>
  );
}
```

**Rules:**
- Token truyền qua `accessTokenFactory`, không hardcode vào URL
- `withAutomaticReconnect` với custom backoff — không tự implement retry loop
- Server sẽ reject `PlayerAction` từ Member, nhưng client phải guard trước (`if (!isHost) return`)

---

## 6. State Management

**Chọn Zustand** vì:
- Project nhỏ–vừa (3–4 người, 1 semester) — Redux Toolkit quá boilerplate
- Không cần time-travel debugging hay Redux DevTools phức tạp
- Zustand slice pattern đơn giản, dễ test, ít setup

```
❌ Context API cho global state    — re-render cả tree
❌ Redux Toolkit                   — over-engineered cho scope này
✅ Zustand                         — nhỏ gọn, TypeScript-first, selector tối ưu
```

### Store Structure

```typescript
// store/index.ts — re-export tất cả stores
export { useAuthStore }           from '@/features/auth/authSlice';
export { usePlayerStore }         from '@/features/player/playerSlice';
export { usePartyStore }          from '@/features/party/partySlice';
export { useRecommendationStore } from '@/features/recommendation/recommendationSlice';

// Player store example
interface PlayerState {
  currentSong: Song | null;
  streamUrl: string | null;
  position: number;         // giây
  duration: number;         // giây
  isPlaying: boolean;
  queue: Song[];
  playSong: (song: Song) => Promise<void>;
  setPosition: (pos: number) => void;
  setDuration: (dur: number) => void;
}

// Recommendation store example
interface RecommendationState {
  items: SongItem[];
  context: ContextType | null;
  isLoading: boolean;
  cacheStatus: 'HIT' | 'MISS' | null;
  fetchRecommendations: (context?: ContextType) => Promise<void>;
}
```

**Selector rule — tránh re-render thừa:**

```typescript
// ❌ Subscribe toàn bộ store — re-render khi bất kỳ field thay đổi
const store = usePlayerStore();

// ✅ Chỉ subscribe field cần thiết
const isPlaying = usePlayerStore((s) => s.isPlaying);
const currentSong = usePlayerStore((s) => s.currentSong);
```

---

## 7. TypeScript Conventions

### Interface vs Type Alias

```typescript
// ✅ interface: object shapes, domain models, có thể extend
interface Song {
  id: string;
  title: string;
  artistId: string;
  durationSec: number;
  thumbnailUrl: string;
}

interface StreamableSong extends Song {
  streamUrl: string;
}

// ✅ type: unions, intersections, utility types, function signatures
type ContextType = 'morning' | 'afternoon' | 'evening' | 'night';
type Role = 'Listener' | 'Creator' | 'Admin';
type FeedbackAction = 'PLAY' | 'SKIP';
type AsyncHandler<T> = (payload: T) => Promise<void>;
```

### Domain Types

```typescript
// types/domain.ts
export interface User {
  userId: string;
  displayName: string;
  email: string;          // chỉ dùng ở UI — không đưa vào log
  role: Role;
  avatarUrl: string | null;
}

export interface SongItem {
  songId: string;
  title: string;
  artist: string;
  thumbnail: string;
  reason: { type: 'CONTEXT' | 'PREFERENCE' | 'TRENDING'; text: string };
}

export interface FeedbackRequest {
  eventId: string;        // UUID v4
  version: 'v1';
  songId: string;
  action: FeedbackAction;
  durationPercent: number;
}
```

### Strict Mode

```json
// tsconfig.json — bắt buộc
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

```typescript
// ❌ Không dùng any
function process(data: any) { }   // ❌

// ✅ Generic hoặc unknown
function process<T>(data: T) { }
function handleError(err: unknown) {
  if (err instanceof AppError) { ... }
}

// ❌ Non-null assertion khi không chắc
const el = document.getElementById('root')!;   // ❌ nếu không chắc

// ✅ Null check rõ ràng
const el = document.getElementById('root');
if (!el) throw new Error('Root element not found');
```

---

## 8. Performance

### Code Splitting

```typescript
// pages — lazy load theo route
const LoginPage            = React.lazy(() => import('./pages/LoginPage'));
const PlayerPage           = React.lazy(() => import('./pages/PlayerPage'));
const PartyPage            = React.lazy(() => import('./pages/PartyPage'));
const CreatorDashboardPage = React.lazy(() => import('./pages/CreatorDashboardPage'));

// App router
function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login"     element={<LoginPage />} />
        <Route path="/"          element={<PlayerPage />} />
        <Route path="/party/:id" element={<PartyPage />} />
        <Route path="/creator"   element={<CreatorDashboardPage />} />
      </Routes>
    </Suspense>
  );
}
```

### Recommendation List Virtualization

```tsx
// Chỉ virtualize khi list > 50 items
import { useVirtualizer } from '@tanstack/react-virtual';

function RecommendationList({ songs }: { songs: SongItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: songs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,   // px per row
  });

  return (
    <div ref={parentRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <SongCard
            key={item.key}
            song={songs[item.index]!}
            style={{ transform: `translateY(${item.start}px)` }}
          />
        ))}
      </div>
    </div>
  );
}
```

### useMemo / useCallback Rules

```typescript
// ✅ useMemo: computed value từ props/state phức tạp
const sortedSongs = useMemo(
  () => [...songs].sort((a, b) => a.title.localeCompare(b.title)),
  [songs]
);

// ✅ useCallback: handler truyền xuống child component có memo
const handleSeek = useCallback((pos: number) => {
  audioRef.current!.currentTime = pos;
}, []);  // stable ref — không deps

// ❌ KHÔNG wrap mọi thứ bằng memo — overhead không cần thiết
const label = useMemo(() => `Hello`, []);   // ❌ string literal, không cần memo
```

---

## 9. Environment Variables

```bash
# .env.example
VITE_API_BASE_URL=http://localhost:5000          # API Gateway
VITE_PARTY_HUB_URL=http://localhost:5005/hubs/party
VITE_SERVICE_VERSION=1.0.0
```

```typescript
// Typed env access — tạo 1 lần, import ở nơi cần
// utils/env.ts
export const env = {
  apiBaseUrl:   import.meta.env.VITE_API_BASE_URL as string,
  partyHubUrl:  import.meta.env.VITE_PARTY_HUB_URL as string,
  version:      import.meta.env.VITE_SERVICE_VERSION as string,
} as const;
```

**Rules:**
- Dùng prefix `VITE_` (Vite) — không dùng `REACT_APP_` (CRA)
- Không commit `.env` — chỉ commit `.env.example`
- Không đặt secrets vào env frontend — env frontend là public

---

## 10. Test Structure

### Setup

```json
// package.json deps
"vitest": "^1.*",
"@testing-library/react": "^14.*",
"@testing-library/user-event": "^14.*",
"@testing-library/jest-dom": "^6.*",
"msw": "^2.*",          // mock API calls
"happy-dom": "^*"       // lightweight DOM
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
});

// src/tests/setup.ts
import '@testing-library/jest-dom';
```

### Test Audio Player Event Detection

```typescript
// features/player/hooks/useAudioPlayer.test.ts
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAudioPlayer } from './useAudioPlayer';
import * as recommendationService from '@/services/recommendationService';

vi.mock('@/services/recommendationService');

describe('useAudioPlayer — feedback events', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends PLAY event when progress reaches 80%', () => {
    const mockAudio = { currentTime: 160, duration: 200, src: '', load: vi.fn(), play: vi.fn() } as unknown as HTMLAudioElement;
    const postFeedback = vi.spyOn(recommendationService.recommendationService, 'postFeedback')
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useAudioPlayer());
    // Simulate timeupdate at 80%
    act(() => { result.current.audioRef.current = mockAudio; });
    // trigger handleTimeUpdate manually
    act(() => { (mockAudio as any).ontimeupdate?.(); });

    expect(postFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PLAY', durationPercent: expect.any(Number) })
    );
  });

  it('does NOT send PLAY event twice for same song', () => {
    const postFeedback = vi.spyOn(recommendationService.recommendationService, 'postFeedback')
      .mockResolvedValue(undefined);
    // trigger timeupdate twice at 80%+
    // ... assert called once
    expect(postFeedback).toHaveBeenCalledTimes(1);
  });

  it('sends SKIP event when skipping before 30%', () => {
    const mockAudio = { currentTime: 30, duration: 200 } as unknown as HTMLAudioElement;
    const postFeedback = vi.spyOn(recommendationService.recommendationService, 'postFeedback')
      .mockResolvedValue(undefined);

    const { result } = renderHook(() => useAudioPlayer());
    act(() => { result.current.audioRef.current = mockAudio; });
    act(() => { result.current.handleSkip(); });

    expect(postFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SKIP' })
    );
  });
});
```

### Test Axios Token Refresh Interceptor

```typescript
// services/api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { api, setAccessToken } from './api';

const mock = new MockAdapter(api);

describe('API interceptor — token refresh', () => {
  beforeEach(() => { mock.reset(); setAccessToken('expired-token'); });

  it('retries original request after successful refresh', async () => {
    mock.onPost('/api/v1/auth/refresh').replyOnce(200, {
      success: true,
      data: { accessToken: 'new-token' },
      meta: {}, error: null,
    });
    mock.onGet('/api/v1/users/me').replyOnce(401);
    mock.onGet('/api/v1/users/me').replyOnce(200, { success: true, data: { userId: '123' }, meta: {}, error: null });

    const res = await api.get('/api/v1/users/me');
    expect(res.data.data.userId).toBe('123');
  });

  it('redirects to /login when refresh fails', async () => {
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({ href: '' } as Location);
    mock.onPost('/api/v1/auth/refresh').replyOnce(401);
    mock.onGet('/api/v1/users/me').replyOnce(401);

    await expect(api.get('/api/v1/users/me')).rejects.toThrow();
  });
});
```

### Test SignalR Reconnect Logic

```typescript
// features/party/hooks/useListeningParty.test.ts
import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import * as signalR from '@microsoft/signalr';

vi.mock('@microsoft/signalr');

describe('useListeningParty — reconnect backoff', () => {
  it('uses exponential backoff capped at 30s', () => {
    const buildMock = vi.mocked(signalR.HubConnectionBuilder);
    // Capture the retryPolicy passed to withAutomaticReconnect
    let capturedPolicy: signalR.IRetryPolicy | undefined;
    buildMock.mockReturnValue({
      withUrl: vi.fn().mockReturnThis(),
      withAutomaticReconnect: vi.fn().mockImplementation((policy) => {
        capturedPolicy = policy;
        return { build: vi.fn().mockReturnValue({ on: vi.fn(), onreconnecting: vi.fn(), onreconnected: vi.fn(), onclose: vi.fn(), start: vi.fn().mockResolvedValue(undefined) }) };
      }),
    } as any);

    renderHook(() => require('./useListeningParty').useListeningParty('room-1'));

    expect(capturedPolicy?.nextRetryDelayInMilliseconds({ previousRetryCount: 0, elapsedMilliseconds: 0, retryReason: new Error() })).toBe(1000);
    expect(capturedPolicy?.nextRetryDelayInMilliseconds({ previousRetryCount: 1, elapsedMilliseconds: 0, retryReason: new Error() })).toBe(2000);
    expect(capturedPolicy?.nextRetryDelayInMilliseconds({ previousRetryCount: 5, elapsedMilliseconds: 0, retryReason: new Error() })).toBe(30_000);
  });

  it('blocks Member from sending PlayerAction', () => {
    // isHost = false → sendPlayerAction is no-op
    // ... assert invoke NOT called
  });
});
```

---

## ✅ Pre-output Checklist

Trước khi output code, Claude tự kiểm tra:

**Structure**
- [ ] Page component chỉ compose features + layout, không có business logic?
- [ ] API calls nằm trong `services/`, không inline trong component?
- [ ] Types dùng chung nằm trong `types/`, không định nghĩa trong component file?

**API Integration**
- [ ] Axios instance dùng `withCredentials: true` để gửi refresh cookie?
- [ ] `X-Correlation-Id` header được inject trong request interceptor?
- [ ] 401 interceptor guard `_retry` để tránh infinite loop?
- [ ] Tất cả error codes trong `ERROR_MESSAGES` map đủ theo API Design V2?

**Auth**
- [ ] Access token lưu in-memory (`setAccessToken`), không lưu `localStorage`?
- [ ] `restoreSession` được gọi khi app mount (trước khi render routes)?
- [ ] Protected routes dùng `useProtectedRoute` hook?
- [ ] RBAC dùng `RequireRole` component, không hardcode role string trong JSX?

**Audio Player**
- [ ] `playEventSent` ref reset về `false` khi load bài mới?
- [ ] PLAY event gửi khi `progress >= 80%` (0.8)?
- [ ] SKIP event gửi khi `progress < 30%` (0.3) lúc user bấm next?
- [ ] Feedback là fire-and-forget — lỗi không block playback?
- [ ] Không set `Range` header thủ công?

**WebSocket**
- [ ] Token truyền qua `accessTokenFactory`, không hardcode vào URL?
- [ ] `sendPlayerAction` guard `if (!isHost) return` ở phía client?
- [ ] Exponential backoff: 1s → 2s → 4s... cap 30s?

**TypeScript**
- [ ] `strict: true` trong `tsconfig.json`?
- [ ] Không có `any` — dùng `unknown` + type guard khi cần?
- [ ] `interface` cho object shapes, `type` cho unions/utilities?
- [ ] Env access qua `utils/env.ts`, không trực tiếp `import.meta.env` rải rác?

**State**
- [ ] Zustand selector chỉ subscribe field cần thiết, không subscribe toàn store?
- [ ] Không dùng Context API cho global state (auth, player)?

**Performance**
- [ ] Route-level components đều được `React.lazy` wrap?
- [ ] `useMemo`/`useCallback` chỉ dùng khi có lý do rõ ràng (không wrap tất cả)?

**Tests**
- [ ] Audio player tests test event detection logic, không test HTML audio behavior?
- [ ] Axios interceptor test có case: refresh thành công, refresh thất bại?
- [ ] Không dùng `any` trong test files?
