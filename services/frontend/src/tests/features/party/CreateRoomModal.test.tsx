import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import CreateRoomModal from '../../../features/party/components/CreateRoomModal';

// ---------------------------------------------------------------------------
// Mock IntersectionObserver (not available in jsdom)
// ---------------------------------------------------------------------------

const observerCallbacks = new Map<Element, IntersectionObserverCallback>();

vi.stubGlobal('IntersectionObserver', class {
  private callback: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) { this.callback = cb; }
  observe(el: Element)   { observerCallbacks.set(el, this.callback); }
  unobserve(el: Element) { observerCallbacks.delete(el); }
  disconnect()           { observerCallbacks.clear(); }
});

function triggerIntersection(el: Element) {
  const cb = observerCallbacks.get(el);
  if (cb) cb([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
}

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const CREATE_URL = 'http://localhost:5000/api/v1/parties';
const REC_URL    = 'http://localhost:5000/api/v1/recommendations';
const SEARCH_URL = 'http://localhost:5000/api/v1/search';

const recHandler = http.get(REC_URL, () =>
  HttpResponse.json({
    success: true,
    data: {
      items: [
        { songId: 'song-r1', title: 'Lạc Trôi',   artist: 'Sơn Tùng M-TP', thumbnail: 'https://cdn.test/1.jpg', reason: { type: 'TRENDING', text: '' } },
        { songId: 'song-r2', title: 'Chuyến Xe',  artist: 'Ngọt',           thumbnail: 'https://cdn.test/2.jpg', reason: { type: 'TRENDING', text: '' } },
        { songId: 'song-r3', title: 'Từ Hôm Nay', artist: 'Vũ.',            thumbnail: 'https://cdn.test/3.jpg', reason: { type: 'TRENDING', text: '' } },
        { songId: 'song-r4', title: 'Là Ai',       artist: 'Chillies',       thumbnail: 'https://cdn.test/4.jpg', reason: { type: 'TRENDING', text: '' } },
      ],
    },
    meta: { apiVersion: 'v1', requestId: 'r0', timestamp: new Date().toISOString(), cache: 'HIT' },
    error: null,
  }),
);

// Page 1: 2 results + hasMore=true
const searchPage1Handler = http.get(SEARCH_URL, ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get('cursor')) return; // fall through to page2
  return HttpResponse.json({
    success: true,
    data: {
      items: [
        { id: 'song-s1', name: 'Bài Hát A', type: 'song', score: 0.9, artist: 'Artist A', coverUrl: 'https://cdn.test/s1.jpg' },
        { id: 'song-s2', name: 'Bài Hát B', type: 'song', score: 0.8, artist: 'Artist B', coverUrl: 'https://cdn.test/s2.jpg' },
      ],
      nextCursor: 'cursor-page2',
      hasMore: true,
    },
    meta: { apiVersion: 'v1', requestId: 'r0', timestamp: new Date().toISOString() },
    error: null,
  });
});

// Page 2: 1 result + hasMore=false
const searchPage2Handler = http.get(SEARCH_URL, ({ request }) => {
  const url = new URL(request.url);
  if (url.searchParams.get('cursor') !== 'cursor-page2') return;
  return HttpResponse.json({
    success: true,
    data: {
      items: [
        { id: 'song-s3', name: 'Bài Hát C', type: 'song', score: 0.7, artist: 'Artist C', coverUrl: 'https://cdn.test/s3.jpg' },
      ],
      nextCursor: null,
      hasMore: false,
    },
    meta: { apiVersion: 'v1', requestId: 'r0', timestamp: new Date().toISOString() },
    error: null,
  });
});

const createSuccessHandler = http.post(CREATE_URL, () =>
  HttpResponse.json(
    {
      success: true,
      data: { roomId: 'room-test-001', joinCode: 'XK29F1', hostId: 'user-001', name: 'Test Room', currentSongId: null, playbackPositionSec: 0, members: [] },
      meta: { apiVersion: 'v1', requestId: 'r1', timestamp: new Date().toISOString() },
      error: null,
    },
    { status: 201 },
  ),
);

