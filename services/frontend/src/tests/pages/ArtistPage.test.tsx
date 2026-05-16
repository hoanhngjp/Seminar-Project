import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ArtistPage from '../../pages/ArtistPage';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';

// ── Service mock ──────────────────────────────────────────────────────────────

const { MOCK_SONGS, MOCK_ARTIST_DETAIL } = vi.hoisted(() => {
  const songs = [
    { id: 'song-001', title: 'Lạc Trôi', artist: 'Sơn Tùng M-TP', duration: 245, coverUrl: 'https://picsum.photos/seed/lactroi/300/300', isExplicit: false },
    { id: 'song-002', title: 'Có Chắc Yêu Là Đây', artist: 'Sơn Tùng M-TP', duration: 228, coverUrl: 'https://picsum.photos/seed/cochac/300/300', isExplicit: false },
  ];
  return {
    MOCK_SONGS: songs,
    MOCK_ARTIST_DETAIL: {
      id: 'artist-001',
      stageName: 'Sơn Tùng M-TP',
      bio: 'Nghệ sĩ hàng đầu Việt Nam',
      country: 'VN',
      avatarUrl: 'https://picsum.photos/seed/sontung/400/400',
      bannerImageUrl: 'https://picsum.photos/seed/sontung/400/400',
      verified: true,
      totalFollowers: 5200000,
      totalPlays: 800000000,
      songs,
    },
  };
});

vi.mock('../../services/musicService', () => ({
  getArtist: vi.fn().mockResolvedValue(MOCK_ARTIST_DETAIL),
}));

// ── Component mocks ───────────────────────────────────────────────────────────

vi.mock('../../components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

const mockPlaySong = vi.fn();

vi.mock('../../store/playerStore', () => ({
  usePlayerStore: vi.fn(),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// ── Setup ─────────────────────────────────────────────────────────────────────

function setup() {
  (usePlayerStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ playSong: mockPlaySong, currentSong: null, queue: [] })
  );
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ userId: 'user-001', role: 'Listener', accessToken: 'tok', hasCompletedOnboarding: true })
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/artists/artist-001']}>
      <Routes>
        <Route path="/artists/:artistId" element={<ArtistPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ArtistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('renders inside AppShell', () => {
    renderPage();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('renders artist hero section (loading skeleton)', () => {
    renderPage();
    expect(screen.getByTestId('artist-hero')).toBeInTheDocument();
  });

  it('shows artist name after load', async () => {
    renderPage();
    expect(await screen.findByTestId('artist-name')).toHaveTextContent(MOCK_ARTIST_DETAIL.stageName);
  });

  it('renders artist avatar after load', async () => {
    renderPage();
    expect(await screen.findByTestId('artist-avatar')).toHaveAttribute('src', MOCK_ARTIST_DETAIL.avatarUrl);
  });

  it('shows stats bar with labels after load', async () => {
    renderPage();
    const statsBar = await screen.findByTestId('stats-bar');
    expect(statsBar).toHaveTextContent('bài hát');
    expect(statsBar).toHaveTextContent('lượt nghe');
    expect(statsBar).toHaveTextContent('người theo dõi');
  });

  it('shows follower count formatted (5.2M) after load', async () => {
    renderPage();
    expect(await screen.findByTestId('stats-bar')).toHaveTextContent('5.2M');
  });

  it('shows play all button after load', async () => {
    renderPage();
    expect(await screen.findByTestId('play-all-button')).toBeInTheDocument();
  });

  it('clicking play all calls playSong with first song', async () => {
    renderPage();
    const btn = await screen.findByTestId('play-all-button');
    fireEvent.click(btn);
    expect(mockPlaySong).toHaveBeenCalledWith(expect.objectContaining({
      songId: MOCK_SONGS[0].id,
    }));
  });

  it('shows follow button initially as "Theo dõi"', async () => {
    renderPage();
    expect(await screen.findByTestId('follow-button')).toHaveTextContent('Theo dõi');
  });

  it('toggling follow changes button text to "Đang theo dõi"', async () => {
    renderPage();
    const btn = await screen.findByTestId('follow-button');
    fireEvent.click(btn);
    expect(screen.getByTestId('follow-button')).toHaveTextContent('Đang theo dõi');
  });

  it('toggling follow twice reverts to "Theo dõi"', async () => {
    renderPage();
    const btn = await screen.findByTestId('follow-button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.getByTestId('follow-button')).toHaveTextContent('Theo dõi');
  });

  it('renders popular tracks section heading after load', async () => {
    renderPage();
    expect(await screen.findByText('Bài hát phổ biến')).toBeInTheDocument();
  });

  it('renders track rows for all songs after load', async () => {
    renderPage();
    for (const s of MOCK_SONGS) {
      expect(await screen.findByTestId(`track-row-${s.id}`)).toBeInTheDocument();
    }
  });

  it('clicking a track row calls playSong', async () => {
    renderPage();
    const row = await screen.findByTestId(`track-row-${MOCK_SONGS[0].id}`);
    fireEvent.click(row);
    expect(mockPlaySong).toHaveBeenCalledWith(expect.objectContaining({ songId: MOCK_SONGS[0].id }));
  });

  it('renders bio section when available', async () => {
    renderPage();
    expect(await screen.findByText('Giới thiệu')).toBeInTheDocument();
    expect(await screen.findByText(MOCK_ARTIST_DETAIL.bio)).toBeInTheDocument();
  });
});
