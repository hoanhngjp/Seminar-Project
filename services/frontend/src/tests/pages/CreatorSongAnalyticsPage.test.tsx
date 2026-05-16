import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import CreatorSongAnalyticsPage from '../../pages/creator/CreatorSongAnalyticsPage';
import { useAuthStore } from '../../store/authStore';

// ── Service mocks ─────────────────────────────────────────────────────────────

const { MOCK_SONG_META, MOCK_HEATMAP, MOCK_STATS } = vi.hoisted(() => ({
  MOCK_SONG_META: {
    id: 'song-001',
    title: 'Lạc Trôi',
    coverUrl: 'https://picsum.photos/seed/lactroi/300/300',
    genreName: 'V-Pop',
  },
  MOCK_HEATMAP: Array.from({ length: 20 }, (_, i) => ({
    positionPercent: i * 5,
    dropOffRate: 0.1,
  })),
  MOCK_STATS: {
    uniqueUsers: 1200,
    completionRate: 0.72,
    dailyListeners: Array.from({ length: 7 }, (_, i) => ({
      date: `2024-01-0${i + 1}`,
      count: 100 + i * 10,
    })),
  },
}));

vi.mock('../../services/musicService', () => ({
  getSong: vi.fn().mockResolvedValue(MOCK_SONG_META),
  getArtist: vi.fn(),
  getMySongs: vi.fn(),
}));

vi.mock('../../services/analyticsService', () => ({
  fetchHeatmap: vi.fn().mockResolvedValue(MOCK_HEATMAP),
  fetchSongStats: vi.fn().mockResolvedValue(MOCK_STATS),
}));

// ── Component mocks ───────────────────────────────────────────────────────────

vi.mock('../../components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('../../features/creator/components/TimeRangeSelector', () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: '7d' | '30d') => void }) => (
    <div data-testid="time-range-selector">
      <button onClick={() => onChange('7d')} data-testid="btn-7d" aria-pressed={value === '7d'}>7 ngày</button>
      <button onClick={() => onChange('30d')} data-testid="btn-30d" aria-pressed={value === '30d'}>30 ngày</button>
    </div>
  ),
}));

vi.mock('../../features/creator/components/SongStatsCard', () => ({
  default: ({ icon, label, value }: { icon: string; label: string; value: string }) => (
    <div data-testid={`stats-card-${icon}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

vi.mock('../../features/creator/components/DailyListenersChart', () => ({
  default: ({ data }: { data: unknown[] }) => <div data-testid="daily-chart" data-count={data.length} />,
}));

vi.mock('../../features/creator/components/HeatmapChart', () => ({
  default: ({ data }: { data: unknown[] }) => <div data-testid="heatmap-chart" data-count={data.length} />,
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../../store/playerStore', () => ({
  usePlayerStore: vi.fn(() => null),
}));

// ── Setup ─────────────────────────────────────────────────────────────────────

function setupRole(role: string) {
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ role, userId: 'user-001', accessToken: 'tok', hasCompletedOnboarding: true })
  );
}

function renderPage(initialPath = '/dashboard/songs/song-001') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/dashboard/songs/:songId" element={<CreatorSongAnalyticsPage />} />
        <Route path="/" element={<div data-testid="home" />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreatorSongAnalyticsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('Role guard', () => {
    it('redirects Listener to /', () => {
      setupRole('Listener');
      renderPage();
      expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
    });

    it('renders for Creator role', () => {
      setupRole('Creator');
      renderPage();
      expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    });

    it('renders for Admin role', () => {
      setupRole('Admin');
      renderPage();
      expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    beforeEach(() => setupRole('Creator'));

    it('renders breadcrumb with dashboard link', () => {
      renderPage();
      const breadcrumb = screen.getByTestId('breadcrumb');
      expect(breadcrumb).toBeInTheDocument();
      expect(breadcrumb).toHaveTextContent('Dashboard');
    });

    it('renders breadcrumb with song title after load', async () => {
      renderPage();
      await screen.findAllByText('Lạc Trôi');
      expect(screen.getByTestId('breadcrumb')).toHaveTextContent('Lạc Trôi');
    });

    it('renders song info card', () => {
      renderPage();
      expect(screen.getByTestId('song-info-card')).toBeInTheDocument();
    });

    it('shows song title in info card after load', async () => {
      renderPage();
      await screen.findAllByText('Lạc Trôi');
      expect(screen.getByTestId('song-info-card')).toHaveTextContent('Lạc Trôi');
    });

    it('shows genre badge in info card after load', async () => {
      renderPage();
      expect(await screen.findByText('V-Pop')).toBeInTheDocument();
      expect(screen.getByTestId('song-info-card')).toHaveTextContent('V-Pop');
    });

    it('renders time range selector', () => {
      renderPage();
      expect(screen.getByTestId('time-range-selector')).toBeInTheDocument();
    });

    it('defaults time range to 7d', () => {
      renderPage();
      expect(screen.getByTestId('btn-7d')).toHaveAttribute('aria-pressed', 'true');
    });

    it('switching time range updates selector', () => {
      renderPage();
      fireEvent.click(screen.getByTestId('btn-30d'));
      expect(screen.getByTestId('btn-30d')).toHaveAttribute('aria-pressed', 'true');
    });

    it('renders KPI grid with 3 cards after load', async () => {
      renderPage();
      expect(await screen.findByTestId('kpi-grid')).toBeInTheDocument();
      expect(screen.getByTestId('stats-card-headphones')).toBeInTheDocument();
      expect(screen.getByTestId('stats-card-person')).toBeInTheDocument();
      expect(screen.getByTestId('stats-card-task_alt')).toBeInTheDocument();
    });

    it('shows Lượt nghe card after load', async () => {
      renderPage();
      expect(await screen.findByTestId('stats-card-headphones')).toHaveTextContent('Lượt nghe');
    });

    it('shows Người nghe card after load', async () => {
      renderPage();
      expect(await screen.findByTestId('stats-card-person')).toHaveTextContent('Người nghe');
    });

    it('shows Tỉ lệ hoàn thành card after load', async () => {
      renderPage();
      expect(await screen.findByTestId('stats-card-task_alt')).toHaveTextContent('Tỉ lệ hoàn thành');
    });

    it('renders daily chart section after load', async () => {
      renderPage();
      expect(await screen.findByTestId('daily-chart-section')).toBeInTheDocument();
      expect(screen.getByTestId('daily-chart')).toBeInTheDocument();
    });

    it('passes 7 daily stats to DailyListenersChart after load', async () => {
      renderPage();
      const chart = await screen.findByTestId('daily-chart');
      expect(chart).toHaveAttribute('data-count', '7');
    });

    it('renders heatmap section after load', async () => {
      renderPage();
      expect(await screen.findByTestId('heatmap-section')).toBeInTheDocument();
      expect(screen.getByTestId('heatmap-chart')).toBeInTheDocument();
    });

    it('passes 20 heatmap items to HeatmapChart after load', async () => {
      renderPage();
      const chart = await screen.findByTestId('heatmap-chart');
      expect(chart).toHaveAttribute('data-count', '20');
    });
  });
});
