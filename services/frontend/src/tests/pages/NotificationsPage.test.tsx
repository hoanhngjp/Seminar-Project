import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import NotificationsPage from '../../pages/NotificationsPage';
import { useAuthStore } from '../../store/authStore';
import { ToastProvider } from '../../contexts/ToastContext';

// ---------------------------------------------------------------------------
// MSW
// ---------------------------------------------------------------------------

const NOTIF_URL = 'http://localhost:5000/api/v1/notifications/unread';
const MARK_ID_URL = 'http://localhost:5000/api/v1/notifications/:id/read';
const MARK_ALL_URL = 'http://localhost:5000/api/v1/notifications/read-all';

const MOCK_NOTIFS = [
  {
    notificationId: 'n-001',
    message: 'Sơn Tùng ra bài mới',
    read: false,
    type: 'new_release',
    createdAt: new Date(Date.now() - 60_000 * 5).toISOString(),
  },
  {
    notificationId: 'n-002',
    message: 'Thông báo hệ thống',
    read: false,
    type: 'system',
    createdAt: new Date(Date.now() - 60_000 * 30).toISOString(),
  },
  {
    notificationId: 'n-003',
    message: 'Ngọt ra album cũ',
    read: true,
    type: 'new_release',
    createdAt: new Date(Date.now() - 60_000 * 60 * 24).toISOString(),
  },
];

function makeNotifHandler(items = MOCK_NOTIFS) {
  return http.get(NOTIF_URL, () =>
    HttpResponse.json({
      success: true,
      data: { items, hasMore: false, totalUnread: items.filter((n) => !n.read).length },
      meta: { apiVersion: 'v1', requestId: 'r1', timestamp: new Date().toISOString() },
      error: null,
    }),
  );
}

function makeMarkIdHandler() {
  return http.patch(MARK_ID_URL, () =>
    HttpResponse.json({ success: true, data: null, meta: {}, error: null }),
  );
}

function makeMarkAllHandler() {
  return http.patch(MARK_ALL_URL, () =>
    HttpResponse.json({ success: true, data: null, meta: {}, error: null }),
  );
}

const server = setupServer(makeNotifHandler(), makeMarkIdHandler(), makeMarkAllHandler());

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  server.use(makeNotifHandler(), makeMarkIdHandler(), makeMarkAllHandler());
  useAuthStore.setState({ accessToken: 'mock-token', userId: 'u1', role: 'Listener' });
});
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderPage() {
  useAuthStore.setState({ accessToken: 'mock-token', userId: 'u1', role: 'Listener' });
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/notifications']}>
        <NotificationsPage />
      </MemoryRouter>
    </ToastProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationsPage — header', () => {
  it('renders page heading', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Thông báo' })).toBeInTheDocument();
  });

  it('shows "Đánh dấu tất cả đã đọc" when there are unread notifications', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('mark-all-read-btn')).toBeInTheDocument();
    });
  });

  it('hides "Đánh dấu tất cả đã đọc" when no unread notifications', async () => {
    server.use(
      makeNotifHandler(MOCK_NOTIFS.map((n) => ({ ...n, read: true }))),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId('mark-all-read-btn')).not.toBeInTheDocument();
    });
  });
});

describe('NotificationsPage — loading + list', () => {
  it('shows skeleton while loading', () => {
    renderPage();
    expect(screen.getByTestId('notifications-skeleton')).toBeInTheDocument();
  });

  it('shows notification rows after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('notifications-list')).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('notification-row')).toHaveLength(3);
  });

  it('renders notification messages', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('notifications-list'));
    expect(screen.getByText('Sơn Tùng ra bài mới')).toBeInTheDocument();
    expect(screen.getByText('Thông báo hệ thống')).toBeInTheDocument();
    expect(screen.getByText('Ngọt ra album cũ')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', async () => {
    server.use(makeNotifHandler([]));
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });

  it('shows error state when API fails', async () => {
    server.use(
      http.get(NOTIF_URL, () => HttpResponse.json({ success: false }, { status: 500 })),
    );
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

describe('NotificationsPage — FilterPills', () => {
  it('renders all 3 filter pills', async () => {
    renderPage();
    expect(screen.getByTestId('filter-pill-all')).toBeInTheDocument();
    expect(screen.getByTestId('filter-pill-unread')).toBeInTheDocument();
    expect(screen.getByTestId('filter-pill-new_release')).toBeInTheDocument();
  });

  it('"Chưa đọc" filter shows only unread notifications', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('notifications-list'));

    fireEvent.click(screen.getByTestId('filter-pill-unread'));
    const rows = screen.getAllByTestId('notification-row');
    // 2 unread in mock data
    expect(rows).toHaveLength(2);
  });

  it('"Bài hát mới" filter shows only new_release type', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('notifications-list'));

    fireEvent.click(screen.getByTestId('filter-pill-new_release'));
    const rows = screen.getAllByTestId('notification-row');
    // 2 new_release in mock data (n-001, n-003)
    expect(rows).toHaveLength(2);
  });

  it('switching back to "Tất cả" shows all notifications', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('notifications-list'));

    fireEvent.click(screen.getByTestId('filter-pill-unread'));
    fireEvent.click(screen.getByTestId('filter-pill-all'));
    expect(screen.getAllByTestId('notification-row')).toHaveLength(3);
  });
});

describe('NotificationsPage — mark as read', () => {
  it('clicking unread row marks it as read (optimistic — dot disappears)', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('notifications-list'));

    const rows = screen.getAllByTestId('notification-row');
    const unreadDotsBefore = screen.getAllByTestId('unread-dot');
    expect(unreadDotsBefore).toHaveLength(2);

    fireEvent.click(rows[0]!);
    await waitFor(() => {
      expect(screen.getAllByTestId('unread-dot')).toHaveLength(1);
    });
  });

  it('"Đánh dấu tất cả đã đọc" removes all unread dots', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('mark-all-read-btn'));

    fireEvent.click(screen.getByTestId('mark-all-read-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('unread-dot')).not.toBeInTheDocument();
    });
  });

  it('shows toast after marking all as read', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('mark-all-read-btn'));

    fireEvent.click(screen.getByTestId('mark-all-read-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('toast')).toBeInTheDocument();
    });
  });
});
