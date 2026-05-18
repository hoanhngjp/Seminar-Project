import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PreferencesPage from '../../pages/PreferencesPage';
import { useAuthStore } from '../../store/authStore';
import { userService } from '../../services/userService';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

const mockToastShow = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ show: mockToastShow }),
}));

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../../store/playerStore', () => ({
  usePlayerStore: vi.fn(() => null),
}));

vi.mock('../../services/userService', () => ({
  userService: {
    getProfile: vi.fn(),
    updatePreferences: vi.fn(),
  },
}));

// Small controlled dataset so tests are self-contained
vi.mock('../../features/onboarding/data/artistAvatars', () => ({
  ALL_ARTISTS: [
    { id: 'artist-001', name: 'Sơn Tùng M-TP', imageUrl: '' },
    { id: 'artist-002', name: 'Hòa Minzy', imageUrl: '' },
    { id: 'artist-003', name: 'Vũ.', imageUrl: '' },
    { id: 'artist-004', name: 'Chillies', imageUrl: '' },
  ],
}));

// GenreGrid mock — IDs match slug style so toggle tests are easy to write
vi.mock('../../features/onboarding/components/GenreGrid', () => ({
  GenreGrid: ({ selectedGenres, toggleGenre }: { selectedGenres: string[]; toggleGenre: (id: string) => void }) => (
    <div data-testid="genre-grid">
      {['pop', 'rock', 'rb', 'jazz', 'classical', 'electronic', 'hiphop', 'acoustic', 'indie'].map((id) => (
        <button
          key={id}
          onClick={() => toggleGenre(id)}
          data-testid={`genre-${id}`}
          aria-pressed={selectedGenres.includes(id)}
        >
          {id}
        </button>
      ))}
    </div>
  ),
}));

// Profile that pre-selects 3 genres (slug IDs matching mock GenreGrid) and 2 artists
const PROFILE_3_GENRES_2_ARTISTS = {
  userId: 'user-001',
  email: 'test@test.com',
  displayName: 'Test User',
  role: 'Listener',
  hasCompletedOnboarding: true,
  preferredGenres: ['pop', 'rock', 'rb'],
  preferredArtists: ['artist-001', 'artist-002'],
};

const EMPTY_PROFILE = {
  userId: 'user-001',
  email: 'test@test.com',
  displayName: 'Test User',
  role: 'Listener',
  hasCompletedOnboarding: true,
  preferredGenres: [],
  preferredArtists: [],
};

function setupAuth() {
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ userId: 'user-001', role: 'Listener', accessToken: 'tok', hasCompletedOnboarding: true })
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PreferencesPage />
    </MemoryRouter>
  );
}

