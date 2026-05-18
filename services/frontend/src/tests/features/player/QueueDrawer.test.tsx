import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QueueDrawer from '../../../features/player/components/QueueDrawer';
import { usePlayerStore } from '../../../store/playerStore';

const SONG_A = { songId: 'song-001', title: 'Lạc Trôi', artist: 'Sơn Tùng M-TP', coverUrl: 'https://picsum.photos/seed/a/60/60' };
const SONG_B = { songId: 'song-002', title: 'Có Chắc Yêu Là Đây', artist: 'Sơn Tùng M-TP' };
const SONG_C = { songId: 'song-003', title: 'Chuyến Xe', artist: 'Ngọt' };

beforeEach(() => {
  usePlayerStore.setState({ currentSong: null, queue: [] });
});

// ── Visibility / slide behaviour ──────────────────────────────────────────

describe('QueueDrawer visibility', () => {
  it('renders with translate-x-full when closed', () => {
    render(<QueueDrawer isOpen={false} onClose={vi.fn()} />);
    const drawer = screen.getByTestId('queue-drawer');
    expect(drawer.className).toContain('translate-x-full');
  });

  it('renders with translate-x-0 when open', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    const drawer = screen.getByTestId('queue-drawer');
    expect(drawer.className).toContain('translate-x-0');
  });

  it('does not render backdrop when closed', () => {
    render(<QueueDrawer isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('queue-backdrop')).not.toBeInTheDocument();
  });

  it('renders backdrop when open', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('queue-backdrop')).toBeInTheDocument();
  });
});

// ── Close interactions ────────────────────────────────────────────────────

describe('QueueDrawer close', () => {
  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<QueueDrawer isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Đóng hàng chờ'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(<QueueDrawer isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('queue-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── Empty state ───────────────────────────────────────────────────────────

describe('QueueDrawer empty state', () => {
  it('shows empty message when no song and no queue', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Hàng chờ trống')).toBeInTheDocument();
  });

  it('does not show empty state when currentSong exists', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('Hàng chờ trống')).not.toBeInTheDocument();
  });

  it('shows "Không có bài tiếp theo" when playing but queue empty', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Không có bài tiếp theo.')).toBeInTheDocument();
  });
});

// ── Now Playing row ────────────────────────────────────────────────────────

describe('QueueDrawer now playing row', () => {
  it('shows now playing row when currentSong is set', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('now-playing-row')).toBeInTheDocument();
    expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    expect(screen.getByText('Sơn Tùng M-TP')).toBeInTheDocument();
  });

  it('has ring-spotify-green class on now playing row', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('now-playing-row').className).toContain('ring-spotify-green');
  });

  it('does not render now playing row when no currentSong', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByTestId('now-playing-row')).not.toBeInTheDocument();
  });

  it('renders cover image when coverUrl is provided', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs.some(img => img.getAttribute('src') === SONG_A.coverUrl)).toBe(true);
  });

  it('renders placeholder icon when coverUrl is absent', () => {
    usePlayerStore.setState({ currentSong: SONG_B, queue: [] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

// ── Queue items ───────────────────────────────────────────────────────────

describe('QueueDrawer queue items', () => {
  beforeEach(() => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [SONG_B, SONG_C] });
  });

  it('renders all queue items', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('queue-item-0')).toBeInTheDocument();
    expect(screen.getByTestId('queue-item-1')).toBeInTheDocument();
  });

  it('shows queue count in section label', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Tiếp theo (2)')).toBeInTheDocument();
  });

  it('shows title and artist for each queue item', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Có Chắc Yêu Là Đây')).toBeInTheDocument();
    expect(screen.getByText('Chuyến Xe')).toBeInTheDocument();
    expect(screen.getByText('Ngọt')).toBeInTheDocument();
  });

  it('calls removeFromQueue when remove button clicked', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(`Xóa ${SONG_B.title} khỏi hàng chờ`));
    const { queue } = usePlayerStore.getState();
    expect(queue).toHaveLength(1);
    expect(queue[0].songId).toBe(SONG_C.songId);
  });

  it('removes correct item by index', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(`Xóa ${SONG_C.title} khỏi hàng chờ`));
    const { queue } = usePlayerStore.getState();
    expect(queue).toHaveLength(1);
    expect(queue[0].songId).toBe(SONG_B.songId);
  });
});

