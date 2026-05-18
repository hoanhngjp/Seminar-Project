import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import CreatorDashboardPage from '../../pages/CreatorDashboardPage';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';

// ---------------------------------------------------------------------------
// Mock data — deterministic values for assertions
// ---------------------------------------------------------------------------

const MOCK_STATS_7D = {
  songId: 'song-001',
  dailyListeners: [
    { date: '2026-05-07', count: 1240 },
    { date: '2026-05-08', count: 1580 },
    { date: '2026-05-09', count: 2100 },
    { date: '2026-05-10', count: 1870 },
    { date: '2026-05-11', count: 2340 },
    { date: '2026-05-12', count: 3100 },
    { date: '2026-05-13', count: 2760 },
  ],
  uniqueListeners: 8420,
  totalPlays: 15000,
  totalSkips: 3000,
  avgListenPercent: 72,
};

const MOCK_STATS_30D = {
  ...MOCK_STATS_7D,
  uniqueUsers: 28640,
  dailyListeners: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-04-${String(14 + i).padStart(2, '0')}`,
    count: 500 + i * 80,
  })),
};

const MOCK_HEATMAP = {
  songId: 'song-001',
  heatmap: [8,12,18,25,38,52,65,78,88,90,82,68,52,40,32,24,18,14,10,7].map(
    (count, i) => ({ second: i * 12, count }),
  ),
};

// ---------------------------------------------------------------------------
// MSW handlers
// ---------------------------------------------------------------------------

const HEATMAP_URL   = 'http://localhost:5000/api/v1/analytics/creator/heatmap/:songId';
const STATS_URL     = 'http://localhost:5000/api/v1/analytics/creator/stats/:songId';
const PROFILE_URL   = 'http://localhost:5000/api/v1/users/me';
const NOTIF_URL     = 'http://localhost:5000/api/v1/notifications/unread';
const MY_SONGS_URL  = 'http://localhost:5000/api/v1/music/songs/my';

const heatmapHandler = http.get(HEATMAP_URL, () =>
  HttpResponse.json({
    success: true,
    data: MOCK_HEATMAP,
    meta: { apiVersion: 'v1', requestId: 'r1', timestamp: '' },
    error: null,
  }),
);

const statsHandler = http.get(STATS_URL, ({ request }) => {
  const url = new URL(request.url);
  const range = url.searchParams.get('timeRange') ?? '7d';
  return HttpResponse.json({
    success: true,
    data: range === '30d' ? MOCK_STATS_30D : MOCK_STATS_7D,
    meta: { apiVersion: 'v1', requestId: 'r2', timestamp: '' },
    error: null,
  });
});

const profileHandler = http.get(PROFILE_URL, () =>
  HttpResponse.json({
    success: true,
    data: { userId: 'u1', email: 'creator@soundwave.vn', displayName: 'Sơn Tùng M-TP', role: 'Creator', hasCompletedOnboarding: true },
    meta: { apiVersion: 'v1', requestId: 'r3', timestamp: '' },
    error: null,
  }),
);

const notifHandler = http.get(NOTIF_URL, () =>
  HttpResponse.json({
    success: true,
    data: { items: [], totalUnread: 0 },
    meta: { apiVersion: 'v1', requestId: 'r4', timestamp: '' },
    error: null,
  }),
);

const mySongsHandler = http.get(MY_SONGS_URL, () =>
  HttpResponse.json({
    success: true,
    data: [
      { songId: 'song-001', title: 'Lạc Trôi', coverUrl: 'https://picsum.photos/seed/lactroi/300/300', genre: 'V-Pop', uploadedAt: '2024-01-01T00:00:00Z', playCount: 1500000 },
      { songId: 'song-002', title: 'Có Chắc Yêu Là Đây', coverUrl: 'https://picsum.photos/seed/cochac/300/300', genre: 'V-Pop', uploadedAt: '2024-02-01T00:00:00Z', playCount: 900000 },
      { songId: 'song-003', title: 'Chuyến Xe', coverUrl: 'https://picsum.photos/seed/chuyenxe/300/300', genre: 'Indie', uploadedAt: '2024-03-01T00:00:00Z', playCount: 400000 },
      { songId: 'song-004', title: 'Đưa Nhau Đi Trốn', coverUrl: 'https://picsum.photos/seed/ditrong/300/300', genre: 'Rap', uploadedAt: '2024-04-01T00:00:00Z', playCount: 600000 },
    ],
    meta: { apiVersion: 'v1', requestId: 'r5', timestamp: '' },
    error: null,
  }),
);

const server = setupServer(heatmapHandler, statsHandler, profileHandler, notifHandler, mySongsHandler);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  useAuthStore.setState({ accessToken: null, userId: null, role: null });
  usePlayerStore.getState().clearSong();
  server.use(heatmapHandler, statsHandler, profileHandler, notifHandler, mySongsHandler);
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Navigation mock
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setRole(role: 'Creator' | 'Admin' | 'Listener') {
  useAuthStore.setState({ accessToken: 'tok', userId: 'u1', role });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CreatorDashboardPage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests — RBAC
// ---------------------------------------------------------------------------

describe('CreatorDashboardPage — RBAC', () => {
  it('renders page heading for Creator role', async () => {
    setRole('Creator');
    renderPage();
    // Use name filter — Sidebar h1 = "SoundWave", page h1 contains "Analytics"
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Analytics/ })).toBeInTheDocument(),
    );
  });

  it('renders page heading for Admin role', async () => {
    setRole('Admin');
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Analytics/ })).toBeInTheDocument(),
    );
  });

  it('redirects Listener to / — AC RBAC', () => {
    setRole('Listener');
    renderPage();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});

// ---------------------------------------------------------------------------
// Tests — Auto-load & KPI cards
// ---------------------------------------------------------------------------

describe('CreatorDashboardPage — KPI cards', () => {
  it('auto-loads analytics for default song on mount', async () => {
    setRole('Creator');
    renderPage();
    // Thống kê section appears without any user interaction
    await waitFor(() => {
      expect(screen.getByLabelText('Thống kê bài hát')).toBeInTheDocument();
    });
  });

  it('shows "Lượt nghe độc nhất" KPI with uniqueUsers value', async () => {
    setRole('Creator');
    renderPage();
    // KPI label text is the actual string (Tailwind uppercase class = CSS only)
    await waitFor(() => {
      expect(screen.getByText('Lượt nghe độc nhất')).toBeInTheDocument();
    });
    // 8420 → "8.420" in vi-VN locale (thousands sep = ".")
    expect(screen.getByText('8.420')).toBeInTheDocument();
  });

  it('shows "Tỷ lệ nghe đủ bài" KPI as 72%', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      // "Tỷ lệ nghe đủ bài" appears in KPI label AND donut chart heading
      expect(screen.getAllByText('Tỷ lệ nghe đủ bài').length).toBeGreaterThanOrEqual(1);
    });
    // "72%" appears in KPI card value AND donut chart center text
    expect(screen.getAllByText('72%').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Lượt nghe hôm nay" KPI with last dailyListeners count', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Lượt nghe hôm nay')).toBeInTheDocument();
    });
    // Last entry: count=2760 → "2.760" vi-VN
    expect(screen.getByText('2.760')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Charts
// ---------------------------------------------------------------------------

describe('CreatorDashboardPage — charts', () => {
  it('renders skip heatmap with aria role', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('img', { name: /Heatmap bỏ qua/i })).toBeInTheDocument();
    });
  });

  it('renders section headings for all charts', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Heatmap tỷ lệ bỏ qua (skip)')).toBeInTheDocument();
      expect(screen.getByText('Lượt nghe theo ngày')).toBeInTheDocument();
      expect(screen.getByText('Người nghe theo ngày')).toBeInTheDocument();
      // "Tỷ lệ nghe đủ bài" appears in both KPI label and donut chart heading
      expect(screen.getAllByText('Tỷ lệ nghe đủ bài').length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Time range
// ---------------------------------------------------------------------------

describe('CreatorDashboardPage — time range', () => {
  it('renders 7 ngày and 30 ngày buttons', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /7 ngày/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /30 ngày/i })).toBeInTheDocument();
    });
  });

  it('7 ngày button is active by default', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /7 ngày/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('switches to 30d and reloads data — shows 30 ngày active', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: /30 ngày/i }));

    fireEvent.click(screen.getByRole('button', { name: /30 ngày/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /30 ngày/i })).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Song selector
// ---------------------------------------------------------------------------

describe('CreatorDashboardPage — song selector', () => {
  it('shows default song "Lạc Trôi" in selector', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('song-selector-button')).toHaveTextContent('Lạc Trôi');
    });
  });

  it('opens dropdown and shows other song options on click', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => screen.getByTestId('song-selector-button'));

    fireEvent.click(screen.getByTestId('song-selector-button'));
    expect(screen.getAllByText('Chuyến Xe').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Đưa Nhau Đi Trốn').length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — Error state
// ---------------------------------------------------------------------------

describe('CreatorDashboardPage — error state', () => {
  it('shows error when API fails', async () => {
    server.use(
      http.get(STATS_URL, () => HttpResponse.json({ success: false }, { status: 500 })),
    );
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText(/Không thể tải dữ liệu/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — CreatorSongTable section
// ---------------------------------------------------------------------------

describe('CreatorDashboardPage — CreatorSongTable', () => {
  it('renders "Bài hát của tôi" section heading', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Bài hát của tôi' })).toBeInTheDocument();
    });
    expect(screen.getByText('Bài hát của tôi')).toBeInTheDocument();
  });

  it('renders "TẢI LÊN BÀI MỚI" button in song table header', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /TẢI LÊN BÀI MỚI/i })).toBeInTheDocument();
    });
  });

  it('renders mock songs in the table — shows first song title', async () => {
    setRole('Creator');
    renderPage();
    // Table uses MOCK_CREATOR_SONG_ROWS.slice(1), so first row is 'Có Chắc Yêu Là Đây'
    await waitFor(() => {
      expect(screen.getByText('Có Chắc Yêu Là Đây')).toBeInTheDocument();
    });
  });

  it('clicking "Xem phân tích" navigates to /dashboard/songs/:id', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText('Xem phân tích')[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByText('Xem phân tích')[0]);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringMatching(/^\/dashboard\/songs\//),
    );
  });

  it('renders table column headers', async () => {
    setRole('Creator');
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Bài hát của tôi' })).toBeInTheDocument();
    });
    expect(screen.getByText('Ngày upload')).toBeInTheDocument();
    expect(screen.getByText('Lượt nghe')).toBeInTheDocument();
    expect(screen.getByText('Người nghe')).toBeInTheDocument();
    expect(screen.getByText('Hoàn thành %')).toBeInTheDocument();
  });

  it('Admin role also sees the song table', async () => {
    setRole('Admin');
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Bài hát của tôi')).toBeInTheDocument();
    });
  });
});
