import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PreferencesPage from '../../pages/PreferencesPage';
import { useAuthStore } from '../../store/authStore';

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

// Render GenreGrid with minimal mock so we can test genre selection
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

function setup() {
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
    setup();
  });

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

  it('save button is enabled when 3 genres pre-selected from profile', () => {
    // MOCK_PROFILE.preferredGenres = ['V-Pop', 'Acoustic', 'Indie'] (3 items)
    // selectedGenres.length >= 3 → canSave = true → button enabled
    renderPage();
    expect(screen.getByTestId('save-button')).not.toBeDisabled();
  });

  it('does NOT show genre warning when 3 genres pre-selected from profile', () => {
    renderPage();
    expect(screen.queryByTestId('genre-warning')).not.toBeInTheDocument();
  });

  it('selecting 3 genres enables save button', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('genre-pop'));
    fireEvent.click(screen.getByTestId('genre-rock'));
    fireEvent.click(screen.getByTestId('genre-rb'));
    expect(screen.getByTestId('save-button')).not.toBeDisabled();
  });

  it('selecting 3 genres hides genre warning', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('genre-pop'));
    fireEvent.click(screen.getByTestId('genre-rock'));
    fireEvent.click(screen.getByTestId('genre-rb'));
    expect(screen.queryByTestId('genre-warning')).not.toBeInTheDocument();
  });

  it('clicking save with 3+ genres shows success toast', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('genre-pop'));
    fireEvent.click(screen.getByTestId('genre-rock'));
    fireEvent.click(screen.getByTestId('genre-rb'));
    fireEvent.click(screen.getByTestId('save-button'));
    expect(mockToastShow).toHaveBeenCalledWith('Đã lưu sở thích thành công', 'success');
  });

  it('clicking save immediately shows toast (3 genres pre-selected)', () => {
    // MOCK_PROFILE starts with 3 genres → button is enabled → toast fires on first click
    renderPage();
    fireEvent.click(screen.getByTestId('save-button'));
    expect(mockToastShow).toHaveBeenCalledWith('Đã lưu sở thích thành công', 'success');
  });

  it('typing in artist search shows results for unselected artist', () => {
    // MOCK_PROFILE.preferredArtists = ['Sơn Tùng M-TP', 'Hòa Minzy'] → already selected
    // Search 'Vũ' → 'Vũ.' is NOT yet selected → appears in results
    renderPage();
    fireEvent.change(screen.getByTestId('artist-search-input'), { target: { value: 'Vũ' } });
    expect(screen.getByTestId('artist-results')).toBeInTheDocument();
  });

  it('clicking artist result adds to selected artists', () => {
    renderPage();
    // First clear existing — MOCK_PROFILE.preferredArtists includes 'Sơn Tùng M-TP'
    fireEvent.change(screen.getByTestId('artist-search-input'), { target: { value: 'Chillies' } });
    fireEvent.click(screen.getByTestId('artist-result-Chillies'));
    expect(screen.getByTestId('selected-artist-Chillies')).toBeInTheDocument();
  });

  it('shows selected artists as chips', () => {
    renderPage();
    // MOCK_PROFILE.preferredArtists = ['Sơn Tùng M-TP', 'Hòa Minzy']
    expect(screen.getByTestId('selected-artist-Sơn Tùng M-TP')).toBeInTheDocument();
    expect(screen.getByTestId('selected-artist-Hòa Minzy')).toBeInTheDocument();
  });

  it('removing an artist chip removes it from selected', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('remove-artist-Sơn Tùng M-TP'));
    expect(screen.queryByTestId('selected-artist-Sơn Tùng M-TP')).not.toBeInTheDocument();
  });

  it('removed artist reappears in search results', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('remove-artist-Sơn Tùng M-TP'));
    fireEvent.change(screen.getByTestId('artist-search-input'), { target: { value: 'Sơn' } });
    expect(screen.getByTestId('artist-result-Sơn Tùng M-TP')).toBeInTheDocument();
  });
});
