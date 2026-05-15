import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../../pages/ProfilePage';
import { useAuthStore } from '../../store/authStore';
import { MOCK_PROFILE } from '../../mocks/data';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../components/layout/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

const mockClearAuth = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../../store/playerStore', () => ({
  usePlayerStore: vi.fn(() => null),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function setup() {
  (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ clearAuth: mockClearAuth, userId: 'user-001', role: 'Listener', accessToken: 'tok', hasCompletedOnboarding: true })
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <ProfilePage />
    </MemoryRouter>
  );
}

describe('ProfilePage', () => {
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
    expect(screen.getByText('Hồ sơ của tôi')).toBeInTheDocument();
  });

  it('renders avatar', () => {
    renderPage();
    expect(screen.getByTestId('profile-avatar')).toHaveAttribute('src', MOCK_PROFILE.avatarUrl);
  });

  it('renders change avatar button', () => {
    renderPage();
    expect(screen.getByTestId('change-avatar-button')).toBeInTheDocument();
  });

  it('renders file input hidden', () => {
    renderPage();
    const input = screen.getByTestId('avatar-file-input');
    expect(input).toHaveClass('hidden');
  });

  it('shows display name', () => {
    renderPage();
    expect(screen.getByTestId('name-display')).toHaveTextContent(MOCK_PROFILE.displayName);
  });

  it('clicking name display enters edit mode', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('name-display'));
    expect(screen.getByTestId('name-input')).toBeInTheDocument();
  });

  it('typing in name input updates value', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('name-display'));
    const input = screen.getByTestId('name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    expect(input.value).toBe('New Name');
  });

  it('pressing Enter exits edit mode', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('name-display'));
    const input = screen.getByTestId('name-input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByTestId('name-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('name-display')).toBeInTheDocument();
  });

  it('blurring name input exits edit mode', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('name-display'));
    fireEvent.blur(screen.getByTestId('name-input'));
    expect(screen.queryByTestId('name-input')).not.toBeInTheDocument();
  });

  it('shows email with lock icon section', () => {
    renderPage();
    const emailSection = screen.getByTestId('email-section');
    expect(emailSection).toHaveTextContent(MOCK_PROFILE.email);
  });

  it('shows role badge', () => {
    renderPage();
    expect(screen.getByTestId('role-section')).toHaveTextContent(MOCK_PROFILE.role);
  });

  it('shows preferred genres', () => {
    renderPage();
    const prefs = screen.getByTestId('preferences-section');
    MOCK_PROFILE.preferredGenres!.forEach((g) => {
      expect(prefs).toHaveTextContent(g);
    });
  });

  it('shows preferred artists', () => {
    renderPage();
    const prefs = screen.getByTestId('preferences-section');
    MOCK_PROFILE.preferredArtists!.forEach((a) => {
      expect(prefs).toHaveTextContent(a);
    });
  });

  it('shows link to preferences page', () => {
    renderPage();
    const link = screen.getByTestId('edit-preferences-link');
    expect(link).toHaveAttribute('href', '/settings/preferences');
  });

  it('renders logout button', () => {
    renderPage();
    expect(screen.getByTestId('logout-button')).toBeInTheDocument();
  });

  it('clicking logout calls clearAuth', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('logout-button'));
    expect(mockClearAuth).toHaveBeenCalledOnce();
  });

  it('clicking logout navigates to /login', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('logout-button'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
