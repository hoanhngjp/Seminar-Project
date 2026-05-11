import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import HomePage from '../../pages/HomePage';
import { useAuthStore } from '../../store/authStore';
import { getTimeContext } from '../../api/recommendationApi';

// ---------------------------------------------------------------------------
// MSW server — intercept axios calls to http://localhost:5000
// ---------------------------------------------------------------------------

const RECOMMENDATIONS_URL = 'http://localhost:5000/api/v1/recommendations';
const STREAMING_URL = 'http://localhost:5000/api/v1/streaming/:songId/url';

// Mock data matches Python FastAPI response shape (snake_case)
const mockItems = [
  {
    song_id: 'song-001',
    title: 'Lạc Trôi',
    artist: 'Sơn Tùng M-TP',
    thumbnail: '',
    reason: { type: 'CONTEXT', text: 'Phù hợp buổi sáng' },
  },
  {
    song_id: 'song-002',
    title: 'Có Chắc Yêu Là Đây',
    artist: 'Sơn Tùng M-TP',
    thumbnail: '',
    reason: { type: 'TRENDING', text: 'Trending' },
  },
  {
    song_id: 'song-003',
    title: 'Ngày Mai',
    artist: 'Vũ.',
    thumbnail: '',
    reason: { type: 'TRENDING', text: '' },
  },
];

const successHandler = http.get(RECOMMENDATIONS_URL, () =>
  HttpResponse.json({
    success: true,
    data: { items: mockItems },
    meta: { apiVersion: 'v1', requestId: 'test-req', timestamp: new Date().toISOString() },
    error: null,
  }),
);

const errorHandler = http.get(RECOMMENDATIONS_URL, () =>
  HttpResponse.json(
    {
      success: false,
      data: null,
      meta: { apiVersion: 'v1', requestId: 'test-req', timestamp: new Date().toISOString() },
      error: { code: 'INTERNAL_ERROR', message: 'Server error' },
    },
    { status: 500 },
  ),
);

const NOTIFICATIONS_URL = 'http://localhost:5000/api/v1/notifications/unread';
const notificationsHandler = http.get(NOTIFICATIONS_URL, () => HttpResponse.json({
  success: true,
  data: { items: [], totalUnread: 0 },
  error: null,
}));

const server = setupServer(successHandler, notificationsHandler);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  // Reset Zustand store between tests
  useAuthStore.setState({ accessToken: null, userId: null, role: null });
  // Add fallback for notifications when resetHandlers happens
  server.use(notificationsHandler);
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper: render with auth token set
// ---------------------------------------------------------------------------