// ── Clear all ─────────────────────────────────────────────────────────────

describe('QueueDrawer clear all', () => {
  it('does not show "Xóa tất cả" when queue is empty', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.queryByText('Xóa tất cả')).not.toBeInTheDocument();
  });

  it('shows "Xóa tất cả" button when queue has items', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [SONG_B] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Xóa tất cả')).toBeInTheDocument();
  });

  it('clears all queue items when "Xóa tất cả" clicked', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [SONG_B, SONG_C] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Xóa tất cả'));
    const { queue } = usePlayerStore.getState();
    expect(queue).toHaveLength(0);
  });

  it('does not affect currentSong when clearing queue', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [SONG_B] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Xóa tất cả'));
    expect(usePlayerStore.getState().currentSong?.songId).toBe(SONG_A.songId);
  });
});

// ── playerStore queue actions ──────────────────────────────────────────────

describe('playerStore queue actions', () => {
  it('addToQueue appends song to queue', () => {
    usePlayerStore.getState().addToQueue(SONG_A);
    usePlayerStore.getState().addToQueue(SONG_B);
    expect(usePlayerStore.getState().queue).toHaveLength(2);
    expect(usePlayerStore.getState().queue[0].songId).toBe(SONG_A.songId);
    expect(usePlayerStore.getState().queue[1].songId).toBe(SONG_B.songId);
  });

  it('addToQueue deduplicates — same songId is not added twice', () => {
    usePlayerStore.getState().addToQueue(SONG_A);
    usePlayerStore.getState().addToQueue(SONG_A);
    expect(usePlayerStore.getState().queue).toHaveLength(1);
  });

  it('addToQueue ignores song that is currently playing', () => {
    usePlayerStore.setState({ currentSong: SONG_A });
    usePlayerStore.getState().addToQueue(SONG_A);
    expect(usePlayerStore.getState().queue).toHaveLength(0);
  });

  it('removeFromQueue removes by index without mutating other items', () => {
    usePlayerStore.setState({ queue: [SONG_A, SONG_B, SONG_C] });
    usePlayerStore.getState().removeFromQueue(1);
    const q = usePlayerStore.getState().queue;
    expect(q).toHaveLength(2);
    expect(q[0].songId).toBe(SONG_A.songId);
    expect(q[1].songId).toBe(SONG_C.songId);
  });

  it('clearQueue empties queue', () => {
    usePlayerStore.setState({ queue: [SONG_A, SONG_B] });
    usePlayerStore.getState().clearQueue();
    expect(usePlayerStore.getState().queue).toHaveLength(0);
  });

  it('queue is empty array by default', () => {
    usePlayerStore.setState({ queue: [] });
    expect(usePlayerStore.getState().queue).toEqual([]);
  });

  it('playSong does not affect queue', () => {
    usePlayerStore.setState({ queue: [SONG_B] });
    usePlayerStore.getState().playSong(SONG_A);
    expect(usePlayerStore.getState().queue).toHaveLength(1);
    expect(usePlayerStore.getState().currentSong?.songId).toBe(SONG_A.songId);
  });

  it('playSong pushes previous currentSong to history', () => {
    usePlayerStore.setState({ currentSong: SONG_A, history: [] });
    usePlayerStore.getState().playSong(SONG_B);
    expect(usePlayerStore.getState().history).toHaveLength(1);
    expect(usePlayerStore.getState().history[0].songId).toBe(SONG_A.songId);
  });

  it('playFromQueue moves song from queue to currentSong and adds current to history', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [SONG_B, SONG_C], history: [] });
    usePlayerStore.getState().playFromQueue(0);
    const s = usePlayerStore.getState();
    expect(s.currentSong?.songId).toBe(SONG_B.songId);
    expect(s.currentSong?.autoPlay).toBe(true);
    expect(s.queue).toHaveLength(1);
    expect(s.queue[0].songId).toBe(SONG_C.songId);
    expect(s.history[0].songId).toBe(SONG_A.songId);
  });

  it('playNext pops first queue item when shuffle is off', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [SONG_B, SONG_C], shuffle: false, repeat: 'none' });
    usePlayerStore.getState().playNext();
    expect(usePlayerStore.getState().currentSong?.songId).toBe(SONG_B.songId);
    expect(usePlayerStore.getState().queue).toHaveLength(1);
  });

  it('playNext does nothing when queue is empty and repeat is none', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [], repeat: 'none' });
    usePlayerStore.getState().playNext();
    expect(usePlayerStore.getState().currentSong?.songId).toBe(SONG_A.songId);
  });

  it('playNext replays current song when repeat is one', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [SONG_B], repeat: 'one' });
    usePlayerStore.getState().playNext();
    expect(usePlayerStore.getState().currentSong?.songId).toBe(SONG_A.songId);
    expect(usePlayerStore.getState().currentSong?.autoPlay).toBe(true);
    expect(usePlayerStore.getState().queue).toHaveLength(1);
  });

  it('playPrev restores previous song from history', () => {
    usePlayerStore.setState({ currentSong: SONG_B, history: [SONG_A], queue: [] });
    usePlayerStore.getState().playPrev();
    const s = usePlayerStore.getState();
    expect(s.currentSong?.songId).toBe(SONG_A.songId);
    expect(s.history).toHaveLength(0);
    expect(s.queue[0].songId).toBe(SONG_B.songId);
  });

  it('toggleShuffle flips shuffle state', () => {
    usePlayerStore.setState({ shuffle: false });
    usePlayerStore.getState().toggleShuffle();
    expect(usePlayerStore.getState().shuffle).toBe(true);
    usePlayerStore.getState().toggleShuffle();
    expect(usePlayerStore.getState().shuffle).toBe(false);
  });

  it('toggleRepeat cycles none → one → all → none', () => {
    usePlayerStore.setState({ repeat: 'none' });
    usePlayerStore.getState().toggleRepeat();
    expect(usePlayerStore.getState().repeat).toBe('one');
    usePlayerStore.getState().toggleRepeat();
    expect(usePlayerStore.getState().repeat).toBe('all');
    usePlayerStore.getState().toggleRepeat();
    expect(usePlayerStore.getState().repeat).toBe('none');
  });
});

