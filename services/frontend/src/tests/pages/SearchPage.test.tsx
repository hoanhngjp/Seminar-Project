import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import SearchPage from '../../pages/SearchPage';
import { useAuthStore } from '../../store/authStore';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const SEARCH_URL = 'http://localhost:5000/api/v1/search';
const STREAMING_URL = 'http://localhost:5000/api/v1/streaming/:songId/url';

const mockItems = [
  { songId: 'song-001', title: 'Lạc Trôi', artist: 'Sơn Tùng M-TP', album: 'Sky Tour' },
  { songId: 'song-002', title: 'Nơi Này Có Anh', artist: 'Sơn Tùng M-TP', album: 'Skyline' },
  { songId: 'song-003', title: 'Muộn Rồi Mà Sao Còn', artist: 'Sơn Tùng M-TP', album: '' },
];

const page2Items = [
  { songId: 'song-004', title: 'Hãy Trao Cho Anh', artist: 'Sơn Tùng M-TP', album: 'Sun' },
];

function makeSuccess(
  items: typeof mockItems,
  hasMore = false,
  nextCursor: string | null = null,
) {
  return HttpResponse.json({
    success: true,
    data: { items, hasMore, nextCursor },
    meta: { apiVersion: 'v1', requestId: 'r', timestamp: '' },
    error: null,
  });
}

const defaultHandler = http.get(SEARCH_URL, () => makeSuccess(mockItems));

