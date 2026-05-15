import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreatorSongAnalyticsPage from '../../pages/creator/CreatorSongAnalyticsPage';
import { useAuthStore } from '../../store/authStore';

// ── Mocks ──────────────────────────────────────────────────────────────────────

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

function setupRole(role: string) {
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ role, userId: 'user-001', accessToken: 'tok', hasCompletedOnboarding: true })
  );
}

function renderPage(initialPath = '/dashboard/songs/song-001') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CreatorSongAnalyticsPage />
    </MemoryRouter>
  );
}

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

    it('renders breadcrumb with song title', () => {
      renderPage();
      expect(screen.getByTestId('breadcrumb')).toHaveTextContent('Lạc Trôi');
    });

    it('renders song info card', () => {
      renderPage();
      expect(screen.getByTestId('song-info-card')).toBeInTheDocument();
    });

    it('shows song title in info card', () => {
      renderPage();
      expect(screen.getByTestId('song-info-card')).toHaveTextContent('Lạc Trôi');
    });

    it('shows genre badge in info card', () => {
      renderPage();
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

    it('renders KPI grid with 3 cards', () => {
      renderPage();
      expect(screen.getByTestId('kpi-grid')).toBeInTheDocument();
      expect(screen.getByTestId('stats-card-headphones')).toBeInTheDocument();
      expect(screen.getByTestId('stats-card-person')).toBeInTheDocument();
      expect(screen.getByTestId('stats-card-task_alt')).toBeInTheDocument();
    });

    it('shows Lượt nghe card', () => {
      renderPage();
      expect(screen.getByTestId('stats-card-headphones')).toHaveTextContent('Lượt nghe');
    });

    it('shows Người nghe card', () => {
      renderPage();
      expect(screen.getByTestId('stats-card-person')).toHaveTextContent('Người nghe');
    });

    it('shows Tỉ lệ hoàn thành card', () => {
      renderPage();
      expect(screen.getByTestId('stats-card-task_alt')).toHaveTextContent('Tỉ lệ hoàn thành');
    });

    it('renders daily chart section', () => {
      renderPage();
      expect(screen.getByTestId('daily-chart-section')).toBeInTheDocument();
      expect(screen.getByTestId('daily-chart')).toBeInTheDocument();
    });

    it('passes MOCK_DAILY_STATS to DailyListenersChart', () => {
      renderPage();
      expect(screen.getByTestId('daily-chart')).toHaveAttribute('data-count', '7');
    });

    it('renders heatmap section', () => {
      renderPage();
      expect(screen.getByTestId('heatmap-section')).toBeInTheDocument();
      expect(screen.getByTestId('heatmap-chart')).toBeInTheDocument();
    });

    it('passes MOCK_HEATMAP to HeatmapChart', () => {
      renderPage();
      expect(screen.getByTestId('heatmap-chart')).toHaveAttribute('data-count', '20');
    });
  });
});