const createErrorHandler = http.post(CREATE_URL, () =>
  HttpResponse.json(
    { success: false, data: null, meta: { apiVersion: 'v1', requestId: 'r1', timestamp: new Date().toISOString() }, error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
    { status: 500 },
  ),
);

const server = setupServer(recHandler, searchPage1Handler, searchPage2Handler, createSuccessHandler);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { server.resetHandlers(); observerCallbacks.clear(); });
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModal(onClose = vi.fn(), onCreated = vi.fn()) {
  return render(
    <MemoryRouter>
      <CreateRoomModal onClose={onClose} onCreated={onCreated} />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateRoomModal', () => {

  describe('Rendering', () => {
    it('renders modal with title', () => {
      renderModal();
      expect(screen.getByText(/Tạo phòng nghe nhạc/)).toBeInTheDocument();
    });

    it('renders room name input', () => {
      renderModal();
      expect(screen.getByRole('textbox', { name: /Tên phòng/ })).toBeInTheDocument();
    });

    it('renders song search input', () => {
      renderModal();
      expect(screen.getByRole('textbox', { name: /Tìm bài hát/ })).toBeInTheDocument();
    });

    it('renders create button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /TẠO PHÒNG/i })).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Hủy/ })).toBeInTheDocument();
    });

    it('renders close (X) button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Đóng/ })).toBeInTheDocument();
    });

    it('shows recommendation songs on render', async () => {
      renderModal();
      await waitFor(() => {
        expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
      });
    });

    it('shows 4 recommendation songs initially', async () => {
      renderModal();
      await waitFor(() => expect(screen.getByText('Là Ai')).toBeInTheDocument());
      expect(screen.getAllByRole('option')).toHaveLength(4);
    });
  });

  describe('Room name input', () => {
    it('updates room name as user types', () => {
      renderModal();
      const input = screen.getByRole('textbox', { name: /Tên phòng/ });
      fireEvent.change(input, { target: { value: 'Phòng nhạc của tôi' } });
      expect(input).toHaveValue('Phòng nhạc của tôi');
    });
  });

  describe('Song search', () => {
    it('shows search results (page 1) after typing', async () => {
      renderModal();
      await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());

      fireEvent.change(screen.getByRole('textbox', { name: /Tìm bài hát/ }), { target: { value: 'Bài' } });

      await waitFor(() => expect(screen.getByText('Bài Hát A')).toBeInTheDocument(), { timeout: 1000 });
      expect(screen.getByText('Bài Hát B')).toBeInTheDocument();
    });

    it('loads next page when sentinel intersects', async () => {
      renderModal();
      await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());

      fireEvent.change(screen.getByRole('textbox', { name: /Tìm bài hát/ }), { target: { value: 'Bài' } });
      await waitFor(() => expect(screen.getByText('Bài Hát A')).toBeInTheDocument(), { timeout: 1000 });

      // Simulate scrolling sentinel into view
      const sentinel = document.querySelector('[role="listbox"] > div:last-child')!;
      triggerIntersection(sentinel);

      await waitFor(() => expect(screen.getByText('Bài Hát C')).toBeInTheDocument());
    });

    it('selects a song when result is clicked', async () => {
      renderModal();
      await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());

      fireEvent.click(screen.getByText('Lạc Trôi').closest('button')!);

      const searchInput = screen.getByRole('textbox', { name: /Tìm bài hát/ });
      expect((searchInput as HTMLInputElement).value).toContain('Lạc Trôi');
    });

    it('resets to recommendations when query is cleared', async () => {
      renderModal();
      await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());

      const searchInput = screen.getByRole('textbox', { name: /Tìm bài hát/ });
      fireEvent.change(searchInput, { target: { value: 'Bài' } });
      await waitFor(() => expect(screen.getByText('Bài Hát A')).toBeInTheDocument(), { timeout: 1000 });

      fireEvent.change(searchInput, { target: { value: '' } });
      await waitFor(() => expect(screen.getByText('Lạc Trôi')).toBeInTheDocument());
    });
  });

  describe('Validation', () => {
    it('shows error when room name is empty on submit', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /TẠO PHÒNG/i }));
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Vui lòng nhập tên phòng/);
      });
    });
  });

  describe('Submit', () => {
    it('calls onCreated with party data on success', async () => {
      const onCreated = vi.fn();
      renderModal(vi.fn(), onCreated);

      fireEvent.change(screen.getByRole('textbox', { name: /Tên phòng/ }), { target: { value: 'Phòng test' } });
      fireEvent.click(screen.getByRole('button', { name: /TẠO PHÒNG/i }));

      await waitFor(() => {
        expect(onCreated).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-test-001', joinCode: 'XK29F1' }),
        );
      });
    });

    it('shows error message when API fails', async () => {
      server.use(createErrorHandler);
      renderModal();

      fireEvent.change(screen.getByRole('textbox', { name: /Tên phòng/ }), { target: { value: 'Phòng test' } });
      fireEvent.click(screen.getByRole('button', { name: /TẠO PHÒNG/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Không thể tạo phòng/);
      });
    });
  });

  describe('Close', () => {
    it('calls onClose when X button is clicked', () => {
      const onClose = vi.fn();
      renderModal(onClose);
      fireEvent.click(screen.getByRole('button', { name: /Đóng/ }));
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('calls onClose when Hủy button is clicked', () => {
      const onClose = vi.fn();
      renderModal(onClose);
      fireEvent.click(screen.getByRole('button', { name: /Hủy/ }));
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

});
