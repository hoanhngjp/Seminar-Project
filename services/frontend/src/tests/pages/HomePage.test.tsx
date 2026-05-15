import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import HomePage from '../../pages/HomePage';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';
import { getTimeContext } from '../../utils/time';

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

const RECOMMENDATIONS_URL = 'http://localhost:5000/api/v1/recommendations';
const STREAMING_URL       = 'http://localhost:5000/api/v1/streaming/:songId/url';
const NOTIFICATIONS_URL   = 'http://localhost:5000/api/v1/notifications/unread';
const PROFILE_URL         = 'http://localhost:5000/api/v1/users/me';

// ---------------------------------------------------------------------------
// Mock data — items distributed across 3 reason types
// ---------------------------------------------------------------------------

const mockItems = [
  {
    song_id: 'song-001',
    title:   'Lạc Trôi',
    artist:  'Sơn Tùng M-TP',
    thumbnail: '',
    reason:  { type: 'CONTEXT', text: 'Phù hợp buổi sáng' },
  },
  {
    song_id: 'song-002',
    title:   'Có Chắc Yêu Là Đây',
    artist:  'Sơn Tùng M-TP',
    thumbnail: '',
    reason:  { type: 'TRENDING', text: 'Trending' },
  },
  {
    song_id: 'song-003',
    title:   'Ngày Mai',
    artist:  'Vũ.',
    thumbnail: '',
    reason:  { type: 'PREFERENCE', text: '' },
  },
];

// ---------------------------------------------------------------------------
// MSW handlers
// ---------------------------------------------------------------------------

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

const notificationsHandler = http.get(NOTIFICATIONS_URL, () =>
  HttpResponse.json({
    success: true,
    data: { items: [], totalUnread: 0 },
    meta: { apiVersion: 'v1', requestId: 'r2', timestamp: '' },
    error: null,
  }),
);

const profileHandler = http.get(PROFILE_URL, () =>
  HttpResponse.json({
    success: true,
    data: { userId: 'u1', email: 'test@example.com', displayName: 'Nghiệp', role: 'Listener', hasCompletedOnboarding: true },
    meta: { apiVersion: 'v1', requestId: 'r3', timestamp: '' },
    error: null,
  }),
);

