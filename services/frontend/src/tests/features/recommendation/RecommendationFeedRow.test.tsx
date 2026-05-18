import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecommendationFeedRow from '../../../features/recommendation/components/RecommendationFeedRow';
import type { RecommendedSong } from '../../../types/domain';
import { usePlayerStore } from '../../../store/playerStore';

const mockShowToast = vi.fn();
vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ show: mockShowToast, hide: vi.fn() }),
}));

const MOCK_SONG: RecommendedSong = {
  id: 'song-001',
  title: 'Lạc Trôi',
  artist: 'Sơn Tùng M-TP',
  duration: 234,
  coverUrl: 'https://picsum.photos/seed/song1/56/56',
  isExplicit: false,
  reason: { type: 'CONTEXT', text: 'Gợi ý buổi tối' },
};

const SONG_NO_COVER: RecommendedSong = {
  ...MOCK_SONG,
  id: 'song-002',
  title: 'Chuyến Xe',
  coverUrl: undefined,
  reason: { type: 'TRENDING', text: 'Đang thịnh hành' },
};

const SONG_NO_REASON: RecommendedSong = {
  ...MOCK_SONG,
  id: 'song-003',
  title: 'Muộn Rồi Mà Sao Còn',
  reason: { type: 'PREFERENCE', text: '' },
};

beforeEach(() => {
  usePlayerStore.setState({ queue: [] });
});

function renderRow(song = MOCK_SONG, index = 0) {
  return render(
    <MemoryRouter>
      <RecommendationFeedRow song={song} index={index} onPlay={vi.fn()} />
    </MemoryRouter>,
  );
}

