import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchUnreadNotifications,
  markNotificationRead,
} from '../services/notificationService';
import type { Notification as NotificationItem } from '../types/domain';

const POLL_INTERVAL_MS = 30_000;

export default function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchUnreadNotifications(10);
      setItems(data.items);
      setHasMore(data.hasMore);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // Initial load + poll every 30s
  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const handleNotificationClick = async (notification: NotificationItem) => {
    const idempotencyKey = crypto.randomUUID();
    // Optimistic update — remove from unread list immediately
    setItems((prev) => prev.filter((n) => n.notificationId !== notification.notificationId));
    try {
      await markNotificationRead(notification.notificationId, idempotencyKey);
    } catch {
      // Restore if API fails
      setItems((prev) => [notification, ...prev]);
    }
  };

  return (
    <div ref={dropdownRef} style={styles.container}>
      <button
        onClick={() => setIsOpen((o) => !o)}
        style={styles.bellBtn}
        aria-label={`Thông báo${items.length > 0 ? `, ${items.length} chưa đọc` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span role="img" aria-hidden="true" style={styles.bellIcon}>🔔</span>
        {items.length > 0 && (
          <span style={styles.badge} data-testid="notification-badge">
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={styles.dropdown}
          role="listbox"
          aria-label="Danh sách thông báo"
        >
          <div style={styles.dropdownHeader}>
            <span style={styles.dropdownTitle}>Thông báo</span>
          </div>

          {error && (
            <p style={styles.errorText} role="alert">
              Không thể tải thông báo
            </p>
          )}

          {!error && items.length === 0 && (
            <p style={styles.emptyText}>Không có thông báo mới</p>
          )}

          {!error && items.map((notification) => (
            <button
              key={notification.notificationId}
              role="option"
              aria-selected={false}
              onClick={() => handleNotificationClick(notification)}
              style={styles.notifItem}
            >
              <p style={styles.notifTitle}>{notification.message}</p>
              <p style={styles.notifTime}>
                {new Date(notification.createdAt).toLocaleDateString('vi-VN')}
              </p>
            </button>
          ))}

          {hasMore && (
            <a href="/notifications" style={styles.viewAllLink}>
              Xem tất cả
            </a>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { position: 'relative', display: 'inline-block' },
  bellBtn: {
    position: 'relative',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.4rem',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
  },
  bellIcon: { fontSize: '1.25rem' },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    background: '#e74c3c',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
    lineHeight: 1,
  },
  dropdown: {
    position: 'absolute',
    top: '110%',
    right: 0,
    width: 320,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    zIndex: 200,
    overflow: 'hidden',
  },
  dropdownHeader: {
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #2a2a2a',
  },
  dropdownTitle: { fontWeight: 600, fontSize: '0.9rem', color: '#fff' },
  errorText: { color: '#ff6b6b', textAlign: 'center', padding: '1rem', margin: 0, fontSize: '0.85rem' },
  emptyText: { color: '#666', textAlign: 'center', padding: '1.5rem', margin: 0, fontSize: '0.85rem' },
  notifItem: {
    display: 'block',
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #222',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#fff',
    transition: 'background 0.1s',
  },
  notifTitle: { margin: '0 0 0.2rem', fontSize: '0.85rem', fontWeight: 600 },
  notifBody: { margin: '0 0 0.25rem', fontSize: '0.8rem', color: '#aaa' },
  notifTime: { margin: 0, fontSize: '0.75rem', color: '#555' },
  viewAllLink: {
    display: 'block',
    textAlign: 'center',
    padding: '0.75rem',
    color: '#1db954',
    textDecoration: 'none',
    fontSize: '0.85rem',
    borderTop: '1px solid #222',
  },
};
