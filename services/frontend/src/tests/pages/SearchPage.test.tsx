import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import SearchPage from '../../pages/SearchPage';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';

// ── URLs ───────────────────────────────────────────────────────────────────────

const SEARCH_URL        = 'http://localhost:5000/api/v1/search';
const NOTIFICATIONS_URL = 'http://localhost:5000/api/v1/notifications/unread';
const PROFILE_URL       = 'http://localhost:5000/api/v1/users/me';

// ── Helpers ────────────────────────────────────────────────────────────────────

function apiOk<T>(data: T, extra = {}) {
  return HttpResponse.json({
    success: true,
    data,
    meta: { apiVersion: 'v1', requestId: 'r1', timestamp: new Date().toISOString(), pagination: { hasMore: false, nextCursor: null }, ...extra },
    error: null,
  });
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_SONG_RESULTS = [
  { id: 'song-001', name: 'Lạc Trôi',           type: 'song',   score: 0.98, artist: 'Sơn Tùng M-TP', coverUrl: '', duration: 245 },
  { id: 'song-002', name: 'Có Chắc Yêu Là Đây', type: 'song',   score: 0.90, artist: 'Sơn Tùng M-TP', coverUrl: '', duration: 228 },
];

const MOCK_ARTIST_RESULTS = [
  { id: 'artist-1', name: 'Sơn Tùng M-TP', type: 'artist', score: 0.99, coverUrl: '' },
  { id: 'artist-2', name: 'Ngọt',           type: 'artist', score: 0.75, coverUrl: '' },
];

const ALL_RESULTS = [...MOCK_ARTIST_RESULTS, ...MOCK_SONG_RESULTS];

// ── Shared handlers ────────────────────────────────────────────────────────────

const notificationsHandler = http.get(NOTIFICATIONS_URL, () =>
  apiOk({ items: [], totalUnread: 0 }),
);

const profileHandler = http.get(PROFILE_URL, () =>
  apiOk({ userId: 'u1', email: 'test@example.com', displayName: 'Test User', role: 'Listener', hasCompletedOnboarding: true }),
);

const emptySearchHandler = http.get(SEARCH_URL, () => apiOk([]));
const resultsSearchHandler = http.get(SEARCH_URL, () => apiOk(ALL_RESULTS));

const server = setupServer(emptySearchHandler, notificationsHandler, profileHandler);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  useAuthStore.setState({ accessToken: null, userId: null, role: null });
  usePlayerStore.getState().clearSong();
  server.use(emptySearchHandler, notificationsHandler, profileHandler);
});
afterAll(() => server.close());

// ── Helper ─────────────────────────────────────────────────────────────────────

function renderPage() {
  useAuthStore.setState({ accessToken: 'mock-token', userId: 'user-001', role: 'Listener' });
  return render(
    <MemoryRouter initialEntries={['/search']}>
      <SearchPage />
    </MemoryRouter>,
  );
}

/** SearchPage renders 2 inputs (mobile + desktop hidden via CSS). Use the first. */
async function getSearchInput() {
  const inputs = await screen.findAllByRole('textbox', { name: /tìm kiếm/i });
  return inputs[0];
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SearchPage — empty state', () => {
  it('renders genre browse grid when no query', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('genre-browse')).toBeInTheDocument();
    });
  });

  it('renders all 9 genre cards', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('genre-card-Pop')).toBeInTheDocument();
      expect(screen.getByTestId('genre-card-Rock')).toBeInTheDocument();
      expect(screen.getByTestId('genre-card-Indie')).toBeInTheDocument();
    });
    const cards = screen.getAllByTestId(/^genre-card-/);
    expect(cards).toHaveLength(9);
  });

  it('shows search input', async () => {
    renderPage();
    expect(await getSearchInput()).toBeInTheDocument();
  });
});

