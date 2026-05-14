import { useState, useEffect, useCallback } from 'react';
import {
  fetchUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../../services/notificationService';
import type { Notification, NotificationType } from '../../../types/domain';

export type NotificationFilter = 'all' | 'unread' | 'new_release';

interface UseNotificationsReturn {
  notifications: Notification[];
  filteredNotifications: Notification[];
  filter: NotificationFilter;
  setFilter: (f: NotificationFilter) => void;
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchUnreadNotifications(50)
      .then(({ items }) => {
        if (!cancelled) setNotifications(items);
      })
      .catch(() => {
        if (!cancelled) setError('Không thể tải thông báo.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'new_release') return n.type === ('new_release' as NotificationType);
    return true;
  });

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === id ? { ...n, read: true } : n)),
    );
    try {
      await markNotificationRead(id, `mark-read-${id}-${Date.now()}`);
    } catch {
      // Rollback on failure
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === id ? { ...n, read: false } : n)),
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const prev = notifications;
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      setNotifications(prev);
    }
  }, [notifications]);

  return {
    notifications,
    filteredNotifications,
    filter,
    setFilter,
    isLoading,
    error,
    unreadCount,
    markRead,
    markAllRead,
  };
}
