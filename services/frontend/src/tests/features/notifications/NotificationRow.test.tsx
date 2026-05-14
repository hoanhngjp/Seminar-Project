import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NotificationRow from '../../../features/notifications/components/NotificationRow';
import type { Notification } from '../../../types/domain';

const UNREAD_NOTIF: Notification = {
  notificationId: 'n-001',
  message: 'Sơn Tùng vừa phát hành bài hát mới',
  read: false,
  type: 'new_release',
  createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 min ago
};

const READ_NOTIF: Notification = {
  notificationId: 'n-002',
  message: 'Album mới đã ra mắt',
  read: true,
  type: 'new_release',
  createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(), // 1 day ago
};

const SYSTEM_NOTIF: Notification = {
  notificationId: 'n-003',
  message: 'Hệ thống sẽ bảo trì lúc 2 giờ sáng',
  read: false,
  type: 'system',
  createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
};

describe('NotificationRow — rendering', () => {
  it('renders notification message', () => {
    render(<NotificationRow notification={UNREAD_NOTIF} onMarkRead={vi.fn()} />);
    expect(screen.getByText('Sơn Tùng vừa phát hành bài hát mới')).toBeInTheDocument();
  });

  it('shows unread dot for unread notification', () => {
    render(<NotificationRow notification={UNREAD_NOTIF} onMarkRead={vi.fn()} />);
    expect(screen.getByTestId('unread-dot')).toBeInTheDocument();
  });

  it('does not show unread dot for read notification', () => {
    render(<NotificationRow notification={READ_NOTIF} onMarkRead={vi.fn()} />);
    expect(screen.queryByTestId('unread-dot')).not.toBeInTheDocument();
  });

  it('shows time ago text', () => {
    render(<NotificationRow notification={UNREAD_NOTIF} onMarkRead={vi.fn()} />);
    expect(screen.getByText(/phút trước/)).toBeInTheDocument();
  });

  it('shows "1 ngày trước" for notification 25 hours ago', () => {
    render(<NotificationRow notification={READ_NOTIF} onMarkRead={vi.fn()} />);
    expect(screen.getByText(/ngày trước/)).toBeInTheDocument();
  });

  it('renders music_note icon for new_release type', () => {
    render(<NotificationRow notification={UNREAD_NOTIF} onMarkRead={vi.fn()} />);
    const icons = screen.getAllByText('music_note');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('renders notifications icon for system type', () => {
    render(<NotificationRow notification={SYSTEM_NOTIF} onMarkRead={vi.fn()} />);
    const icons = screen.getAllByText('notifications');
    expect(icons.length).toBeGreaterThan(0);
  });
});

describe('NotificationRow — interactions', () => {
  it('calls onMarkRead with notificationId when unread row is clicked', () => {
    const onMarkRead = vi.fn();
    render(<NotificationRow notification={UNREAD_NOTIF} onMarkRead={onMarkRead} />);
    fireEvent.click(screen.getByTestId('notification-row'));
    expect(onMarkRead).toHaveBeenCalledWith('n-001');
  });

  it('does NOT call onMarkRead when read row is clicked', () => {
    const onMarkRead = vi.fn();
    render(<NotificationRow notification={READ_NOTIF} onMarkRead={onMarkRead} />);
    fireEvent.click(screen.getByTestId('notification-row'));
    expect(onMarkRead).not.toHaveBeenCalled();
  });
});
