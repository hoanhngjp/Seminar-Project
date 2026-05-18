import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PartyQueue from '../../../features/party/components/PartyQueue';
import type { QueueItem } from '../../../types/listening-party';

// ---------------------------------------------------------------------------
// Mock searchContent
// ---------------------------------------------------------------------------

vi.mock('../../../services/searchService', () => ({
  searchContent: vi.fn(),
}));

vi.mock('../../../services/musicService', () => ({
  getSong: vi.fn().mockResolvedValue({ id: 'song-aaa', title: 'Mock Title', artist: 'Mock Artist', duration: 200, coverUrl: null }),
}));

import { searchContent } from '../../../services/searchService';
const mockSearch = vi.mocked(searchContent);

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const USER_ID = 'user-001';

const QUEUE_ITEMS: QueueItem[] = [
  { songId: 'song-aaa', addedByUserId: USER_ID },
  { songId: 'song-bbb', addedByUserId: 'user-002' },
];

const SEARCH_RESULTS = [
  { id: 'song-x', name: 'Nơi này có anh', artist: 'Sơn Tùng M-TP', type: 'song' as const, coverUrl: 'https://picsum.photos/40/40' },
  { id: 'song-y', name: 'Em của ngày hôm qua', artist: 'Sơn Tùng M-TP', type: 'song' as const, coverUrl: undefined },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderQueue(
  items: QueueItem[] = [],
  props: Partial<React.ComponentProps<typeof PartyQueue>> = {},
) {
  const onAddSong    = vi.fn();
  const onRemoveSong = vi.fn();
  const result = render(
    <PartyQueue
      queueItems={items}
      currentUserId={USER_ID}
      onAddSong={onAddSong}
      onRemoveSong={onRemoveSong}
      {...props}
    />,
  );
  return { ...result, onAddSong, onRemoveSong };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PartyQueue', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Use fake timers for debounce
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Search bar', () => {
    it('renders search input with placeholder', () => {
      renderQueue();
      expect(screen.getByPlaceholderText('Tìm bài để thêm...')).toBeInTheDocument();
    });

    it('calls searchContent after 300ms debounce', async () => {
      mockSearch.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
      renderQueue();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'sơn tùng' } });

      // Not called yet
      expect(mockSearch).not.toHaveBeenCalled();

      // Advance timers past debounce
      await act(async () => { vi.advanceTimersByTime(300); });
      await act(async () => {});

      expect(mockSearch).toHaveBeenCalledWith('sơn tùng', 'song', 5);
    });

    it('does not call searchContent for empty query', async () => {
      renderQueue();
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });

      await act(async () => { vi.advanceTimersByTime(400); });
      await act(async () => {});

      expect(mockSearch).not.toHaveBeenCalled();
    });

    it('shows search results after search resolves', async () => {
      mockSearch.mockResolvedValue({ items: SEARCH_RESULTS, nextCursor: null, hasMore: false });
      renderQueue();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tùng' } });
      await act(async () => { vi.advanceTimersByTime(300); });
      await act(async () => {});

      expect(screen.getByText('Nơi này có anh')).toBeInTheDocument();
      expect(screen.getByText('Em của ngày hôm qua')).toBeInTheDocument();
    });

    it('shows add button for each search result', async () => {
      mockSearch.mockResolvedValue({ items: SEARCH_RESULTS, nextCursor: null, hasMore: false });
      renderQueue();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tùng' } });
      await act(async () => { vi.advanceTimersByTime(300); });
      await act(async () => {});

      expect(screen.getByRole('button', { name: /Thêm Nơi này có anh/ })).toBeInTheDocument();
    });

    it('calls onAddSong with correct songId when add button clicked', async () => {
      mockSearch.mockResolvedValue({ items: SEARCH_RESULTS, nextCursor: null, hasMore: false });
      const { onAddSong } = renderQueue();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tùng' } });
      await act(async () => { vi.advanceTimersByTime(300); });
      await act(async () => {});

      fireEvent.click(screen.getByRole('button', { name: /Thêm Nơi này có anh/ }));

      expect(onAddSong).toHaveBeenCalledWith('song-x');
    });

    it('clears query and results after adding a song', async () => {
      mockSearch.mockResolvedValue({ items: SEARCH_RESULTS, nextCursor: null, hasMore: false });
      renderQueue();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tùng' } });
      await act(async () => { vi.advanceTimersByTime(300); });
      await act(async () => {});

      fireEvent.click(screen.getByRole('button', { name: /Thêm Nơi này có anh/ }));

      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(screen.queryByText('Nơi này có anh')).not.toBeInTheDocument();
    });

    it('shows empty results when search returns nothing', async () => {
      mockSearch.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
      renderQueue();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'xyz123' } });
      await act(async () => { vi.advanceTimersByTime(300); });
      await act(async () => {});

      expect(screen.queryByLabelText('Kết quả tìm kiếm')).not.toBeInTheDocument();
    });

    it('hides results when query is cleared', async () => {
      mockSearch.mockResolvedValue({ items: SEARCH_RESULTS, nextCursor: null, hasMore: false });
      renderQueue();

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'tùng' } });
      await act(async () => { vi.advanceTimersByTime(300); });
      await act(async () => {});

      fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
      await act(async () => { vi.advanceTimersByTime(100); });

      expect(screen.queryByText('Nơi này có anh')).not.toBeInTheDocument();
    });
  });

  describe('Queue list — empty state', () => {
    it('shows empty hint when queue is empty', () => {
      renderQueue([]);
      expect(screen.getByText('Hàng chờ trống')).toBeInTheDocument();
      expect(screen.getByText(/Tìm bài hát bên trên/)).toBeInTheDocument();
    });

    it('shows queue count of 0', () => {
      renderQueue([]);
      expect(screen.getByText('Hàng chờ (0)')).toBeInTheDocument();
    });
  });

  describe('Queue list — with items', () => {
    it('shows queue count matching items length', () => {
      renderQueue(QUEUE_ITEMS);
      expect(screen.getByText('Hàng chờ (2)')).toBeInTheDocument();
    });

    it('renders loading skeleton while metadata is being fetched', () => {
      renderQueue(QUEUE_ITEMS);
      // Before getSong resolves, skeleton placeholders are shown (no title text yet)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows remove button only for songs added by current user', () => {
      renderQueue(QUEUE_ITEMS);
      expect(screen.getByRole('button', { name: 'Xóa khỏi hàng chờ' })).toBeInTheDocument();
      // Only 1 remove button — song-bbb was added by user-002
    });

    it('calls onRemoveSong with correct songId', () => {
      const { onRemoveSong } = renderQueue(QUEUE_ITEMS);
      fireEvent.click(screen.getByRole('button', { name: 'Xóa khỏi hàng chờ' }));
      expect(onRemoveSong).toHaveBeenCalledWith('song-aaa');
    });

    it('does not show remove button for songs added by other users', () => {
      const otherItems: QueueItem[] = [{ songId: 'song-zzz', addedByUserId: 'user-999' }];
      renderQueue(otherItems);
      expect(screen.queryByRole('button', { name: 'Xóa khỏi hàng chờ' })).not.toBeInTheDocument();
    });

    it('renders position numbers (1, 2, ...)', () => {
      renderQueue(QUEUE_ITEMS);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('Song metadata enrichment (real timers)', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });
    afterEach(() => {
      vi.useFakeTimers();
    });

    it('renders song title after getSong resolves', async () => {
      renderQueue(QUEUE_ITEMS);
      await waitFor(() => {
        expect(screen.getAllByText('Mock Title').length).toBeGreaterThan(0);
      });
    });
  });
});