const server = setupServer(defaultHandler);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  useAuthStore.setState({ accessToken: null, userId: null, role: null });
  vi.restoreAllMocks();
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderAuthenticated() {
  useAuthStore.setState({ accessToken: 'mock-token', userId: 'u1', role: 'Listener' });
  return render(
    <MemoryRouter initialEntries={['/search']}>
      <SearchPage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchPage', () => {
  // ─── Auth ────────────────────────────────────────────────────────────────

  it('redirects to /login when not authenticated', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/search']}>
        <SearchPage />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  // ─── Initial state ────────────────────────────────────────────────────────

  it('shows hint text when query is empty', () => {
    renderAuthenticated();
    expect(screen.getByText('Tìm kiếm bài hát, nghệ sĩ...')).toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    renderAuthenticated();
    expect(screen.getByLabelText('Tìm kiếm bài hát')).toBeInTheDocument();
  });

  it('does NOT call API when query is empty on mount', () => {
    let callCount = 0;
    server.use(http.get(SEARCH_URL, () => { callCount++; return makeSuccess([]); }));
    renderAuthenticated();
    // No API call should happen without input
    expect(callCount).toBe(0);
  });

  // ─── Debounce ─────────────────────────────────────────────────────────────

  it('does not call API immediately on every keystroke (debounce)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    let callCount = 0;
    server.use(http.get(SEARCH_URL, () => { callCount++; return makeSuccess([]); }));

    renderAuthenticated();
    const input = screen.getByLabelText('Tìm kiếm bài hát');

    // Type quickly — each key triggers setState but debounce should batch
    fireEvent.change(input, { target: { value: 's' } });
    fireEvent.change(input, { target: { value: 'so' } });
    fireEvent.change(input, { target: { value: 'son' } });

    // Before debounce fires — no API call yet
    expect(callCount).toBe(0);

    // Advance timer past debounce window
    await act(async () => { vi.advanceTimersByTime(350); });

    expect(callCount).toBe(1);
    vi.useRealTimers();
  });

  // ─── Search results ───────────────────────────────────────────────────────

  it('renders search results after typing query', async () => {
    renderAuthenticated();
    const input = screen.getByLabelText('Tìm kiếm bài hát');

    fireEvent.change(input, { target: { value: 'son tung' } });

    await waitFor(() => {
      expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    });
    expect(screen.getByText('Nơi Này Có Anh')).toBeInTheDocument();
    expect(screen.getByText('Muộn Rồi Mà Sao Còn')).toBeInTheDocument();
  });

  it('renders artist names in results', async () => {
    renderAuthenticated();
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'son tung' },
    });

    await waitFor(() => {
      expect(screen.getAllByText('Sơn Tùng M-TP')).toHaveLength(3);
    });
  });

  it('renders album text when present', async () => {
    renderAuthenticated();
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'lac troi' },
    });

    await waitFor(() => {
      expect(screen.getByText('Sky Tour', { exact: false })).toBeInTheDocument();
    });
  });

  it('does not render album text when album is empty string', async () => {
    renderAuthenticated();
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'muon roi' },
    });

    await waitFor(() => {
      expect(screen.getByText('Muộn Rồi Mà Sao Còn')).toBeInTheDocument();
    });
    // Third song has album: '' — no album text should appear
    // "Sky Tour" and "Skyline" belong to other songs
    expect(screen.queryByText('· ')).not.toBeInTheDocument();
  });

  // ─── Empty state ──────────────────────────────────────────────────────────

  it('shows empty state when API returns no results', async () => {
    server.use(http.get(SEARCH_URL, () => makeSuccess([])));
    renderAuthenticated();
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'xyzzy' },
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Không tìm thấy kết quả cho/),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/xyzzy/)).toBeInTheDocument();
  });

  // ─── Loading state ────────────────────────────────────────────────────────

  it('shows results after debounce fires (loading skeleton → results)', async () => {
    // Verify that results only appear AFTER debounce window (300ms), not immediately
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.use(http.get(SEARCH_URL, () => makeSuccess(mockItems)));

    renderAuthenticated();
    const input = screen.getByLabelText('Tìm kiếm bài hát');
    fireEvent.change(input, { target: { value: 'son tung' } });

    // Before debounce fires — no results yet
    expect(screen.queryByText('Lạc Trôi')).not.toBeInTheDocument();

    // Advance past debounce + let fetch + state updates resolve
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Đang tìm kiếm')).not.toBeInTheDocument();
  });

  // ─── Clear button ─────────────────────────────────────────────────────────

  it('shows clear button when query is non-empty', async () => {
    renderAuthenticated();
    const input = screen.getByLabelText('Tìm kiếm bài hát');

    expect(screen.queryByLabelText('Xoá từ khoá')).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.getByLabelText('Xoá từ khoá')).toBeInTheDocument();
  });

  it('clears query and hides results when clear button clicked', async () => {
    renderAuthenticated();
    const input = screen.getByLabelText('Tìm kiếm bài hát');
    fireEvent.change(input, { target: { value: 'son tung' } });

    await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Xoá từ khoá'));

    expect(input).toHaveValue('');
    // Debounce fires after 300ms and clears items — wait for it
    await waitFor(() => {
      expect(screen.queryByText('Lạc Trôi')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Tìm kiếm bài hát, nghệ sĩ...')).toBeInTheDocument();
  });

  // ─── Load more / pagination ───────────────────────────────────────────────

  it('shows Load more button when hasMore is true', async () => {
    server.use(
      http.get(SEARCH_URL, () => makeSuccess(mockItems, true, 'cursor-page-2')),
    );
    renderAuthenticated();
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'son tung' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Tải thêm kết quả')).toBeInTheDocument();
    });
  });

  it('does NOT show Load more button when hasMore is false', async () => {
    renderAuthenticated();
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'son tung' },
    });

    await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());
    expect(screen.queryByLabelText('Tải thêm kết quả')).not.toBeInTheDocument();
  });

  it('appends next page results when Load more clicked', async () => {
    let page = 0;
    server.use(
      http.get(SEARCH_URL, ({ request }) => {
        const url = new URL(request.url);
        const cursor = url.searchParams.get('cursor');
        if (!cursor) {
          page = 1;
          return makeSuccess(mockItems, true, 'cursor-page-2');
        }
        page = 2;
        return makeSuccess(page2Items, false, null);
      }),
    );

    renderAuthenticated();
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'son tung' },
    });

    await waitFor(() => expect(screen.getByLabelText('Tải thêm kết quả')).toBeInTheDocument());
    expect(page).toBe(1);

    fireEvent.click(screen.getByLabelText('Tải thêm kết quả'));

    await waitFor(() => expect(screen.getByText('Hãy Trao Cho Anh')).toBeInTheDocument());
    // First page still present
    expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    expect(page).toBe(2);
    // Load more button gone after last page
    expect(screen.queryByLabelText('Tải thêm kết quả')).not.toBeInTheDocument();
  });

  it('passes cursor param to API when loading more', async () => {
    let capturedCursor: string | null = null;
    server.use(
      http.get(SEARCH_URL, ({ request }) => {
        const url = new URL(request.url);
        capturedCursor = url.searchParams.get('cursor');
        if (!capturedCursor) return makeSuccess(mockItems, true, 'cursor-abc');
        return makeSuccess(page2Items, false, null);
      }),
    );

    renderAuthenticated();
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'son' },
    });

    await waitFor(() => expect(screen.getByLabelText('Tải thêm kết quả')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Tải thêm kết quả'));

    await waitFor(() => expect(screen.getByText('Hãy Trao Cho Anh')).toBeInTheDocument());
    expect(capturedCursor).toBe('cursor-abc');
  });

  // ─── Click → AudioPlayer ──────────────────────────────────────────────────

  it('mounts AudioPlayer when a result is clicked', async () => {
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
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'lac troi' },
    });

    await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Phát Lạc Trôi — Sơn Tùng M-TP'));
    expect(screen.getByLabelText('Đóng player')).toBeInTheDocument();
  });

  it('closes AudioPlayer when close button clicked', async () => {
    server.use(
      http.get(STREAMING_URL, () =>
        HttpResponse.json({
          success: true,
          data: { url: 'http://cdn.example.com/s.mp3', expiresIn: 900 },
          meta: { apiVersion: 'v1', requestId: 'x', timestamp: '' },
          error: null,
        }),
      ),
    );

    renderAuthenticated();
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'lac troi' },
    });

    await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Phát Lạc Trôi — Sơn Tùng M-TP'));
    expect(screen.getByLabelText('Đóng player')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Đóng player'));
    expect(screen.queryByLabelText('Đóng player')).not.toBeInTheDocument();
  });

  // ─── API error → empty fallback (per contract) ────────────────────────────

  it('shows empty results (no crash) when API returns 500', async () => {
    server.use(
      http.get(SEARCH_URL, () =>
        HttpResponse.json(
          { success: false, data: null, meta: {}, error: { code: 'INTERNAL_ERROR', message: '' } },
          { status: 500 },
        ),
      ),
    );

    renderAuthenticated();
    fireEvent.change(screen.getByLabelText('Tìm kiếm bài hát'), {
      target: { value: 'error query' },
    });

    // Per search contract: on error, return [] — no error thrown to user
    await waitFor(() => {
      expect(screen.queryByText('Lạc Trôi')).not.toBeInTheDocument();
    });
    // No crash — page still renders
    expect(screen.getByLabelText('Tìm kiếm bài hát')).toBeInTheDocument();
  });

  // ─── New query resets results ─────────────────────────────────────────────

  it('resets results when a new search query is typed', async () => {
    let callCount = 0;
    server.use(
      http.get(SEARCH_URL, ({ request }) => {
        callCount++;
        const q = new URL(request.url).searchParams.get('q');
        if (q === 'first') return makeSuccess(mockItems);
        return makeSuccess([
          { songId: 'song-x', title: 'Bài Khác', artist: 'Vũ.', album: '' },
        ]);
      }),
    );

    renderAuthenticated();
    const input = screen.getByLabelText('Tìm kiếm bài hát');

    fireEvent.change(input, { target: { value: 'first' } });
    await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());

    fireEvent.change(input, { target: { value: 'second' } });
    await waitFor(() => expect(screen.getByText('Bài Khác')).toBeInTheDocument());

    // Old results gone
    expect(screen.queryByText('Lạc Trôi')).not.toBeInTheDocument();
    expect(callCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// searchApi unit tests
// ---------------------------------------------------------------------------

describe('searchSongs', () => {
  it('passes q, type, limit params to API', async () => {
    let capturedParams: Record<string, string> = {};
    server.use(
      http.get(SEARCH_URL, ({ request }) => {
        const url = new URL(request.url);
        url.searchParams.forEach((v, k) => { capturedParams[k] = v; });
        return makeSuccess([]);
      }),
    );

    useAuthStore.setState({ accessToken: 'tok', userId: 'u', role: 'Listener' });
    const { searchSongs } = await import('../../api/searchApi');
    await searchSongs('son tung', 10);

    expect(capturedParams['q']).toBe('son tung');
    expect(capturedParams['type']).toBe('song');
    expect(capturedParams['limit']).toBe('10');
  });

  it('passes cursor param when provided', async () => {
    let capturedCursor: string | null = null;
    server.use(
      http.get(SEARCH_URL, ({ request }) => {
        capturedCursor = new URL(request.url).searchParams.get('cursor');
        return makeSuccess([]);
      }),
    );

    useAuthStore.setState({ accessToken: 'tok', userId: 'u', role: 'Listener' });
    const { searchSongs } = await import('../../api/searchApi');
    await searchSongs('son', 10, 'cursor-xyz');

    expect(capturedCursor).toBe('cursor-xyz');
  });
});
