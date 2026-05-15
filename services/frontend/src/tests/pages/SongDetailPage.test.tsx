import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SongDetailPage from '../../pages/SongDetailPage';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';
import { MOCK_SONG_DETAIL, MOCK_RELATED_SONGS } from '../../mocks/data';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock('../../features/recommendation/components/SongCard', () => ({
  default: ({ song, onPlay }: { song: { id: string; title: string }; onPlay: (s: unknown) => void }) => (
    <div data-testid={`song-card-${song.id}`}>
      <span>{song.title}</span>
      <button onClick={() => onPlay(song)} data-testid={`play-${song.id}`}>Play</button>
    </div>
  ),
}));

const mockPlaySong = vi.fn();
const mockAddToQueue = vi.fn();

vi.mock('../../store/playerStore', () => ({
  usePlayerStore: vi.fn(),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Setup ──────────────────────────────────────────────────────────────────────

function setup() {
  (usePlayerStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ playSong: mockPlaySong, addToQueue: mockAddToQueue, currentSong: null, queue: [] })
  );
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ userId: 'user-001', role: 'Listener', accessToken: 'tok', hasCompletedOnboarding: true })
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/songs/song-001']}>
      <SongDetailPage />
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SongDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('renders inside AppShell', () => {
    renderPage();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('renders hero section with song title', () => {
    renderPage();
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    // title appears in hero h1 AND in related SongCard song-001 — use heading role
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(MOCK_SONG_DETAIL.title);
  });

  it('renders artist name as link', () => {
    renderPage();
    const artistLink = screen.getByTestId('artist-link');
    expect(artistLink).toBeInTheDocument();
    expect(artistLink.textContent).toBe(MOCK_SONG_DETAIL.artist);
  });

  it('renders song cover image', () => {
    renderPage();
    const img = screen.getByRole('img', { name: MOCK_SONG_DETAIL.title });
    expect(img).toHaveAttribute('src', MOCK_SONG_DETAIL.coverUrl);
  });

  it('renders play button', () => {
    renderPage();
    expect(screen.getByTestId('play-button')).toBeInTheDocument();
  });

  it('clicking play calls playSong with correct data', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('play-button'));
    expect(mockPlaySong).toHaveBeenCalledWith({
      songId: MOCK_SONG_DETAIL.id,
      title: MOCK_SONG_DETAIL.title,
      artist: MOCK_SONG_DETAIL.artist,
      coverUrl: MOCK_SONG_DETAIL.coverUrl,
    });
  });

  it('renders add to queue button', () => {
    renderPage();
    expect(screen.getByTestId('add-to-queue-button')).toBeInTheDocument();
  });

  it('clicking add to queue calls addToQueue', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('add-to-queue-button'));
    expect(mockAddToQueue).toHaveBeenCalledWith({
      songId: MOCK_SONG_DETAIL.id,
      title: MOCK_SONG_DETAIL.title,
      artist: MOCK_SONG_DETAIL.artist,
      coverUrl: MOCK_SONG_DETAIL.coverUrl,
    });
  });

  it('renders more options button', () => {
    renderPage();
    expect(screen.getByTestId('more-options-button')).toBeInTheDocument();
  });

  it('clicking more options shows context menu', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('more-options-button'));
    expect(screen.getByText('Đến trang nghệ sĩ')).toBeInTheDocument();
    expect(screen.getByText('Chia sẻ')).toBeInTheDocument();
  });

  it('renders metadata grid', () => {
    renderPage();
    expect(screen.getByTestId('metadata-grid')).toBeInTheDocument();
  });

  it('shows genre in metadata', () => {
    renderPage();
    expect(screen.getByText(MOCK_SONG_DETAIL.genreName!)).toBeInTheDocument();
  });

  it('shows mood in metadata', () => {
    renderPage();
    expect(screen.getByText(MOCK_SONG_DETAIL.moodName!)).toBeInTheDocument();
  });

  it('shows language in metadata', () => {
    renderPage();
    expect(screen.getByText(MOCK_SONG_DETAIL.language!)).toBeInTheDocument();
  });

  it('shows release year in metadata', () => {
    renderPage();
    expect(screen.getByText('2017')).toBeInTheDocument();
  });

  it('renders explain card when explainText exists', () => {
    renderPage();
    expect(screen.getByTestId('explain-card')).toBeInTheDocument();
    expect(screen.getByText(MOCK_SONG_DETAIL.explainText!)).toBeInTheDocument();
  });

  it('renders related songs section', () => {
    renderPage();
    expect(screen.getByText('Bài hát liên quan')).toBeInTheDocument();
  });

  it('renders all related song cards', () => {
    renderPage();
    MOCK_RELATED_SONGS.forEach((s) => {
      expect(screen.getByTestId(`song-card-${s.id}`)).toBeInTheDocument();
    });
  });

  it('clicking play on related song calls playSong', () => {
    renderPage();
    const firstRelated = MOCK_RELATED_SONGS[0];
    fireEvent.click(screen.getByTestId(`play-${firstRelated.id}`));
    expect(mockPlaySong).toHaveBeenCalled();
  });

  it('navigates to artist page when clicking artist name in context menu', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('more-options-button'));
    fireEvent.click(screen.getByText('Đến trang nghệ sĩ'));
    expect(mockNavigate).toHaveBeenCalledWith('/artists/artist-001');
  });

  it('hides context menu after clicking Chia sẻ', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('more-options-button'));
    fireEvent.click(screen.getByText('Chia sẻ'));
    expect(screen.queryByText('Đến trang nghệ sĩ')).not.toBeInTheDocument();
  });

  it('shows play count formatted', () => {
    renderPage();
    // 150000000 → "150.0M"
    expect(screen.getByText(/150\.0M/)).toBeInTheDocument();
  });
});
