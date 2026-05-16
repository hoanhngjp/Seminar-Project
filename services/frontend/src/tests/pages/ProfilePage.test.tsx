import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '../../pages/ProfilePage';
import { useAuthStore } from '../../store/authStore';

// ── Service mock ──────────────────────────────────────────────────────────────

const { MOCK_PROFILE_DATA } = vi.hoisted(() => ({
  MOCK_PROFILE_DATA: {
    userId: 'user-001',
    email: 'listener@soundwave.vn',
    displayName: 'Nguyễn Thành Nghiệp',
    role: 'Listener',
    hasCompletedOnboarding: true,
    avatarUrl: 'https://picsum.photos/seed/avatar/120/120',
    preferredGenres: ['V-Pop', 'Indie', 'Ballad'],
    preferredArtists: ['Sơn Tùng M-TP', 'Vũ.'],
  },
}));

vi.mock('../../services/userService', () => ({
  userService: {
    getProfile: vi.fn().mockResolvedValue(MOCK_PROFILE_DATA),
  },
}));

// ── Component mocks ───────────────────────────────────────────────────────────

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

// ── Setup ─────────────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('renders inside AppShell', () => {
    renderPage();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('shows page title', async () => {
    renderPage();
    expect(await screen.findByText('Hồ sơ của tôi')).toBeInTheDocument();
  });

  it('renders avatar after load', async () => {
    renderPage();
    const avatar = await screen.findByTestId('profile-avatar');
    expect(avatar).toHaveAttribute('src', MOCK_PROFILE_DATA.avatarUrl);
  });

  it('renders change avatar button', async () => {
    renderPage();
    expect(await screen.findByTestId('change-avatar-button')).toBeInTheDocument();
  });

  it('renders file input hidden', async () => {
    renderPage();
    const input = await screen.findByTestId('avatar-file-input');
    expect(input).toHaveClass('hidden');
  });

  it('shows display name after load', async () => {
    renderPage();
    expect(await screen.findByTestId('name-display')).toHaveTextContent(MOCK_PROFILE_DATA.displayName);
  });

  it('clicking name display enters edit mode', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('name-display'));
    expect(screen.getByTestId('name-input')).toBeInTheDocument();
  });

  it('typing in name input updates value', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('name-display'));
    const input = screen.getByTestId('name-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    expect(input.value).toBe('New Name');
  });

  it('pressing Enter exits edit mode', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('name-display'));
    const input = screen.getByTestId('name-input');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.queryByTestId('name-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('name-display')).toBeInTheDocument();
  });

  it('blurring name input exits edit mode', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('name-display'));
    fireEvent.blur(screen.getByTestId('name-input'));
    expect(screen.queryByTestId('name-input')).not.toBeInTheDocument();
  });

  it('shows email section after load', async () => {
    renderPage();
    const emailSection = await screen.findByTestId('email-section');
    expect(emailSection).toHaveTextContent(MOCK_PROFILE_DATA.email);
  });

  it('shows role badge after load', async () => {
    renderPage();
    expect(await screen.findByTestId('role-section')).toHaveTextContent(MOCK_PROFILE_DATA.role);
  });

  it('shows preferred genres after load', async () => {
    renderPage();
    const prefs = await screen.findByTestId('preferences-section');
    for (const g of MOCK_PROFILE_DATA.preferredGenres) {
      expect(prefs).toHaveTextContent(g);
    }
  });

  it('shows preferred artists after load', async () => {
    renderPage();
    const prefs = await screen.findByTestId('preferences-section');
    for (const a of MOCK_PROFILE_DATA.preferredArtists) {
      expect(prefs).toHaveTextContent(a);
    }
  });

  it('shows link to preferences page', async () => {
    renderPage();
    const link = await screen.findByTestId('edit-preferences-link');
    expect(link).toHaveAttribute('href', '/settings/preferences');
  });

  it('renders logout button after load', async () => {
    renderPage();
    expect(await screen.findByTestId('logout-button')).toBeInTheDocument();
  });

  it('clicking logout calls clearAuth', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('logout-button'));
    expect(mockClearAuth).toHaveBeenCalledOnce();
  });

  it('clicking logout navigates to /login', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('logout-button'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
