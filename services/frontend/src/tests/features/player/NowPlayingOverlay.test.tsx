import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NowPlayingOverlay from '../../../features/player/components/NowPlayingOverlay';
import { usePlayerStore } from '../../../store/playerStore';

// ── Mock searchService ────────────────────────────────────────────────────────
vi.mock('../../../services/searchService', () => ({
  searchContent: vi.fn(),
}));

import { searchContent } from '../../../services/searchService';
const mockSearchContent = vi.mocked(searchContent);

// ── Mock song ─────────────────────────────────────────────────────────────────

const MOCK_SONG = {
  songId:   'song-001',
  title:    'Chuyến Xe',
  artist:   'Ngọt',
  coverUrl: 'https://picsum.photos/seed/test/300/300',
};

// ── Reset store before each test ──────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  usePlayerStore.setState({ queue: [], currentSong: null });
  mockSearchContent.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
});

// ── Default props ─────────────────────────────────────────────────────────────

function renderOverlay(overrides: Partial<Parameters<typeof NowPlayingOverlay>[0]> = {}) {
  const defaults = {
    currentSong:   MOCK_SONG,
    isPlaying:     false,
    currentTime:   84,      // 1:24
    duration:      245,     // 4:05
    loading:       false,
    onTogglePlay:  vi.fn(),
    onSeek:        vi.fn(),
    onClose:       vi.fn(),
  };
  return render(<NowPlayingOverlay {...defaults} {...overrides} />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('NowPlayingOverlay — render', () => {
  it('renders with role=dialog and data-testid', () => {
    renderOverlay();
    expect(screen.getByTestId('now-playing-overlay')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /now playing/i })).toBeInTheDocument();
  });

  it('displays song title and artist', () => {
    renderOverlay();
    expect(screen.getByText('Chuyến Xe')).toBeInTheDocument();
    expect(screen.getByText('Ngọt')).toBeInTheDocument();
  });

  it('displays formatted time (1:24 / 4:05)', () => {
    renderOverlay();
    expect(screen.getByText('1:24')).toBeInTheDocument();
    expect(screen.getByText('4:05')).toBeInTheDocument();
  });

  it('shows album art when coverUrl provided', () => {
    renderOverlay();
    const img = screen.getByRole('img', { name: 'Chuyến Xe' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', MOCK_SONG.coverUrl);
  });

  it('shows music_note fallback when no coverUrl', () => {
    renderOverlay({ currentSong: { ...MOCK_SONG, coverUrl: undefined } });
    expect(screen.queryByRole('img', { name: 'Chuyến Xe' })).not.toBeInTheDocument();
  });

  it('shows play icon when not playing', () => {
    renderOverlay({ isPlaying: false });
    const btn = screen.getByTestId('overlay-play-btn');
    expect(btn).toHaveAttribute('aria-label', 'Phát');
  });

  it('shows pause icon when playing', () => {
    renderOverlay({ isPlaying: true });
    const btn = screen.getByTestId('overlay-play-btn');
    expect(btn).toHaveAttribute('aria-label', 'Dừng');
  });

  it('disables play button when loading', () => {
    renderOverlay({ loading: true });
    expect(screen.getByTestId('overlay-play-btn')).toBeDisabled();
  });
});

describe('NowPlayingOverlay — controls', () => {
  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    fireEvent.click(screen.getByTestId('overlay-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onTogglePlay when play button is clicked', () => {
    const onTogglePlay = vi.fn();
    renderOverlay({ onTogglePlay });
    fireEvent.click(screen.getByTestId('overlay-play-btn'));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('calls onSeek when seek bar value changes', () => {
    const onSeek = vi.fn();
    renderOverlay({ onSeek });
    const seekBar = screen.getByTestId('overlay-seekbar');
    fireEvent.change(seekBar, { target: { value: '120' } });
    expect(onSeek).toHaveBeenCalledWith(120);
  });
});

describe('NowPlayingOverlay — tabs', () => {
  it('renders 3 tabs: Lời bài hát, Hàng chờ, Liên quan', () => {
    renderOverlay();
    expect(screen.getByTestId('tab-lyrics')).toBeInTheDocument();
    expect(screen.getByTestId('tab-queue')).toBeInTheDocument();
    expect(screen.getByTestId('tab-related')).toBeInTheDocument();
  });

  it('lyrics tab is active by default', () => {
    renderOverlay();
    expect(screen.getByTestId('tab-lyrics')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-content-lyrics')).toBeInTheDocument();
  });

  it('switches to queue tab on click', () => {
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-queue'));
    expect(screen.getByTestId('tab-queue')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-content-queue')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-content-lyrics')).not.toBeInTheDocument();
  });

  it('switches to related tab on click', () => {
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-related'));
    expect(screen.getByTestId('tab-related')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-content-related')).toBeInTheDocument();
  });

  it('lyrics tab contains mock lyric lines', () => {
    renderOverlay();
    expect(screen.getByTestId('tab-content-lyrics')).toHaveTextContent('Tôi đã thấy những ngôi sao');
    expect(screen.getByTestId('tab-content-lyrics')).toHaveTextContent('chuyến xe này sẽ đi về đâu');
  });
});

// ── Playback control buttons ──────────────────────────────────────────────────

describe('NowPlayingOverlay — playback control buttons', () => {
  it('shuffle button has aria-pressed=false by default', () => {
    usePlayerStore.setState({ shuffle: false });
    renderOverlay();
    expect(screen.getByTestId('overlay-shuffle-btn')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shuffle button has aria-pressed=true when shuffle is on', () => {
    usePlayerStore.setState({ shuffle: true });
    renderOverlay();
    expect(screen.getByTestId('overlay-shuffle-btn')).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking shuffle button toggles shuffle state', () => {
    usePlayerStore.setState({ shuffle: false });
    renderOverlay();
    fireEvent.click(screen.getByTestId('overlay-shuffle-btn'));
    expect(usePlayerStore.getState().shuffle).toBe(true);
  });

  it('repeat button shows repeat icon when repeat=none', () => {
    usePlayerStore.setState({ repeat: 'none' });
    renderOverlay();
    const btn = screen.getByTestId('overlay-repeat-btn');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn.textContent).toContain('repeat');
  });

  it('repeat button shows repeat_one icon when repeat=one', () => {
    usePlayerStore.setState({ repeat: 'one' });
    renderOverlay();
    const btn = screen.getByTestId('overlay-repeat-btn');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn.textContent).toContain('repeat_one');
  });

  it('clicking repeat cycles none → one → all → none', () => {
    usePlayerStore.setState({ repeat: 'none' });
    renderOverlay();
    fireEvent.click(screen.getByTestId('overlay-repeat-btn'));
    expect(usePlayerStore.getState().repeat).toBe('one');
    fireEvent.click(screen.getByTestId('overlay-repeat-btn'));
    expect(usePlayerStore.getState().repeat).toBe('all');
    fireEvent.click(screen.getByTestId('overlay-repeat-btn'));
    expect(usePlayerStore.getState().repeat).toBe('none');
  });

  it('clicking prev button calls playPrev', () => {
    usePlayerStore.setState({ currentSong: { songId: 'prev-1', title: 'Prev', artist: 'X' }, history: [MOCK_SONG] });
    renderOverlay();
    fireEvent.click(screen.getByTestId('overlay-prev-btn'));
    expect(usePlayerStore.getState().currentSong?.songId).toBe(MOCK_SONG.songId);
  });

  it('clicking next button calls playNext (pops queue)', () => {
    const nextSong = { songId: 'next-1', title: 'Next Song', artist: 'Y' };
    usePlayerStore.setState({ queue: [nextSong], shuffle: false, repeat: 'none' });
    renderOverlay();
    fireEvent.click(screen.getByTestId('overlay-next-btn'));
    expect(usePlayerStore.getState().currentSong?.songId).toBe(nextSong.songId);
  });
});

// ── Queue tab ─────────────────────────────────────────────────────────────────

describe('NowPlayingOverlay — queue tab', () => {
  it('shows empty state when queue is empty', () => {
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-queue'));
    expect(screen.getByTestId('tab-content-queue')).toHaveTextContent('Hàng chờ trống');
    expect(screen.queryByTestId('queue-item-0')).not.toBeInTheDocument();
  });

  it('renders queued songs from playerStore', () => {
    usePlayerStore.setState({
      queue: [
        { songId: 'sq-1', title: 'Bài Hát 1', artist: 'Ca Sĩ A', coverUrl: 'https://example.com/1.jpg' },
        { songId: 'sq-2', title: 'Bài Hát 2', artist: 'Ca Sĩ B' },
      ],
    });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-queue'));
    expect(screen.getByTestId('queue-item-0')).toBeInTheDocument();
    expect(screen.getByTestId('queue-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('tab-content-queue')).toHaveTextContent('Bài Hát 1');
    expect(screen.getByTestId('tab-content-queue')).toHaveTextContent('Ca Sĩ A');
    expect(screen.getByTestId('tab-content-queue')).toHaveTextContent('Bài Hát 2');
  });

  it('renders cover image for queued song when coverUrl present', () => {
    usePlayerStore.setState({
      queue: [{ songId: 'sq-1', title: 'Song 1', artist: 'Artist 1', coverUrl: 'https://example.com/cover.jpg' }],
    });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-queue'));
    const img = screen.getByRole('img', { name: 'Song 1' });
    expect(img).toHaveAttribute('src', 'https://example.com/cover.jpg');
  });

  it('calls removeFromQueue with correct index when remove button clicked', () => {
    usePlayerStore.setState({
      queue: [
        { songId: 'sq-1', title: 'Song A', artist: 'Artist A' },
        { songId: 'sq-2', title: 'Song B', artist: 'Artist B' },
      ],
    });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-queue'));
    fireEvent.click(screen.getByTestId('queue-remove-1'));
    const { queue } = usePlayerStore.getState();
    expect(queue).toHaveLength(1);
    expect(queue[0].songId).toBe('sq-1');
  });

  it('clicking a queue item plays it via playFromQueue', () => {
    usePlayerStore.setState({
      currentSong: MOCK_SONG,
      queue: [
        { songId: 'sq-play-1', title: 'Bài Chọn', artist: 'Ca Sĩ' },
        { songId: 'sq-play-2', title: 'Bài Kia',  artist: 'Ca Sĩ' },
      ],
    });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-queue'));
    fireEvent.click(screen.getByTestId('queue-item-0'));
    expect(usePlayerStore.getState().currentSong?.songId).toBe('sq-play-1');
    expect(usePlayerStore.getState().queue).toHaveLength(1);
  });

  it('clicking remove does NOT trigger playFromQueue', () => {
    usePlayerStore.setState({
      currentSong: MOCK_SONG,
      queue: [{ songId: 'sq-x', title: 'Song X', artist: 'Art' }],
    });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-queue'));
    fireEvent.click(screen.getByTestId('queue-remove-0'));
    expect(usePlayerStore.getState().currentSong?.songId).toBe(MOCK_SONG.songId);
    expect(usePlayerStore.getState().queue).toHaveLength(0);
  });

  it('remove button has accessible label', () => {
    usePlayerStore.setState({
      queue: [{ songId: 'sq-1', title: 'Sóng Gió', artist: 'Jack' }],
    });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-queue'));
    expect(screen.getByRole('button', { name: /xóa sóng gió/i })).toBeInTheDocument();
  });
});

// ── Related tab ───────────────────────────────────────────────────────────────

describe('NowPlayingOverlay — related tab', () => {
  it('shows loading spinner while fetching', () => {
    // never resolves during this test
    mockSearchContent.mockReturnValue(new Promise(() => {}));
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-related'));
    expect(screen.getByTestId('related-loading')).toBeInTheDocument();
  });

  it('calls searchContent with artist name and type=song', async () => {
    mockSearchContent.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-related'));
    await waitFor(() => expect(mockSearchContent).toHaveBeenCalledWith('Ngọt', 'song', 20));
  });

  it('renders related songs after fetch', async () => {
    mockSearchContent.mockResolvedValue({
      items: [
        { id: 'r-1', name: 'Bài Liên Quan 1', type: 'song' as const, score: 1, artist: 'Ngọt', duration: 210 },
        { id: 'r-2', name: 'Bài Liên Quan 2', type: 'song' as const, score: 0.9, artist: 'Ngọt', duration: 185 },
      ],
      nextCursor: null,
      hasMore: false,
    });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-related'));
    await waitFor(() => expect(screen.getByTestId('related-item-r-1')).toBeInTheDocument());
    expect(screen.getByTestId('tab-content-related')).toHaveTextContent('Bài Liên Quan 1');
    expect(screen.getByTestId('tab-content-related')).toHaveTextContent('Bài Liên Quan 2');
    expect(screen.getByTestId('tab-content-related')).toHaveTextContent('3:30');
  });

  it('filters out the current song from related results', async () => {
    mockSearchContent.mockResolvedValue({
      items: [
        { id: 'song-001', name: 'Chuyến Xe', type: 'song' as const, score: 1, artist: 'Ngọt', duration: 210 },
        { id: 'r-2', name: 'Bài Khác', type: 'song' as const, score: 0.9, artist: 'Ngọt', duration: 185 },
      ],
      nextCursor: null,
      hasMore: false,
    });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-related'));
    await waitFor(() => expect(screen.queryByTestId('related-loading')).not.toBeInTheDocument());
    expect(screen.queryByTestId('related-item-song-001')).not.toBeInTheDocument();
    expect(screen.getByTestId('related-item-r-2')).toBeInTheDocument();
  });

  it('shows empty state when no related songs found', async () => {
    mockSearchContent.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-related'));
    await waitFor(() => expect(screen.getByTestId('tab-content-related')).toHaveTextContent('Không có bài hát liên quan'));
    expect(screen.queryByTestId('related-loading')).not.toBeInTheDocument();
  });

  it('calls playSong when related song clicked', async () => {
    mockSearchContent.mockResolvedValue({
      items: [
        { id: 'r-1', name: 'Bài Liên Quan', type: 'song' as const, score: 1, artist: 'Ngọt', duration: 210, coverUrl: 'https://example.com/r1.jpg' },
      ],
      nextCursor: null,
      hasMore: false,
    });
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-related'));
    await waitFor(() => expect(screen.getByTestId('related-item-r-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('related-item-r-1'));
    const { currentSong } = usePlayerStore.getState();
    expect(currentSong?.songId).toBe('r-1');
    expect(currentSong?.title).toBe('Bài Liên Quan');
    expect(currentSong?.artist).toBe('Ngọt');
  });

  it('shows empty state when fetch fails', async () => {
    mockSearchContent.mockRejectedValue(new Error('network error'));
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-related'));
    await waitFor(() => expect(screen.getByTestId('tab-content-related')).toHaveTextContent('Không có bài hát liên quan'));
  });

  it('refetches when currentSong changes while on related tab', async () => {
    mockSearchContent.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    const { rerender } = renderOverlay();
    fireEvent.click(screen.getByTestId('tab-related'));
    await waitFor(() => expect(mockSearchContent).toHaveBeenCalledTimes(1));

    rerender(
      <NowPlayingOverlay
        currentSong={{ songId: 'song-999', title: 'Khác', artist: 'Sơn Tùng', coverUrl: undefined }}
        isPlaying={false}
        currentTime={0}
        duration={200}
        loading={false}
        onTogglePlay={vi.fn()}
        onSeek={vi.fn()}
        onClose={vi.fn()}
      />
    );
    await waitFor(() => expect(mockSearchContent).toHaveBeenCalledTimes(2));
    expect(mockSearchContent).toHaveBeenLastCalledWith('Sơn Tùng', 'song', 20);
  });
});
