import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import Sidebar from '../../../components/layout/Sidebar';
import { useAuthStore } from '../../../store/authStore';

// ---------------------------------------------------------------------------
// MSW handlers
// ---------------------------------------------------------------------------

const PROFILE_URL      = 'http://localhost:5000/api/v1/users/me';
const NOTIF_URL        = 'http://localhost:5000/api/v1/notifications/unread';

const profileHandler = http.get(PROFILE_URL, () =>
  HttpResponse.json({
    success: true,
    data: { userId: 'u1', email: 'test@example.com', displayName: 'Nghiệp', role: 'Listener', hasCompletedOnboarding: true },
    meta: { apiVersion: 'v1', requestId: 'r1', timestamp: '' },
    error: null,
  }),
);

const notifEmptyHandler = http.get(NOTIF_URL, () =>
  HttpResponse.json({
    success: true,
    data: { items: [], totalUnread: 0 },
    meta: { apiVersion: 'v1', requestId: 'r2', timestamp: '' },
    error: null,
  }),
);

const notifUnreadHandler = http.get(NOTIF_URL, () =>
  HttpResponse.json({
    success: true,
    data: { items: [], totalUnread: 3 },
    meta: { apiVersion: 'v1', requestId: 'r3', timestamp: '' },
    error: null,
  }),
);

const server = setupServer(profileHandler, notifEmptyHandler);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  useAuthStore.setState({ accessToken: null, userId: null, role: null });
  server.use(profileHandler, notifEmptyHandler);
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderSidebar(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

function renderAuthenticated(role: 'Listener' | 'Creator' | 'Admin' = 'Listener', path = '/') {
  useAuthStore.setState({ accessToken: 'mock-token', userId: 'u1', role });
  return renderSidebar(path);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Sidebar — navigation', () => {
  it('renders main navigation landmark', () => {
    renderSidebar();
    expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeInTheDocument();
  });

  it('renders core nav items visible to all roles', () => {
    renderAuthenticated();
    expect(screen.getByText('Trang chủ')).toBeInTheDocument();
    expect(screen.getByText('Tìm kiếm')).toBeInTheDocument();
    expect(screen.getByText('Thông báo')).toBeInTheDocument();
    expect(screen.getByText('Listening Party')).toBeInTheDocument();
  });

  it('hides Creator-only items for Listener role', () => {
    renderAuthenticated('Listener');
    expect(screen.queryByText('Tải nhạc lên')).not.toBeInTheDocument();
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument();
  });

  it('shows Creator-only items for Creator role', () => {
    renderAuthenticated('Creator');
    expect(screen.getByText('Tải nhạc lên')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('shows Creator-only items for Admin role', () => {
    renderAuthenticated('Admin');
    expect(screen.getByText('Tải nhạc lên')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  it('marks active link with aria-current=page', () => {
    renderAuthenticated('Listener', '/search');
    const searchLink = screen.getByText('Tìm kiếm').closest('a');
    expect(searchLink).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark inactive links with aria-current', () => {
    renderAuthenticated('Listener', '/search');
    const homeLink = screen.getByText('Trang chủ').closest('a');
    expect(homeLink).not.toHaveAttribute('aria-current');
  });
});

describe('Sidebar — static library section', () => {
  it('renders Thư viện của bạn heading', () => {
    renderAuthenticated();
    expect(screen.getByText('Thư viện của bạn')).toBeInTheDocument();
  });

  it('renders static library items', () => {
    renderAuthenticated();
    expect(screen.getByText('Nhạc Indie Việt')).toBeInTheDocument();
    expect(screen.getByText('Acoustic Chill')).toBeInTheDocument();
    expect(screen.getByText('The Strokes')).toBeInTheDocument();
  });
});

describe('Sidebar — user bottom section', () => {
  it('shows display name from profile API', async () => {
    renderAuthenticated();
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-username')).toHaveTextContent('Nghiệp');
    });
  });

  it('shows placeholder while profile is loading', () => {
    renderAuthenticated();
    // Before API resolves, shows '···'
    expect(screen.getByTestId('sidebar-username')).toHaveTextContent('···');
  });

  it('shows Listener label for Listener role', async () => {
    renderAuthenticated('Listener');
    await waitFor(() => {
      expect(screen.getByTestId('sidebar-username')).toHaveTextContent('Nghiệp');
    });
    expect(screen.getByText('Listener')).toBeInTheDocument();
  });

  it('shows Creator label for Creator role', () => {
    renderAuthenticated('Creator');
    expect(screen.getByText('Creator')).toBeInTheDocument();
  });
});

describe('Sidebar — user menu dropdown', () => {
  it('user bottom section renders as a button', () => {
    renderAuthenticated();
    expect(screen.getByTestId('user-menu-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('user-menu-trigger').tagName).toBe('BUTTON');
  });

  it('UserMenuDropdown is hidden by default', () => {
    renderAuthenticated();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking user-menu-trigger opens UserMenuDropdown', async () => {
    renderAuthenticated();
    fireEvent.click(screen.getByTestId('user-menu-trigger'));
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  it('UserMenuDropdown shows Profile and Preferences options when open', async () => {
    renderAuthenticated();
    fireEvent.click(screen.getByTestId('user-menu-trigger'));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Profile' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Preferences' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Logout' })).toBeInTheDocument();
    });
  });

  it('clicking outside closes UserMenuDropdown', async () => {
    renderAuthenticated();
    fireEvent.click(screen.getByTestId('user-menu-trigger'));
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});

describe('Sidebar — notification dot', () => {
  it('hides notification dot when no unread notifications', async () => {
    renderAuthenticated();
    // notifEmptyHandler returns totalUnread: 0
    await waitFor(() => {
      expect(screen.queryByTestId('notification-dot')).not.toBeInTheDocument();
    });
  });

  it('shows notification dot when there are unread notifications', async () => {
    server.use(notifUnreadHandler);
    renderAuthenticated();
    await waitFor(() => {
      expect(screen.getByTestId('notification-dot')).toBeInTheDocument();
    });
  });
});
