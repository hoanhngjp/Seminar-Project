import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import MobileNav from '../../../components/layout/MobileNav';
import { useAuthStore } from '../../../store/authStore';

// ---------------------------------------------------------------------------
// MSW
// ---------------------------------------------------------------------------

const NOTIF_URL = 'http://localhost:5000/api/v1/notifications/unread';

function makeNotifHandler(totalUnread = 0) {
  return http.get(NOTIF_URL, () =>
    HttpResponse.json({
      success: true,
      data: { items: [], hasMore: false, totalUnread },
      meta: { apiVersion: 'v1', requestId: 'r1', timestamp: '' },
      error: null,
    }),
  );
}

const server = setupServer(makeNotifHandler());

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  server.use(makeNotifHandler());
  useAuthStore.setState({ accessToken: null, userId: null, role: null });
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderNav(path = '/') {
  useAuthStore.setState({ accessToken: 'mock-token', userId: 'u1', role: 'Listener' });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MobileNav />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MobileNav — navigation landmark', () => {
  it('renders mobile nav landmark', () => {
    renderNav();
    expect(screen.getByRole('navigation', { name: 'Điều hướng mobile' })).toBeInTheDocument();
  });

  it('has data-testid mobile-nav', () => {
    renderNav();
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
  });
});

describe('MobileNav — nav items', () => {
  it('renders Trang chủ item', () => {
    renderNav();
    expect(screen.getByText('Trang chủ')).toBeInTheDocument();
  });

  it('renders Tìm kiếm item', () => {
    renderNav();
    expect(screen.getByText('Tìm kiếm')).toBeInTheDocument();
  });

  it('renders Thông báo item', () => {
    renderNav();
    expect(screen.getByText('Thông báo')).toBeInTheDocument();
  });

  it('renders Party item', () => {
    renderNav();
    expect(screen.getByText('Party')).toBeInTheDocument();
  });

  it('marks active link with aria-current=page', () => {
    renderNav('/search');
    const searchLink = screen.getByText('Tìm kiếm').closest('a');
    expect(searchLink).toHaveAttribute('aria-current', 'page');
  });

  it('home link is active on / route', () => {
    renderNav('/');
    const homeLink = screen.getByText('Trang chủ').closest('a');
    expect(homeLink).toHaveAttribute('aria-current', 'page');
  });
});

describe('MobileNav — notification dot', () => {
  it('does not show notification dot when no unread', async () => {
    renderNav();
    await waitFor(() => {
      expect(screen.queryByTestId('mobile-notification-dot')).not.toBeInTheDocument();
    });
  });

  it('shows notification dot when there are unread notifications', async () => {
    server.use(makeNotifHandler(3));
    renderNav();
    await waitFor(() => {
      expect(screen.getByTestId('mobile-notification-dot')).toBeInTheDocument();
    });
  });
});

describe('MobileNav — party modal', () => {
  it('Party item is a button (not a link)', () => {
    renderNav();
    const partyBtn = screen.getByRole('button', { name: 'Party' });
    expect(partyBtn).toBeInTheDocument();
  });

  it('clicking Party button opens CreateRoomModal', async () => {
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: 'Party' }));
    await waitFor(() => {
      // CreateRoomModal has a heading
      expect(screen.getByRole('heading', { name: /Tạo phòng/i })).toBeInTheDocument();
    });
  });
});