function renderAuthenticated() {
  useAuthStore.setState({
    accessToken: 'mock-token',
    userId: 'user-001',
    role: 'Listener',
  });
  return render(
    <MemoryRouter initialEntries={['/']}>
      <HomePage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomePage', () => {
  // ─── Auth redirect ───────────────────────────────────────────────────────

  it('redirects to /login when not authenticated', () => {
    // No token set — useAuthStore has accessToken: null
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>,
    );
    // Component returns null and triggers navigate('/login')
    // The rendered output should be empty (null returned before render)
    expect(container).toBeEmptyDOMElement();
  });

  // ─── Loading state ───────────────────────────────────────────────────────

  it('shows loading skeleton while fetching', () => {
    renderAuthenticated();
    // Skeleton grid should be present immediately before fetch resolves
    expect(screen.getByLabelText('Đang tải danh sách nhạc')).toBeInTheDocument();
  });

  // ─── Happy path ──────────────────────────────────────────────────────────

  it('renders recommendation list after successful fetch', async () => {
    renderAuthenticated();

    await waitFor(() => {
      expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    });

    expect(screen.getByText('Có Chắc Yêu Là Đây')).toBeInTheDocument();
    expect(screen.getByText('Ngày Mai')).toBeInTheDocument();
  });

  it('renders artist names for each song', async () => {
    renderAuthenticated();

    await waitFor(() => {
      expect(screen.getAllByText('Sơn Tùng M-TP')).toHaveLength(2);
    });
    expect(screen.getByText('Vũ.')).toBeInTheDocument();
  });

  it('renders explainText badge when present', async () => {
    renderAuthenticated();

    await waitFor(() => {
      expect(screen.getByText('Phù hợp buổi sáng')).toBeInTheDocument();
    });
    expect(screen.getByText('Trending')).toBeInTheDocument();
  });

  it('does NOT render explainText badge when field is empty', async () => {
    renderAuthenticated();

    await waitFor(() => {
      expect(screen.getByText('Ngày Mai')).toBeInTheDocument();
    });
    // mockItems has 3 songs: 2 with non-empty explainText, 1 with ''
    // Only 2 badge spans should be rendered
    const badges = screen.getAllByTestId('explain-badge');
    expect(badges).toHaveLength(2);
  });

  // ─── Click → AudioPlayer mounts ──────────────────────────────────────────

  it('mounts AudioPlayer when a song card is clicked', async () => {
    // Also stub the streaming URL so AudioPlayer doesn't throw
    server.use(
      http.get(STREAMING_URL, () =>
        HttpResponse.json({
          success: true,
          data: { url: 'http://cdn.example.com/song-001.mp3', expiresIn: 900 },
          meta: { apiVersion: 'v1', requestId: 'x', timestamp: '' },
          error: null,
        }),
      ),
    );

    renderAuthenticated();

    await waitFor(() => {
      expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Phát Lạc Trôi — Sơn Tùng M-TP'));

    // PlayerBar should appear containing the close button
    expect(screen.getByLabelText('Đóng player')).toBeInTheDocument();
  });

  it('closes AudioPlayer when close button is clicked', async () => {
    server.use(
      http.get(STREAMING_URL, () =>
        HttpResponse.json({
          success: true,
          data: { url: 'http://cdn.example.com/song-001.mp3', expiresIn: 900 },
          meta: { apiVersion: 'v1', requestId: 'x', timestamp: '' },
          error: null,
        }),
      ),
    );

    renderAuthenticated();

    await waitFor(() => {
      expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Phát Lạc Trôi — Sơn Tùng M-TP'));
    expect(screen.getByLabelText('Đóng player')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Đóng player'));
    await waitFor(() => {
      expect(screen.queryByLabelText('Đóng player')).not.toBeInTheDocument();
    });
  });

  // ─── Error state ─────────────────────────────────────────────────────────

  it('shows error message when API returns 500', async () => {
    server.use(errorHandler);
    renderAuthenticated();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Không thể tải gợi ý. Thử lại.')).toBeInTheDocument();
    expect(screen.getByText('Thử lại')).toBeInTheDocument();
  });

  it('retry button re-fetches recommendations', async () => {
    // First call fails, second succeeds
    let callCount = 0;
    server.use(
      http.get(RECOMMENDATIONS_URL, () => {
        callCount += 1;
        if (callCount === 1) {
          return HttpResponse.json(
            { success: false, data: null, meta: {}, error: { code: 'INTERNAL_ERROR', message: '' } },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          success: true,
          data: { items: mockItems },
          meta: { apiVersion: 'v1', requestId: 'r2', timestamp: '' },
          error: null,
        });
      }),
    );

    renderAuthenticated();

    await waitFor(() => {
      expect(screen.getByText('Thử lại')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Thử lại'));

    await waitFor(() => {
      expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    });
    expect(callCount).toBe(2);
  });

  // ─── Empty state ─────────────────────────────────────────────────────────

  it('shows empty state when API returns empty list', async () => {
    server.use(
      http.get(RECOMMENDATIONS_URL, () =>
        HttpResponse.json({
          success: true,
          data: { items: [] },
          meta: { apiVersion: 'v1', requestId: 'e', timestamp: '' },
          error: null,
        }),
      ),
    );

    renderAuthenticated();

    await waitFor(() => {
      expect(
        screen.getByText('Không có gợi ý. Hãy nghe nhạc để cá nhân hoá!'),
      ).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// getTimeContext unit tests
// ---------------------------------------------------------------------------

describe('getTimeContext', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns "morning" for hour 6–11', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(8);
    expect(getTimeContext()).toBe('morning');
  });

  it('returns "morning" at boundary hour 6', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(6);
    expect(getTimeContext()).toBe('morning');
  });

  it('returns "morning" at boundary hour 11', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(11);
    expect(getTimeContext()).toBe('morning');
  });

  it('returns "evening" for hour 18–21', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(19);
    expect(getTimeContext()).toBe('evening');
  });

  it('returns "evening" at boundary hour 18', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(18);
    expect(getTimeContext()).toBe('evening');
  });

  it('returns "none" for hour 0–5', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(3);
    expect(getTimeContext()).toBe('none');
  });

  it('returns "none" for hour 12–17 (afternoon)', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
    expect(getTimeContext()).toBe('none');
  });

  it('returns "none" for hour 22–23 (late night)', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(23);
    expect(getTimeContext()).toBe('none');
  });
});
