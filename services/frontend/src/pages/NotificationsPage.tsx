import AppShell from '../components/layout/AppShell';
import SkeletonRow from '../components/ui/SkeletonRow';
import FilterPills from '../features/notifications/components/FilterPills';
import NotificationRow from '../features/notifications/components/NotificationRow';
import { useNotifications } from '../features/notifications/hooks/useNotifications';
import { useToast } from '../contexts/ToastContext';

export default function NotificationsPage() {
  const {
    filteredNotifications,
    filter,
    setFilter,
    isLoading,
    error,
    unreadCount,
    markRead,
    markAllRead,
  } = useNotifications();

  const toast = useToast();

  const handleMarkAllRead = async () => {
    await markAllRead();
    toast.show('Đã đánh dấu tất cả đã đọc', 'success');
  };

  return (
    <AppShell>
      {/* ── Header ── */}
      <div className="px-6 pt-8 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-emphasis">Thông báo</h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            data-testid="mark-all-read-btn"
            className="text-sm text-spotify-green hover:underline transition-colors"
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      {/* ── Filter pills ── */}
      <FilterPills active={filter} unreadCount={unreadCount} onChange={setFilter} />

      {/* ── Divider ── */}
      <div className="border-t border-border-muted/20 mx-6" />

      {/* ── Content ── */}
      {isLoading ? (
        <div className="px-6 pt-4 space-y-3" data-testid="notifications-skeleton">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center py-24 text-text-secondary gap-3"
        >
          <span className="material-symbols-outlined text-[48px]">error_outline</span>
          <p className="text-sm">{error}</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div
          data-testid="empty-state"
          className="flex flex-col items-center justify-center py-24 text-text-secondary gap-3"
        >
          <span
            className="material-symbols-outlined text-[48px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            notifications_off
          </span>
          <p className="text-sm">
            {filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Không có thông báo nào'}
          </p>
        </div>
      ) : (
        <div data-testid="notifications-list">
          {filteredNotifications.map((n) => (
            <NotificationRow key={n.notificationId} notification={n} onMarkRead={markRead} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