describe('PreferencesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
    vi.mocked(userService.getProfile).mockResolvedValue(EMPTY_PROFILE);
    vi.mocked(userService.updatePreferences).mockResolvedValue({ success: true });
  });

  // ── Static structure ──────────────────────────────────────────────────────

  it('renders inside AppShell', () => {
    renderPage();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('shows page title', () => {
    renderPage();
    expect(screen.getByText('Cập nhật sở thích')).toBeInTheDocument();
  });

  it('renders genre section', () => {
    renderPage();
    expect(screen.getByTestId('genre-section')).toBeInTheDocument();
  });

  it('renders GenreGrid', () => {
    renderPage();
    expect(screen.getByTestId('genre-grid')).toBeInTheDocument();
  });

  it('renders artist search input', () => {
    renderPage();
    expect(screen.getByTestId('artist-search-input')).toBeInTheDocument();
  });

  it('renders save bar', () => {
    renderPage();
    expect(screen.getByTestId('save-bar')).toBeInTheDocument();
  });

  // ── Profile load (async) ──────────────────────────────────────────────────

  it('loads profile on mount and pre-fills genres and artists', async () => {
    vi.mocked(userService.getProfile).mockResolvedValue(PROFILE_3_GENRES_2_ARTISTS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('genre-pop')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByTestId('genre-rock')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('genre-rb')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('selected-artist-Sơn Tùng M-TP')).toBeInTheDocument();
    expect(screen.getByTestId('selected-artist-Hòa Minzy')).toBeInTheDocument();
  });

  it('save button is enabled when 3 genres pre-selected from profile', async () => {
    vi.mocked(userService.getProfile).mockResolvedValue(PROFILE_3_GENRES_2_ARTISTS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('save-button')).not.toBeDisabled();
    });
  });

  it('does NOT show genre warning when 3 genres pre-selected from profile', async () => {
    vi.mocked(userService.getProfile).mockResolvedValue(PROFILE_3_GENRES_2_ARTISTS);
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('genre-warning')).not.toBeInTheDocument();
    });
  });

  it('shows genre warning on initial render before profile loads', () => {
    // profile is not yet resolved — genres empty → warning visible
    vi.mocked(userService.getProfile).mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByTestId('genre-warning')).toBeInTheDocument();
  });

  // ── Genre toggle (interaction, no profile needed) ─────────────────────────

  it('selecting 3 genres enables save button', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('genre-pop'));
    fireEvent.click(screen.getByTestId('genre-rock'));
    fireEvent.click(screen.getByTestId('genre-rb'));
    expect(screen.getByTestId('save-button')).not.toBeDisabled();
  });

  it('selecting 3 genres hides genre warning', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('genre-pop'));
    fireEvent.click(screen.getByTestId('genre-rock'));
    fireEvent.click(screen.getByTestId('genre-rb'));
    expect(screen.queryByTestId('genre-warning')).not.toBeInTheDocument();
  });

  // ── Save ─────────────────────────────────────────────────────────────────

  it('clicking save calls updatePreferences with correct payload and shows toast', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('genre-pop'));
    fireEvent.click(screen.getByTestId('genre-rock'));
    fireEvent.click(screen.getByTestId('genre-rb'));
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => {
      expect(userService.updatePreferences).toHaveBeenCalledWith({
        preferredGenres: ['pop', 'rock', 'rb'],
        preferredArtists: [],
        audioQuality: 'standard',
      });
      expect(mockToastShow).toHaveBeenCalledWith('Đã lưu sở thích thành công', 'success');
    });
  });

  it('clicking save with profile-loaded genres calls updatePreferences', async () => {
    vi.mocked(userService.getProfile).mockResolvedValue(PROFILE_3_GENRES_2_ARTISTS);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('save-button')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => {
      expect(userService.updatePreferences).toHaveBeenCalledWith({
        preferredGenres: ['pop', 'rock', 'rb'],
        preferredArtists: ['artist-001', 'artist-002'],
        audioQuality: 'standard',
      });
      expect(mockToastShow).toHaveBeenCalledWith('Đã lưu sở thích thành công', 'success');
    });
  });

  it('shows error toast when updatePreferences fails', async () => {
    vi.mocked(userService.updatePreferences).mockRejectedValue(new Error('Network error'));
    renderPage();
    fireEvent.click(screen.getByTestId('genre-pop'));
    fireEvent.click(screen.getByTestId('genre-rock'));
    fireEvent.click(screen.getByTestId('genre-rb'));
    fireEvent.click(screen.getByTestId('save-button'));
    await waitFor(() => {
      expect(mockToastShow).toHaveBeenCalledWith('Không thể lưu sở thích. Vui lòng thử lại.', 'error');
    });
  });

  // ── Artist search (uses mocked ALL_ARTISTS) ───────────────────────────────

  it('typing in artist search shows matching unselected artists', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('artist-search-input'), { target: { value: 'Vũ' } });
    expect(screen.getByTestId('artist-results')).toBeInTheDocument();
    expect(screen.getByTestId('artist-result-Vũ.')).toBeInTheDocument();
  });

  it('clicking artist result adds chip with artist name', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('artist-search-input'), { target: { value: 'Chillies' } });
    fireEvent.click(screen.getByTestId('artist-result-Chillies'));
    expect(screen.getByTestId('selected-artist-Chillies')).toBeInTheDocument();
  });

  it('selected artist does not appear in search results', () => {
    renderPage();
    fireEvent.change(screen.getByTestId('artist-search-input'), { target: { value: 'Chillies' } });
    fireEvent.click(screen.getByTestId('artist-result-Chillies'));
    // still typing same query — Chillies now selected → not in results
    expect(screen.queryByTestId('artist-result-Chillies')).not.toBeInTheDocument();
  });

  it('shows selected artists as chips after profile load', async () => {
    vi.mocked(userService.getProfile).mockResolvedValue(PROFILE_3_GENRES_2_ARTISTS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('selected-artist-Sơn Tùng M-TP')).toBeInTheDocument();
      expect(screen.getByTestId('selected-artist-Hòa Minzy')).toBeInTheDocument();
    });
  });

  it('removing an artist chip removes it from selected', async () => {
    vi.mocked(userService.getProfile).mockResolvedValue(PROFILE_3_GENRES_2_ARTISTS);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('remove-artist-Sơn Tùng M-TP')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('remove-artist-Sơn Tùng M-TP'));
    expect(screen.queryByTestId('selected-artist-Sơn Tùng M-TP')).not.toBeInTheDocument();
  });

  it('removed artist reappears in search results', async () => {
    vi.mocked(userService.getProfile).mockResolvedValue(PROFILE_3_GENRES_2_ARTISTS);
    renderPage();
    await waitFor(() => expect(screen.getByTestId('remove-artist-Sơn Tùng M-TP')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('remove-artist-Sơn Tùng M-TP'));
    fireEvent.change(screen.getByTestId('artist-search-input'), { target: { value: 'Sơn' } });
    expect(screen.getByTestId('artist-result-Sơn Tùng M-TP')).toBeInTheDocument();
  });
});
