import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SongCard from '../../../features/recommendation/components/SongCard';
import type { RecommendedSong } from '../../../types/domain';

const MOCK_SONG: RecommendedSong = {
  id: 'song-abc123',
  title: 'Lạc Trôi',
  artist: 'Sơn Tùng M-TP',
  duration: 234,
  coverUrl: 'https://picsum.photos/seed/song1/160/160',
  isExplicit: false,
  reason: { type: 'CONTEXT', text: 'Gợi ý buổi tối' },
};

const SONG_NO_COVER: RecommendedSong = {
  ...MOCK_SONG,
  id: 'song-002',
  title: 'Chuyến Xe',
  coverUrl: undefined,
  reason: { type: 'TRENDING', text: '' },
};

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderCard(song = MOCK_SONG, onPlay = vi.fn()) {
  return render(
    <MemoryRouter>
      <SongCard song={song} onPlay={onPlay} />
    </MemoryRouter>,
  );
}

describe('SongCard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ── Rendering ─────────────────────────────────────────────────────────

  it('renders song title', () => {
    renderCard();
    expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
  });

  it('renders artist name', () => {
    renderCard();
    expect(screen.getByText('Sơn Tùng M-TP')).toBeInTheDocument();
  });

  it('renders cover image when coverUrl provided', () => {
    renderCard();
    const img = screen.getByRole('img', { name: 'Lạc Trôi' });
    expect(img).toHaveAttribute('src', MOCK_SONG.coverUrl);
  });

  it('renders music_note icon when no coverUrl', () => {
    renderCard(SONG_NO_COVER);
    expect(screen.getByText('music_note')).toBeInTheDocument();
  });

  it('renders explain badge when reason.text non-empty', () => {
    renderCard();
    expect(screen.getByTestId('explain-badge')).toBeInTheDocument();
    expect(screen.getByText('Gợi ý buổi tối')).toBeInTheDocument();
  });

  it('does not render explain badge when reason.text is empty', () => {
    renderCard(SONG_NO_COVER);
    expect(screen.queryByTestId('explain-badge')).not.toBeInTheDocument();
  });

  // ── Feature 2: play vs navigate separation ────────────────────────────

  it('clicking play button calls onPlay and does NOT navigate', () => {
    const onPlay = vi.fn();
    renderCard(MOCK_SONG, onPlay);
    fireEvent.click(screen.getByLabelText('Phát Lạc Trôi'));
    expect(onPlay).toHaveBeenCalledWith(MOCK_SONG);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('clicking cover area navigates to song detail without calling onPlay', () => {
    const onPlay = vi.fn();
    renderCard(MOCK_SONG, onPlay);
    fireEvent.click(screen.getByLabelText('Xem chi tiết Lạc Trôi'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it('clicking title button navigates to song detail without calling onPlay', () => {
    const onPlay = vi.fn();
    renderCard(MOCK_SONG, onPlay);
    fireEvent.click(screen.getByText('Lạc Trôi'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  // ── Feature 1: URL slug ───────────────────────────────────────────────

  it('navigates to slug URL with ?id= query param', () => {
    renderCard();
    fireEvent.click(screen.getByText('Lạc Trôi'));
    const navigatedUrl: string = mockNavigate.mock.calls[0][0];
    expect(navigatedUrl).toMatch(/^\/songs\//);
    expect(navigatedUrl).toContain(`?id=${MOCK_SONG.id}`);
  });

  it('slug URL is human-readable (no raw UUID in path segment)', () => {
    renderCard();
    fireEvent.click(screen.getByText('Lạc Trôi'));
    const navigatedUrl: string = mockNavigate.mock.calls[0][0];
    const pathSegment = navigatedUrl.split('?')[0];
    // Path should contain 'lac-troi' (Vietnamese title slugified), not the UUID
    expect(pathSegment).toContain('lac-troi');
    expect(pathSegment).not.toContain(MOCK_SONG.id);
  });

  it('play button has correct aria-label', () => {
    renderCard();
    expect(screen.getByLabelText('Phát Lạc Trôi')).toBeInTheDocument();
  });

  it('cover area has correct aria-label', () => {
    renderCard();
    expect(screen.getByLabelText('Xem chi tiết Lạc Trôi')).toBeInTheDocument();
  });
});