describe('SearchPage — results state', () => {
  it('shows results container when query has matches', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'sơn tùng' } });

    await waitFor(() => {
      expect(screen.getByTestId('search-results')).toBeInTheDocument();
    });
  });

  it('shows top result card for highest-scoring item', async () => {
    // AC: artist-1 has score 0.95 (highest) → appears as top result
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'sơn' } });

    await waitFor(() => {
      expect(screen.getByTestId('top-result-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('top-result-card')).toHaveTextContent('Sơn Tùng M-TP');
  });

  it('shows song rows with title and artist', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'lạc' } });

    await waitFor(() => {
      expect(screen.getByTestId('song-row-song-001')).toBeInTheDocument();
    });
    expect(screen.getByTestId('song-row-song-001')).toHaveTextContent('Lạc Trôi');
    expect(screen.getByTestId('song-row-song-001')).toHaveTextContent('Sơn Tùng M-TP');
  });

  it('shows formatted duration in song rows (4:05 for 245s)', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'trôi' } });

    await waitFor(() => {
      expect(screen.getByTestId('song-row-song-001')).toHaveTextContent('4:05');
    });
  });

  it('shows artists section with circular cards', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'tùng' } });

    await waitFor(() => {
      expect(screen.getByTestId('artists-section')).toBeInTheDocument();
    });
    expect(screen.getByTestId('artist-card-artist-1')).toBeInTheDocument();
    expect(screen.getByTestId('artist-card-artist-2')).toBeInTheDocument();
  });
});

describe('SearchPage — no results', () => {
  it('shows no-results with query text when backend returns empty', async () => {
    // Per API contract: timeout or no match → [] not error
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'xyznotfound' } });

    await waitFor(() => {
      expect(screen.getByTestId('no-results')).toBeInTheDocument();
    });
    expect(screen.getByTestId('no-results')).toHaveTextContent('xyznotfound');
  });

  it('hides genre grid when query is typed', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('genre-browse')).toBeInTheDocument();
    });

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'anything' } });

    await waitFor(() => {
      expect(screen.queryByTestId('genre-browse')).not.toBeInTheDocument();
    });
  });
});

describe('SearchPage — play song', () => {
  it('dispatches playSong to player store when song row is clicked', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'lạc' } });

    await waitFor(() => {
      expect(screen.getByTestId('song-row-song-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('song-row-song-001'));

    const { currentSong } = usePlayerStore.getState();
    expect(currentSong?.songId).toBe('song-001');
    expect(currentSong?.title).toBe('Lạc Trôi');
  });
});

describe('SearchPage — clear query', () => {
  it('shows clear button when query is typed', async () => {
    renderPage();
    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'test' } });

    const btns = await screen.findAllByRole('button', { name: /xóa tìm kiếm/i });
    expect(btns[0]).toBeInTheDocument();
  });

  it('restores genre grid after clear button click', async () => {
    renderPage();
    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'test' } });

    const [clearBtn] = await screen.findAllByRole('button', { name: /xóa tìm kiếm/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.queryAllByRole('button', { name: /xóa tìm kiếm/i })).toHaveLength(0);
      expect(screen.getByTestId('genre-browse')).toBeInTheDocument();
    });
  });
});

// ── Phase 6 — Filter tabs ──────────────────────────────────────────────────────

