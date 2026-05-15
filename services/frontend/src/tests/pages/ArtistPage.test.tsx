import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArtistPage from '../../pages/ArtistPage';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';
import { MOCK_ARTIST, MOCK_RELATED_SONGS } from '../../mocks/data';

// ── Mocks ──────────────────────────────────────────────────────────────────────

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
      <ArtistPage />
    </MemoryRouter>
  );
}

describe('ArtistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('renders inside AppShell', () => {
    renderPage();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('renders artist hero section', () => {
    renderPage();
    expect(screen.getByTestId('artist-hero')).toBeInTheDocument();
  });

  it('shows artist name', () => {
    renderPage();
    expect(screen.getByTestId('artist-name')).toHaveTextContent(MOCK_ARTIST.name);
  });

  it('renders artist avatar', () => {
    renderPage();
    expect(screen.getByTestId('artist-avatar')).toHaveAttribute('src', MOCK_ARTIST.avatarUrl);
  });

  it('shows stats bar', () => {
    renderPage();
    const statsBar = screen.getByTestId('stats-bar');
    expect(statsBar).toBeInTheDocument();
    expect(statsBar).toHaveTextContent('bài hát');
    expect(statsBar).toHaveTextContent('lượt nghe');
    expect(statsBar).toHaveTextContent('người theo dõi');
  });

  it('shows play all button', () => {
    renderPage();
    expect(screen.getByTestId('play-all-button')).toBeInTheDocument();
  });

  it('clicking play all calls playSong with first song', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('play-all-button'));
    expect(mockPlaySong).toHaveBeenCalledWith(expect.objectContaining({
      songId: MOCK_RELATED_SONGS[0].id,
    }));
  });

  it('shows follow button initially as "Theo dõi"', () => {
    renderPage();
    expect(screen.getByTestId('follow-button')).toHaveTextContent('Theo dõi');
  });

  it('toggling follow changes button text to "Đang theo dõi"', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('follow-button'));
    expect(screen.getByTestId('follow-button')).toHaveTextContent('Đang theo dõi');
  });

  it('toggling follow twice reverts to "Theo dõi"', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('follow-button'));
    fireEvent.click(screen.getByTestId('follow-button'));
    expect(screen.getByTestId('follow-button')).toHaveTextContent('Theo dõi');
  });

  it('renders popular tracks section', () => {
    renderPage();
    expect(screen.getByText('Bài hát phổ biến')).toBeInTheDocument();
  });

  it('renders all track rows', () => {
    renderPage();
    MOCK_RELATED_SONGS.forEach((s) => {
      expect(screen.getByTestId(`track-row-${s.id}`)).toBeInTheDocument();
    });
  });

  it('clicking a track row calls playSong', () => {
    renderPage();
    const firstSong = MOCK_RELATED_SONGS[0];
    fireEvent.click(screen.getByTestId(`track-row-${firstSong.id}`));
    expect(mockPlaySong).toHaveBeenCalledWith(expect.objectContaining({ songId: firstSong.id }));
  });

  it('renders fans also like section', () => {
    renderPage();
    expect(screen.getByText('Người hâm mộ cũng thích')).toBeInTheDocument();
  });

  it('renders similar artist cards', () => {
    renderPage();
    expect(screen.getByTestId(`similar-artist-${MOCK_ARTIST.id}`)).toBeInTheDocument();
  });

  it('shows follower count formatted (5.2M)', () => {
    renderPage();
    expect(screen.getByTestId('stats-bar')).toHaveTextContent('5.2M');
  });
});
