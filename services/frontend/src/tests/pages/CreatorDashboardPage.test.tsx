import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import CreatorDashboardPage from '../../pages/CreatorDashboardPage';
import { useAuthStore } from '../../store/authStore';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const HEATMAP_URL = 'http://localhost:5000/api/v1/analytics/creator/heatmap/:songId';
const STATS_URL = 'http://localhost:5000/api/v1/analytics/creator/stats/:songId';

const mockHeatmap = [
  { second: 0, skipRate: 0.1 },
  { second: 1, skipRate: 0.35 }, // red — skipRate > 0.3
  { second: 2, skipRate: 0.05 },
];

const mockStats = {
  totalPlays: 1500,
  totalSkips: 300,
  uniqueListeners: 800,
  avgListenPercent: 72.5,
};

const successHandlers = [
  http.get(HEATMAP_URL, () =>
    HttpResponse.json({
      success: true,
      data: { heatmap: mockHeatmap },
      meta: { apiVersion: 'v1', requestId: 'r1', timestamp: new Date().toISOString() },
      error: null,
    }),
  ),
  http.get(STATS_URL, () =>
    HttpResponse.json({
      success: true,
      data: mockStats,
      meta: { apiVersion: 'v1', requestId: 'r2', timestamp: new Date().toISOString() },
      error: null,
    }),
  ),
];

const server = setupServer(...successHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => { server.resetHandlers(); useAuthStore.setState({ accessToken: 'tok', userId: 'u1', role: 'Creator' }); });
afterAll(() => server.close());

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

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreatorDashboardPage', () => {
  describe('RBAC', () => {
    it('renders dashboard for Creator role', () => {
      setRole('Creator');
      renderPage();
      expect(screen.getByText('Creator Dashboard')).toBeInTheDocument();
    });

    it('renders dashboard for Admin role', () => {
      setRole('Admin');
      renderPage();
      expect(screen.getByText('Creator Dashboard')).toBeInTheDocument();
    });

    it('redirects Listener to / — AC RBAC', () => {
      // Given role = Listener → redirect, không render dashboard
      setRole('Listener');
      renderPage();
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  describe('Song ID search', () => {
    it('shows empty-state hint before any search', () => {
      setRole('Creator');
      renderPage();
      expect(screen.getByText(/Nhập Song ID ở trên/i)).toBeInTheDocument();
    });

    it('fetches heatmap and stats on form submit', async () => {
      setRole('Creator');
      renderPage();

      fireEvent.change(screen.getByLabelText('Song ID'), {
        target: { value: 'song-001' },
      });
      fireEvent.submit(screen.getByRole('button', { name: /Xem Analytics/i }).closest('form')!);

      await waitFor(() => {
        expect(screen.getByLabelText('Thống kê bài hát')).toBeInTheDocument();
      });

      // toLocaleString output varies by locale — just verify stats section is visible
      expect(screen.getByText('72.5%')).toBeInTheDocument(); // avgListenPercent
      expect(screen.getByText('Lượt nghe')).toBeInTheDocument();
      expect(screen.getByText('Lượt bỏ qua')).toBeInTheDocument();
    });

    it('shows heatmap with correct aria label', async () => {
      setRole('Creator');
      renderPage();

      fireEvent.change(screen.getByLabelText('Song ID'), { target: { value: 'song-001' } });
      fireEvent.submit(screen.getByRole('button', { name: /Xem Analytics/i }).closest('form')!);

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /Heatmap bỏ qua/i })).toBeInTheDocument();
      });
    });

    it('ignores submit when input is empty', () => {
      setRole('Creator');
      renderPage();

      fireEvent.submit(screen.getByRole('button', { name: /Xem Analytics/i }).closest('form')!);
      // activeSongId never set — no loading text, no API call
      expect(screen.queryByText('Đang tải...')).not.toBeInTheDocument();
    });
  });

  describe('Time range selector', () => {
    it('shows time range buttons after search', async () => {
      setRole('Creator');
      renderPage();

      fireEvent.change(screen.getByLabelText('Song ID'), { target: { value: 'song-001' } });
      fireEvent.submit(screen.getByRole('button', { name: /Xem Analytics/i }).closest('form')!);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /7 ngày/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /30 ngày/i })).toBeInTheDocument();
      });
    });

    it('switches to 30d and reloads data', async () => {
      setRole('Creator');
      renderPage();

      fireEvent.change(screen.getByLabelText('Song ID'), { target: { value: 'song-001' } });
      fireEvent.submit(screen.getByRole('button', { name: /Xem Analytics/i }).closest('form')!);

      await waitFor(() => screen.getByRole('button', { name: /30 ngày/i }));

      fireEvent.click(screen.getByRole('button', { name: /30 ngày/i }));

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /30 ngày/i });
        expect(btn).toHaveAttribute('aria-pressed', 'true');
      });
    });
  });

  describe('Error state', () => {
    it('shows error message when API fails', async () => {
      server.use(
        http.get(HEATMAP_URL, () => HttpResponse.json({ success: false }, { status: 500 })),
      );
      setRole('Creator');
      renderPage();

      fireEvent.change(screen.getByLabelText('Song ID'), { target: { value: 'bad-id' } });
      fireEvent.submit(screen.getByRole('button', { name: /Xem Analytics/i }).closest('form')!);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByText(/Không thể tải dữ liệu/i)).toBeInTheDocument();
    });
  });
});
