import { describe, it, expect, beforeAll, afterEach, afterAll, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import NotificationBell from '../../components/NotificationBell';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const UNREAD_URL = 'http://localhost:5000/api/v1/notifications/unread';
const MARK_READ_URL = 'http://localhost:5000/api/v1/notifications/:id/read';

const mockNotifications = [
  { notificationId: 'n1', message: 'Sơn Tùng ra bài mới!', createdAt: '2026-05-07T10:00:00Z', isRead: false },
  { notificationId: 'n2', message: 'Vũ. ra album mới',     createdAt: '2026-05-06T08:00:00Z', isRead: false },
];

function makeUnreadHandler(items = mockNotifications, hasMore = false) {
  return http.get(UNREAD_URL, () =>
    HttpResponse.json({
      success: true,
      data: { items, hasMore },
      meta: {
        apiVersion: 'v1',
        requestId:  'r1',
        timestamp:  new Date().toISOString(),
        pagination: { hasMore, nextCursor: null },
      },
      error: null,
    }),
  );
}

function makeMarkReadHandler() {
  return http.patch(MARK_READ_URL, () =>
    HttpResponse.json({ success: true, data: null, meta: {}, error: null }),
  );
}

const server = setupServer(makeUnreadHandler(), makeMarkReadHandler());

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationBell', () => {
  describe('Badge count', () => {
    it('shows unread badge count when there are notifications', async () => {
      server.use(makeUnreadHandler(mockNotifications));
      render(<NotificationBell />);

      await waitFor(() => {
        expect(screen.getByTestId('notification-badge')).toHaveTextContent('2');
      });
    });

    it('hides badge when no unread notifications', async () => {
      server.use(makeUnreadHandler([]));
      render(<NotificationBell />);

      await waitFor(() => {
        expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
      });
    });

    it('caps badge at 99+ when > 99 notifications', async () => {
      const manyItems = Array.from({ length: 100 }, (_, i) => ({
        notificationId: `n${i}`, message: `Notif ${i}`, createdAt: new Date().toISOString(), isRead: false,
      }));
      server.use(makeUnreadHandler(manyItems));
      render(<NotificationBell />);

      await waitFor(() => {
        expect(screen.getByTestId('notification-badge')).toHaveTextContent('99+');
      });
    });
  });

  describe('Dropdown', () => {
    it('opens dropdown on bell click', async () => {
      server.use(makeUnreadHandler(mockNotifications));
      render(<NotificationBell />);
      await waitFor(() => screen.getByTestId('notification-badge'));

      fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('closes dropdown on second bell click', async () => {
      server.use(makeUnreadHandler(mockNotifications));
      render(<NotificationBell />);
      await waitFor(() => screen.getByTestId('notification-badge'));

      fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));
      fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('shows notification titles in dropdown', async () => {
      server.use(makeUnreadHandler(mockNotifications));
      render(<NotificationBell />);
      await waitFor(() => screen.getByTestId('notification-badge'));

      fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));
      expect(screen.getByText('Sơn Tùng ra bài mới!')).toBeInTheDocument();
      expect(screen.getByText('Vũ. ra album mới')).toBeInTheDocument();
    });

    it('shows empty state when no notifications', async () => {
      server.use(makeUnreadHandler([]));
      render(<NotificationBell />);
      await waitFor(() => {
        expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));
      expect(screen.getByText('Không có thông báo mới')).toBeInTheDocument();
    });

    it('shows "Xem tất cả" link when hasMore = true', async () => {
      server.use(makeUnreadHandler(mockNotifications, true));
      render(<NotificationBell />);
      await waitFor(() => screen.getByTestId('notification-badge'));

      fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));
      expect(screen.getByText('Xem tất cả')).toBeInTheDocument();
    });

    it('hides "Xem tất cả" when hasMore = false', async () => {
      server.use(makeUnreadHandler(mockNotifications, false));
      render(<NotificationBell />);
      await waitFor(() => screen.getByTestId('notification-badge'));

      fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));
      expect(screen.queryByText('Xem tất cả')).not.toBeInTheDocument();
    });
  });

  describe('Mark as read', () => {
    it('removes notification from list on click (optimistic update)', async () => {
      server.use(makeUnreadHandler(mockNotifications), makeMarkReadHandler());
      render(<NotificationBell />);
      await waitFor(() => screen.getByTestId('notification-badge'));

      fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));
      fireEvent.click(screen.getByText('Sơn Tùng ra bài mới!'));

      await waitFor(() => {
        expect(screen.queryByText('Sơn Tùng ra bài mới!')).not.toBeInTheDocument();
      });
      // badge updated
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('1');
    });

    it('restores notification if mark-read API fails', async () => {
      server.use(
        makeUnreadHandler(mockNotifications),
        http.patch(MARK_READ_URL, () => HttpResponse.json({ error: 'fail' }, { status: 500 })),
      );
      render(<NotificationBell />);
      await waitFor(() => screen.getByTestId('notification-badge'));

      fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));
      fireEvent.click(screen.getByText('Sơn Tùng ra bài mới!'));

      // After API failure, notification is restored
      await waitFor(() => {
        expect(screen.getByText('Sơn Tùng ra bài mới!')).toBeInTheDocument();
      });
    });
  });

  describe('Polling', () => {
    it('polls notifications every 30 seconds', async () => {
      let callCount = 0;
      server.use(
        http.get(UNREAD_URL, () => {
          callCount++;
          return HttpResponse.json({
            success: true,
            data: { items: mockNotifications, hasMore: false },
            meta: {},
            error: null,
          });
        }),
      );
      render(<NotificationBell />);

      await waitFor(() => expect(callCount).toBe(1));

      // Advance 30s → second poll
      await act(async () => { vi.advanceTimersByTime(30_000); });
      await waitFor(() => expect(callCount).toBe(2));
    });
  });

  describe('Error state', () => {
    it('shows error message when API fails', async () => {
      server.use(
        http.get(UNREAD_URL, () => HttpResponse.json({ success: false }, { status: 500 })),
      );
      render(<NotificationBell />);

      fireEvent.click(screen.getByRole('button', { name: /Thông báo/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });
  });
});