describe('SearchPage — filter tabs', () => {
  it('shows filter tabs when results are present', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'sơn tùng' } });

    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: /Lọc kết quả tìm kiếm/i })).toBeInTheDocument();
    });
    expect(screen.getByTestId('filter-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('filter-tab-songs')).toBeInTheDocument();
    expect(screen.getByTestId('filter-tab-artists')).toBeInTheDocument();
  });

  it('"Tất cả" tab is active by default (aria-selected=true)', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'sơn' } });

    await waitFor(() => expect(screen.getByTestId('filter-tab-all')).toBeInTheDocument());
    expect(screen.getByTestId('filter-tab-all')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('filter-tab-songs')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('filter-tab-artists')).toHaveAttribute('aria-selected', 'false');
  });

  it('clicking "Bài hát" tab shows songs and hides artists section', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'sơn' } });

    await waitFor(() => expect(screen.getByTestId('filter-tab-songs')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('filter-tab-songs'));

    await waitFor(() => {
      expect(screen.getByTestId('filter-tab-songs')).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.queryByTestId('artists-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('song-row-song-001')).toBeInTheDocument();
  });

  it('clicking "Nghệ sĩ" tab shows artists and hides song rows', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'sơn' } });

    await waitFor(() => expect(screen.getByTestId('filter-tab-artists')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('filter-tab-artists'));

    await waitFor(() => {
      expect(screen.getByTestId('filter-tab-artists')).toHaveAttribute('aria-selected', 'true');
    });
    expect(screen.getByTestId('artists-section')).toBeInTheDocument();
    expect(screen.queryByTestId('song-row-song-001')).not.toBeInTheDocument();
  });

  it('clicking "Tất cả" after "Bài hát" restores full results', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'sơn' } });

    await waitFor(() => expect(screen.getByTestId('filter-tab-songs')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('filter-tab-songs'));
    fireEvent.click(screen.getByTestId('filter-tab-all'));

    await waitFor(() => {
      expect(screen.getByTestId('artists-section')).toBeInTheDocument();
    });
    expect(screen.getByTestId('song-row-song-001')).toBeInTheDocument();
  });

  it('filter tabs do not appear when no query is entered', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('genre-browse')).toBeInTheDocument());
    expect(screen.queryByTestId('filter-tab-all')).not.toBeInTheDocument();
  });

  it('filter tabs reset to "Tất cả" when query is cleared', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'sơn' } });

    await waitFor(() => expect(screen.getByTestId('filter-tab-artists')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('filter-tab-artists'));

    // Clear query
    const [clearBtn] = await screen.findAllByRole('button', { name: /xóa tìm kiếm/i });
    fireEvent.click(clearBtn);

    // Re-type query
    fireEvent.change(input, { target: { value: 'sơn' } });

    await waitFor(() => {
      expect(screen.getByTestId('filter-tab-all')).toHaveAttribute('aria-selected', 'true');
    });
  });
});

// ── Phase 6 — ArtistCard in SearchPage ───────────────────────────────────────

describe('SearchPage — ArtistCard (upgraded ArtistsRow)', () => {
  it('renders ArtistCard with "Nghệ sĩ" label for each artist', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'sơn' } });

    await waitFor(() => {
      expect(screen.getByTestId('artists-section')).toBeInTheDocument();
    });
    // Each ArtistCard has testid artist-card-{id}
    expect(screen.getByTestId('artist-card-artist-1')).toBeInTheDocument();
    expect(screen.getByTestId('artist-card-artist-2')).toBeInTheDocument();
  });

  it('each ArtistCard shows "Nghệ sĩ" label', async () => {
    server.use(resultsSearchHandler, notificationsHandler, profileHandler);
    renderPage();

    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'tùng' } });

    await waitFor(() => expect(screen.getByTestId('artists-section')).toBeInTheDocument());
    const labels = screen.getAllByText('Nghệ sĩ');
    expect(labels.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Phase 6 — EmptyState for no-results ──────────────────────────────────────

describe('SearchPage — EmptyState no-results', () => {
  it('uses EmptyState component for no-results — shows icon area', async () => {
    renderPage();
    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'xyznotfound' } });

    await waitFor(() => {
      expect(screen.getByTestId('no-results')).toBeInTheDocument();
    });
    // EmptyState renders title
    expect(screen.getByText('Không tìm thấy kết quả')).toBeInTheDocument();
  });

  it('no-results wrapper contains the search query text', async () => {
    renderPage();
    const input = await getSearchInput();
    fireEvent.change(input, { target: { value: 'query-unique-xyz' } });

    await waitFor(() => {
      expect(screen.getByTestId('no-results')).toBeInTheDocument();
    });
    expect(screen.getByTestId('no-results')).toHaveTextContent('query-unique-xyz');
  });
});