// ── QueueDrawer click to play ─────────────────────────────────────────────

describe('QueueDrawer click to play', () => {
  it('clicking a queue item plays it and removes from queue', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [SONG_B, SONG_C] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: `Phát ${SONG_B.title}` }));
    const s = usePlayerStore.getState();
    expect(s.currentSong?.songId).toBe(SONG_B.songId);
    expect(s.queue).toHaveLength(1);
    expect(s.queue[0].songId).toBe(SONG_C.songId);
  });

  it('clicking remove button does NOT trigger play', () => {
    usePlayerStore.setState({ currentSong: SONG_A, queue: [SONG_B] });
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(`Xóa ${SONG_B.title} khỏi hàng chờ`));
    expect(usePlayerStore.getState().currentSong?.songId).toBe(SONG_A.songId);
    expect(usePlayerStore.getState().queue).toHaveLength(0);
  });
});

// ── Accessibility ─────────────────────────────────────────────────────────

describe('QueueDrawer accessibility', () => {
  it('has aria-label on the drawer panel', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('complementary', { name: 'Hàng chờ phát nhạc' })).toBeInTheDocument();
  });

  it('header title "Hàng chờ" is always visible', () => {
    render(<QueueDrawer isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Hàng chờ' })).toBeInTheDocument();
  });
});
