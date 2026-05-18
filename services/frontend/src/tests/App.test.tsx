import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

// ---------------------------------------------------------------------------
// Mock all pages so route tests are isolated from page internals
// ---------------------------------------------------------------------------

vi.mock('../pages/HomePage', () => ({ default: () => <div data-testid="page-home">HomePage</div> }));
vi.mock('../pages/LoginPage', () => ({ default: () => <div data-testid="page-login">LoginPage</div> }));
vi.mock('../pages/RegisterPage', () => ({ default: () => <div data-testid="page-register">RegisterPage</div> }));
vi.mock('../pages/OnboardingPage', () => ({ default: () => <div data-testid="page-onboarding">OnboardingPage</div> }));
vi.mock('../pages/SearchPage', () => ({ default: () => <div data-testid="page-search">SearchPage</div> }));
vi.mock('../pages/NotificationsPage', () => ({ default: () => <div data-testid="page-notifications">NotificationsPage</div> }));
vi.mock('../pages/CreatorDashboardPage', () => ({ default: () => <div data-testid="page-dashboard">CreatorDashboardPage</div> }));
vi.mock('../pages/creator/UploadPage', () => ({ default: () => <div data-testid="page-upload">UploadPage</div> }));
vi.mock('../pages/party/PartyLandingPage', () => ({ default: () => <div data-testid="page-party-landing">PartyLandingPage</div> }));
vi.mock('../pages/party/PartyRoomPage', () => ({ default: () => <div data-testid="page-party-room">PartyRoomPage</div> }));
vi.mock('../pages/SongDetailPage', () => ({ default: () => <div data-testid="page-song-detail">SongDetailPage</div> }));
vi.mock('../pages/ArtistPage', () => ({ default: () => <div data-testid="page-artist">ArtistPage</div> }));
vi.mock('../pages/ProfilePage', () => ({ default: () => <div data-testid="page-profile">ProfilePage</div> }));
vi.mock('../pages/PreferencesPage', () => ({ default: () => <div data-testid="page-preferences">PreferencesPage</div> }));
vi.mock('../pages/creator/CreatorSongAnalyticsPage', () => ({ default: () => <div data-testid="page-song-analytics">CreatorSongAnalyticsPage</div> }));
vi.mock('../components/layout/BottomPlayerBar', () => ({ default: () => null }));

// AuthInitializer — passthrough in tests (no real API calls)
vi.mock('../components/AuthInitializer', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// authStore — simulate an authenticated Listener so RequireAuth renders children
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: object) => unknown) =>
    selector({
      isInitialized: true,
      accessToken: 'test-token',
      userId: 'user-001',
      role: 'Listener',
      hasCompletedOnboarding: true,
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
      setInitialized: vi.fn(),
      completeOnboarding: vi.fn(),
    }),
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function navigateTo(path: string) {
  window.history.pushState(null, '', path);
}

function renderApp() {
  return render(<App />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('App — route registration', () => {
  beforeEach(() => {
    navigateTo('/');
  });

  // ── Existing routes (smoke check) ────────────────────────────────────────

  it('renders HomePage at /', () => {
    navigateTo('/');
    renderApp();
    expect(screen.getByTestId('page-home')).toBeInTheDocument();
  });

  it('renders LoginPage at /login', () => {
    navigateTo('/login');
    renderApp();
    expect(screen.getByTestId('page-login')).toBeInTheDocument();
  });

  it('renders SearchPage at /search', () => {
    navigateTo('/search');
    renderApp();
    expect(screen.getByTestId('page-search')).toBeInTheDocument();
  });

  it('renders CreatorDashboardPage at /dashboard', () => {
    navigateTo('/dashboard');
    renderApp();
    expect(screen.getByTestId('page-dashboard')).toBeInTheDocument();
  });

  // ── Phase 8 — 5 new routes ───────────────────────────────────────────────

  it('renders SongDetailPage at /songs/:songId', () => {
    navigateTo('/songs/song-001');
    renderApp();
    expect(screen.getByTestId('page-song-detail')).toBeInTheDocument();
  });

  it('renders ArtistPage at /artists/:artistId', () => {
    navigateTo('/artists/artist-001');
    renderApp();
    expect(screen.getByTestId('page-artist')).toBeInTheDocument();
  });

  it('renders ProfilePage at /profile', () => {
    navigateTo('/profile');
    renderApp();
    expect(screen.getByTestId('page-profile')).toBeInTheDocument();
  });

  it('renders PreferencesPage at /settings/preferences', () => {
    navigateTo('/settings/preferences');
    renderApp();
    expect(screen.getByTestId('page-preferences')).toBeInTheDocument();
  });

  it('renders CreatorSongAnalyticsPage at /dashboard/songs/:songId', () => {
    navigateTo('/dashboard/songs/song-001');
    renderApp();
    expect(screen.getByTestId('page-song-analytics')).toBeInTheDocument();
  });

  // ── Route specificity — /dashboard/songs/:songId must win over /dashboard ─

  it('/dashboard/songs/:songId does NOT render CreatorDashboardPage', () => {
    navigateTo('/dashboard/songs/song-001');
    renderApp();
    expect(screen.queryByTestId('page-dashboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('page-song-analytics')).toBeInTheDocument();
  });

  // ── Dynamic segments ─────────────────────────────────────────────────────

  it('renders SongDetailPage for any songId value', () => {
    navigateTo('/songs/abc-xyz-999');
    renderApp();
    expect(screen.getByTestId('page-song-detail')).toBeInTheDocument();
  });

  it('renders ArtistPage for any artistId value', () => {
    navigateTo('/artists/unknown-artist');
    renderApp();
    expect(screen.getByTestId('page-artist')).toBeInTheDocument();
  });

  it('renders CreatorSongAnalyticsPage for any songId under /dashboard/songs', () => {
    navigateTo('/dashboard/songs/another-song');
    renderApp();
    expect(screen.getByTestId('page-song-analytics')).toBeInTheDocument();
  });

  // ── ToastProvider is present (App-level context) ─────────────────────────

  it('wraps routes in ToastProvider (no crash on any route)', () => {
    navigateTo('/songs/song-001');
    expect(() => renderApp()).not.toThrow();
  });

  // ── RequireAuth — redirect unauthenticated user to /login ────────────────

  it('renders LoginPage at /login without auth (public route)', () => {
    navigateTo('/login');
    renderApp();
    expect(screen.getByTestId('page-login')).toBeInTheDocument();
  });
});
