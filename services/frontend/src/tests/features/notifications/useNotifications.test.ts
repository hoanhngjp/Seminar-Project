import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from '../../../features/notifications/hooks/useNotifications';
import * as notificationService from '../../../services/notificationService';

vi.mock('../../../services/notificationService');

const MOCK_ITEMS = [
  {
    notificationId: 'n-001',
    message: 'Bài hát mới từ Sơn Tùng',
    read: false,
    type: 'new_release' as const,
    createdAt: new Date().toISOString(),
  },
  {
    notificationId: 'n-002',
    message: 'Hệ thống bảo trì',
    read: false,
    type: 'system' as const,
    createdAt: new Date().toISOString(),
  },
  {
    notificationId: 'n-003',
    message: 'Album mới từ Ngọt',
    read: true,
    type: 'new_release' as const,
    createdAt: new Date().toISOString(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(notificationService.fetchUnreadNotifications).mockResolvedValue({
    items: MOCK_ITEMS,
    hasMore: false,
    nextCursor: null,
    totalUnread: 2,
  });
  vi.mocked(notificationService.markNotificationRead).mockResolvedValue(undefined);
  vi.mocked(notificationService.markAllNotificationsRead).mockResolvedValue(undefined);
});

describe('useNotifications — initial load', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.isLoading).toBe(true);
  });

  it('loads notifications on mount', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifications).toHaveLength(3);
  });

  it('computes unread count correctly', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.unreadCount).toBe(2);
  });

  it('sets error state on API failure', async () => {
    vi.mocked(notificationService.fetchUnreadNotifications).mockRejectedValueOnce(new Error('Network error'));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });
});

describe('useNotifications — filtering', () => {
  it('default filter "all" returns all notifications', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.filteredNotifications).toHaveLength(3);
  });

  it('filter "unread" returns only unread notifications', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setFilter('unread'));
    expect(result.current.filteredNotifications).toHaveLength(2);
    expect(result.current.filteredNotifications.every((n) => !n.read)).toBe(true);
  });

  it('filter "new_release" returns only new_release type notifications', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setFilter('new_release'));
    expect(result.current.filteredNotifications).toHaveLength(2);
    expect(result.current.filteredNotifications.every((n) => n.type === 'new_release')).toBe(true);
  });

  it('setFilter updates the filter state', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setFilter('unread'));
    expect(result.current.filter).toBe('unread');
  });
});

describe('useNotifications — markRead', () => {
  it('optimistically marks notification as read', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.markRead('n-001'); });
    const updated = result.current.notifications.find((n) => n.notificationId === 'n-001');
    expect(updated?.read).toBe(true);
  });

  it('calls markNotificationRead service with correct id', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.markRead('n-002'); });
    expect(notificationService.markNotificationRead).toHaveBeenCalledWith(
      'n-002',
      expect.stringContaining('mark-read-n-002'),
    );
  });

  it('rolls back optimistic update on API failure', async () => {
    vi.mocked(notificationService.markNotificationRead).mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.markRead('n-001'); });
    const restored = result.current.notifications.find((n) => n.notificationId === 'n-001');
    expect(restored?.read).toBe(false);
  });
});

describe('useNotifications — markAllRead', () => {
  it('marks all notifications as read', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.markAllRead(); });
    expect(result.current.notifications.every((n) => n.read)).toBe(true);
  });

  it('calls markAllNotificationsRead service', async () => {
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.markAllRead(); });
    expect(notificationService.markAllNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it('rolls back if markAllRead API fails', async () => {
    vi.mocked(notificationService.markAllNotificationsRead).mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const unreadBefore = result.current.notifications.filter((n) => !n.read).length;
    await act(async () => { await result.current.markAllRead(); });
    const unreadAfter = result.current.notifications.filter((n) => !n.read).length;
    expect(unreadAfter).toBe(unreadBefore);
  });
});