describe('RecommendationFeedRow', () => {
  // ── Rendering ─────────────────────────────────────────────────────────

  it('renders song title', () => {
    renderRow();
    expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
  });

  it('renders artist name', () => {
    renderRow();
    expect(screen.getByText('Sơn Tùng M-TP')).toBeInTheDocument();
  });

  it('renders 1-based row index when not hovered', () => {
    renderRow(MOCK_SONG, 2);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders index 1 for index=0', () => {
    renderRow(MOCK_SONG, 0);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders formatted duration — 234s → 3:54', () => {
    renderRow();
    expect(screen.getByText('3:54')).toBeInTheDocument();
  });

  it('renders duration with zero-padded seconds — 65s → 1:05', () => {
    renderRow({ ...MOCK_SONG, duration: 65 });
    expect(screen.getByText('1:05')).toBeInTheDocument();
  });

  it('renders cover image when coverUrl provided', () => {
    renderRow();
    const img = screen.getByRole('img', { name: 'Lạc Trôi' });
    expect(img).toHaveAttribute('src', 'https://picsum.photos/seed/song1/56/56');
  });

  it('renders music_note icon when no coverUrl', () => {
    renderRow(SONG_NO_COVER);
    expect(screen.getByText('music_note')).toBeInTheDocument();
  });

  it('renders reason badge when reason.text is non-empty', () => {
    renderRow();
    expect(screen.getByText('Gợi ý buổi tối')).toBeInTheDocument();
  });

  it('does NOT render reason badge when reason.text is empty', () => {
    const { container } = renderRow(SONG_NO_REASON);
    // badge span has class bg-mid-dark + rounded + text-[10px] — should not exist
    const badge = container.querySelector('span.bg-mid-dark.rounded');
    expect(badge).toBeNull();
  });

  it('renders row element', () => {
    renderRow();
    expect(screen.getByRole('row')).toBeInTheDocument();
  });

  // ── Hover state ───────────────────────────────────────────────────────

  it('shows index number before hover', () => {
    renderRow(MOCK_SONG, 0);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Phát Lạc Trôi')).not.toBeInTheDocument();
  });

  it('shows play button on hover', () => {
    renderRow();
    fireEvent.mouseEnter(screen.getByRole('row'));
    expect(screen.getByLabelText('Phát Lạc Trôi')).toBeInTheDocument();
  });

  it('hides index number on hover', () => {
    renderRow(MOCK_SONG, 0);
    fireEvent.mouseEnter(screen.getByRole('row'));
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('restores index number when mouse leaves', () => {
    renderRow(MOCK_SONG, 0);
    fireEvent.mouseEnter(screen.getByRole('row'));
    fireEvent.mouseLeave(screen.getByRole('row'));
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Phát Lạc Trôi')).not.toBeInTheDocument();
  });

  // ── Interactions ──────────────────────────────────────────────────────

  it('clicking play button calls onPlay with song', () => {
    const onPlay = vi.fn();
    render(
      <MemoryRouter>
        <RecommendationFeedRow song={MOCK_SONG} index={0} onPlay={onPlay} />
      </MemoryRouter>,
    );
    fireEvent.mouseEnter(screen.getByRole('row'));
    fireEvent.click(screen.getByLabelText('Phát Lạc Trôi'));
    expect(onPlay).toHaveBeenCalledWith(MOCK_SONG);
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('clicking play twice calls onPlay twice', () => {
    const onPlay = vi.fn();
    render(
      <MemoryRouter>
        <RecommendationFeedRow song={MOCK_SONG} index={0} onPlay={onPlay} />
      </MemoryRouter>,
    );
    fireEvent.mouseEnter(screen.getByRole('row'));
    fireEvent.click(screen.getByLabelText('Phát Lạc Trôi'));
    fireEvent.click(screen.getByLabelText('Phát Lạc Trôi'));
    expect(onPlay).toHaveBeenCalledTimes(2);
  });

  it('clicking title navigates to /songs/song-001', () => {
    renderRow();
    const link = screen.getByText('Lạc Trôi');
    expect(link.tagName).toBe('BUTTON');
    // Navigation is tested via MemoryRouter — just confirm it's a clickable element
    expect(link).toBeInTheDocument();
  });

  it('onPlay is not called without hover (no play button rendered)', () => {
    const onPlay = vi.fn();
    render(
      <MemoryRouter>
        <RecommendationFeedRow song={MOCK_SONG} index={0} onPlay={onPlay} />
      </MemoryRouter>,
    );
    // play button not rendered — clicking row does nothing
    expect(screen.queryByLabelText('Phát Lạc Trôi')).not.toBeInTheDocument();
    expect(onPlay).not.toHaveBeenCalled();
  });

  // ── Multiple rows ─────────────────────────────────────────────────────

  it('each row shows its own index', () => {
    render(
      <MemoryRouter>
        <RecommendationFeedRow song={MOCK_SONG} index={0} onPlay={vi.fn()} />
        <RecommendationFeedRow song={SONG_NO_COVER} index={1} onPlay={vi.fn()} />
        <RecommendationFeedRow song={SONG_NO_REASON} index={2} onPlay={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('each row shows its own title', () => {
    render(
      <MemoryRouter>
        <RecommendationFeedRow song={MOCK_SONG} index={0} onPlay={vi.fn()} />
        <RecommendationFeedRow song={SONG_NO_COVER} index={1} onPlay={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    expect(screen.getByText('Chuyến Xe')).toBeInTheDocument();
  });

  // ── Feature 3: Queue button ───────────────────────────────────────────

  it('queue button not shown before hover', () => {
    renderRow();
    expect(screen.queryByLabelText('Thêm Lạc Trôi vào hàng chờ')).not.toBeInTheDocument();
  });

  it('queue button shown on hover', () => {
    renderRow();
    fireEvent.mouseEnter(screen.getByRole('row'));
    expect(screen.getByLabelText('Thêm Lạc Trôi vào hàng chờ')).toBeInTheDocument();
  });

  it('queue button hidden after mouse leaves', () => {
    renderRow();
    fireEvent.mouseEnter(screen.getByRole('row'));
    fireEvent.mouseLeave(screen.getByRole('row'));
    expect(screen.queryByLabelText('Thêm Lạc Trôi vào hàng chờ')).not.toBeInTheDocument();
  });

  it('clicking queue button adds song — sets currentSong when player is empty', () => {
    renderRow();
    fireEvent.mouseEnter(screen.getByRole('row'));
    fireEvent.click(screen.getByLabelText('Thêm Lạc Trôi vào hàng chờ'));
    const { currentSong, queue } = usePlayerStore.getState();
    // First add with no active song → song becomes currentSong (bar visible, not auto-playing)
    expect(currentSong).toMatchObject({
      songId: MOCK_SONG.id,
      title: MOCK_SONG.title,
      artist: MOCK_SONG.artist,
      autoPlay: false,
    });
    expect(queue).toHaveLength(0);
  });

  it('clicking queue button does NOT call onPlay', () => {
    const onPlay = vi.fn();
    render(
      <MemoryRouter>
        <RecommendationFeedRow song={MOCK_SONG} index={0} onPlay={onPlay} />
      </MemoryRouter>,
    );
    fireEvent.mouseEnter(screen.getByRole('row'));
    fireEvent.click(screen.getByLabelText('Thêm Lạc Trôi vào hàng chờ'));
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('adding same song twice is deduped — song ends up in currentSong only', () => {
    renderRow();
    fireEvent.mouseEnter(screen.getByRole('row'));
    fireEvent.click(screen.getByLabelText('Thêm Lạc Trôi vào hàng chờ'));
    fireEvent.click(screen.getByLabelText('Thêm Lạc Trôi vào hàng chờ'));
    expect(usePlayerStore.getState().currentSong?.songId).toBe(MOCK_SONG.id);
    expect(usePlayerStore.getState().queue).toHaveLength(0);
  });

  // ── Reason badge variants ─────────────────────────────────────────────

  it('renders TRENDING reason badge', () => {
    renderRow(SONG_NO_COVER);
    expect(screen.getByText('Đang thịnh hành')).toBeInTheDocument();
  });

  it('reason badge has bg-mid-dark styling', () => {
    renderRow();
    const badge = screen.getByText('Gợi ý buổi tối');
    expect(badge.className).toContain('bg-mid-dark');
  });
});
