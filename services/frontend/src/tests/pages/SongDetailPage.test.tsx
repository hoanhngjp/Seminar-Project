import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SongDetailPage from '../../pages/SongDetailPage';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';
import { MOCK_RELATED_SONGS } from '../../mocks/data';
import { fetchRecommendations } from '../../services/recommendationService';

// ── Service mocks ─────────────────────────────────────────────────────────────

const { MOCK_SONG_DATA } = vi.hoisted(() => ({
  MOCK_SONG_DATA: {
    id: 'song-001',
    title: 'Lạc Trôi',
    artist: 'Sơn Tùng M-TP',
    duration: 245,
    coverUrl: 'https://picsum.photos/seed/lactroi/300/300',
    isExplicit: false,
    genreName: 'V-Pop',
    moodName: 'Lãng mạn',
    language: 'Tiếng Việt',
    releaseDate: '2017-01-01',
    playCount: 150000000,
  },
}));

vi.mock('../../services/musicService', () => ({
  getSong: vi.fn().mockResolvedValue(MOCK_SONG_DATA),
  getArtist: vi.fn(),
  getMySongs: vi.fn(),
}));

vi.mock('../../services/recommendationService', () => ({
  fetchRecommendations: vi.fn(),
}));

// ── Component mocks ───────────────────────────────────────────────────────────

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

// ── Setup ─────────────────────────────────────────────────────────────────────

function setup() {
  (usePlayerStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ playSong: mockPlaySong, addToQueue: mockAddToQueue, currentSong: null, queue: [] })
  );
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ userId: 'user-001', role: 'Listener', accessToken: 'tok', hasCompletedOnboarding: true })
  );
  (fetchRecommendations as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_RELATED_SONGS);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/songs/song-001']}>
      <Routes>
        <Route path="/songs/:songId" element={<SongDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SongDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('renders inside AppShell', () => {
    renderPage();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('renders hero section after load', async () => {
    renderPage();
    expect(await screen.findByTestId('hero-section')).toBeInTheDocument();
  });

  it('shows song title in hero after load', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(MOCK_SONG_DATA.title);
  });

  it('renders song cover image after load', async () => {
    renderPage();
    const img = await screen.findByRole('img', { name: MOCK_SONG_DATA.title });
    expect(img).toHaveAttribute('src', MOCK_SONG_DATA.coverUrl);
  });

  it('renders play button after load', async () => {
    renderPage();
    expect(await screen.findByTestId('play-button')).toBeInTheDocument();
  });

  it('clicking play calls playSong with correct data', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('play-button'));
    expect(mockPlaySong).toHaveBeenCalledWith({
      songId: MOCK_SONG_DATA.id,
      title: MOCK_SONG_DATA.title,
      artist: MOCK_SONG_DATA.artist,
      coverUrl: MOCK_SONG_DATA.coverUrl,
    });
  });

  it('renders add to queue button after load', async () => {
    renderPage();
    expect(await screen.findByTestId('add-to-queue-button')).toBeInTheDocument();
  });

  it('clicking add to queue calls addToQueue', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('add-to-queue-button'));
    expect(mockAddToQueue).toHaveBeenCalledWith({
      songId: MOCK_SONG_DATA.id,
      title: MOCK_SONG_DATA.title,
      artist: MOCK_SONG_DATA.artist,
      coverUrl: MOCK_SONG_DATA.coverUrl,
    });
  });

  it('renders more options button after load', async () => {
    renderPage();
    expect(await screen.findByTestId('more-options-button')).toBeInTheDocument();
  });

  it('clicking more options shows context menu with Chia sẻ', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('more-options-button'));
    expect(screen.getByText('Chia sẻ')).toBeInTheDocument();
  });

  it('renders metadata grid after load', async () => {
    renderPage();
    expect(await screen.findByTestId('metadata-grid')).toBeInTheDocument();
  });

  it('shows genre in metadata after load', async () => {
    renderPage();
    expect(await screen.findByText(MOCK_SONG_DATA.genreName)).toBeInTheDocument();
  });

  it('shows mood in metadata after load', async () => {
    renderPage();
    expect(await screen.findByText(MOCK_SONG_DATA.moodName)).toBeInTheDocument();
  });

  it('shows language in metadata after load', async () => {
    renderPage();
    expect(await screen.findByText(MOCK_SONG_DATA.language)).toBeInTheDocument();
  });

  it('shows release year in metadata after load', async () => {
    renderPage();
    expect(await screen.findByText('2017')).toBeInTheDocument();
  });

  it('renders related songs section after load', async () => {
    renderPage();
    expect(await screen.findByText('Bài hát liên quan')).toBeInTheDocument();
  });

  it('renders all related song cards after load', async () => {
    renderPage();
    for (const s of MOCK_RELATED_SONGS) {
      expect(await screen.findByTestId(`song-card-${s.id}`)).toBeInTheDocument();
    }
  });

  it('clicking play on related song calls playSong', async () => {
    renderPage();
    const firstRelated = MOCK_RELATED_SONGS[0];
    fireEvent.click(await screen.findByTestId(`play-${firstRelated.id}`));
    expect(mockPlaySong).toHaveBeenCalled();
  });

  it('hides context menu after clicking Chia sẻ', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('more-options-button'));
    fireEvent.click(screen.getByText('Chia sẻ'));
    expect(screen.queryByText('Chia sẻ')).not.toBeInTheDocument();
  });

  it('shows play count formatted after load', async () => {
    renderPage();
    expect(await screen.findByText(/150\.0M/)).toBeInTheDocument();
  });
});