const server = setupServer(successHandler, notificationsHandler, profileHandler);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  useAuthStore.setState({ accessToken: null, userId: null, role: null });
  usePlayerStore.getState().clearSong();
  server.use(notificationsHandler, profileHandler);
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderAuthenticated() {
  useAuthStore.setState({ accessToken: 'mock-token', userId: 'user-001', role: 'Listener' });
  return render(
    <MemoryRouter initialEntries={['/']}>
      <HomePage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests — Auth redirect
// ---------------------------------------------------------------------------

describe('HomePage — auth', () => {
  it('redirects to /login when not authenticated', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ---------------------------------------------------------------------------
// Tests — Loading state
// ---------------------------------------------------------------------------

describe('HomePage — loading', () => {
  it('shows loading skeleton while fetching', () => {
    renderAuthenticated();
    expect(screen.getByLabelText('Đang tải danh sách nhạc')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Happy path (3 sections)
// ---------------------------------------------------------------------------

describe('HomePage — song rendering', () => {
  it('renders all song titles after fetch', async () => {
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

  it('renders explain badge when reason.text is present', async () => {
    renderAuthenticated();
    await waitFor(() => {
      expect(screen.getByText('Phù hợp buổi sáng')).toBeInTheDocument();
    });
    expect(screen.getByText('Trending')).toBeInTheDocument();
  });

  it('does NOT render explain badge when reason.text is empty', async () => {
    renderAuthenticated();
    await waitFor(() => {
      expect(screen.getByText('Ngày Mai')).toBeInTheDocument();
    });
    // song-001: 'Phù hợp buổi sáng', song-002: 'Trending', song-003: '' → 2 badges
    expect(screen.getAllByTestId('explain-badge')).toHaveLength(2);
  });

  it('renders section headings for non-empty groups', async () => {
    renderAuthenticated();
    await waitFor(() => {
      expect(screen.getByText('Đang thịnh hành')).toBeInTheDocument();
    });
    expect(screen.getByText('Vì bạn nghe')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Playback
// ---------------------------------------------------------------------------

describe('HomePage — playback', () => {
  it('mounts AudioPlayer when a song card is clicked', async () => {
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
    await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Phát Lạc Trôi — Sơn Tùng M-TP'));
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
    await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Phát Lạc Trôi — Sơn Tùng M-TP'));
    expect(screen.getByLabelText('Đóng player')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Đóng player'));
    await waitFor(() => {
      expect(screen.queryByLabelText('Đóng player')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — Error + retry
// ---------------------------------------------------------------------------

describe('HomePage — error state', () => {
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
    await waitFor(() => expect(screen.getByText('Thử lại')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests — Empty state
// ---------------------------------------------------------------------------

describe('HomePage — empty state', () => {
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

  it('returns "night" for hour 0–5', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(3);
    expect(getTimeContext()).toBe('night');
  });

  it('returns "afternoon" for hour 12–17', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
    expect(getTimeContext()).toBe('afternoon');
  });

  it('returns "night" for hour 22–23 (late night)', () => {
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(23);
    expect(getTimeContext()).toBe('night');
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — ContextSelector integration
// ---------------------------------------------------------------------------

describe('HomePage — ContextSelector', () => {
  it('renders ContextSelector with "Tất cả" chip', async () => {
    renderAuthenticated();
    // ContextSelector renders immediately (no loading dependency)
    expect(screen.getByRole('button', { name: /🎵 Tất cả/i })).toBeInTheDocument();
  });

  it('"Tất cả" chip is active by default (aria-pressed=true)', async () => {
    renderAuthenticated();
    const chip = screen.getByRole('button', { name: /🎵 Tất cả/i });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders all 5 context chips', async () => {
    renderAuthenticated();
    const chips = ['🎵 Tất cả', '🌅 Sáng', '☀️ Chiều', '🌙 Tối', '🌃 Khuya'];
    for (const label of chips) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('clicking a chip sets it as active (aria-pressed=true)', async () => {
    renderAuthenticated();
    const sanghChip = screen.getByRole('button', { name: /🌅 Sáng/i });
    fireEvent.click(sanghChip);
    expect(sanghChip).toHaveAttribute('aria-pressed', 'true');
    // "Tất cả" should no longer be active
    expect(screen.getByRole('button', { name: /🎵 Tất cả/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('only one chip is active at a time', async () => {
    renderAuthenticated();
    const toiChip = screen.getByRole('button', { name: /🌙 Tối/i });
    fireEvent.click(toiChip);
    const activeChips = screen.getAllByRole('button').filter(
      (btn) => btn.getAttribute('aria-pressed') === 'true',
    );
    // Only chips inside ContextSelector have aria-pressed; filter to those with emoji labels
    const contextChips = activeChips.filter((btn) =>
      /[🎵🌅☀️🌙🌃]/.test(btn.textContent ?? ''),
    );
    expect(contextChips).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — Context Feed Row section
// ---------------------------------------------------------------------------

describe('HomePage — context feed row section', () => {
  it('renders "Gợi ý cho bạn" section heading after data loads', async () => {
    renderAuthenticated();
    // Context feed is only visible after selecting a non-"all" context chip
    await waitFor(() => screen.getByRole('button', { name: /🌅 Sáng/i }));
    fireEvent.click(screen.getByRole('button', { name: /🌅 Sáng/i }));
    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Gợi ý theo bối cảnh' })).toBeInTheDocument();
    });
    expect(screen.getByText('Gợi ý cho bạn')).toBeInTheDocument();
  });

  it('renders refresh button in context feed section', async () => {
    renderAuthenticated();
    await waitFor(() => screen.getByRole('button', { name: /🌅 Sáng/i }));
    fireEvent.click(screen.getByRole('button', { name: /🌅 Sáng/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Làm mới gợi ý/i })).toBeInTheDocument(),
    );
  });

  it('songs appear in context feed as rows', async () => {
    renderAuthenticated();
    await waitFor(() => screen.getByRole('button', { name: /🌅 Sáng/i }));
    fireEvent.click(screen.getByRole('button', { name: /🌅 Sáng/i }));
    await waitFor(() => {
      expect(screen.getAllByText('Lạc Trôi').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('clicking refresh button triggers reload', async () => {
    let callCount = 0;
    server.use(
      http.get(RECOMMENDATIONS_URL, () => {
        callCount += 1;
        return HttpResponse.json({
          success: true,
          data: { items: mockItems },
          meta: { apiVersion: 'v1', requestId: `r${callCount}`, timestamp: '' },
          error: null,
        });
      }),
    );

    renderAuthenticated();
    await waitFor(() => screen.getByRole('button', { name: /🌅 Sáng/i }));
    fireEvent.click(screen.getByRole('button', { name: /🌅 Sáng/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Làm mới gợi ý/i })).toBeInTheDocument(),
    );
    const initialCount = callCount;
    fireEvent.click(screen.getByRole('button', { name: /Làm mới gợi ý/i }));
    await waitFor(() => expect(callCount).toBeGreaterThan(initialCount));
  });
});
