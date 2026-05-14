import type { Notification } from '../../../types/domain';

interface Props {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} giờ trước`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return new Date(isoDate).toLocaleDateString('vi-VN');
}

export default function NotificationRow({ notification, onMarkRead }: Props) {
  const { notificationId, message, read, createdAt, type } = notification;
  const icon = type === 'new_release' ? 'music_note' : 'notifications';

  const handleClick = () => {
    if (!read) onMarkRead(notificationId);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={message}
      data-testid="notification-row"
      className={[
        'w-full flex items-start gap-4 px-6 py-4 text-left',
        'transition-colors duration-150',
        read
          ? 'hover:bg-mid-dark/30'
          : 'bg-mid-dark/20 hover:bg-mid-dark/50',
      ].join(' ')}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-mid-dark flex items-center justify-center mt-0.5">
        <span
          className="material-symbols-outlined text-[18px] text-spotify-green"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={[
            'text-sm leading-snug',
            read ? 'text-text-secondary' : 'text-text-base font-medium',
          ].join(' ')}
        >
          {message}
        </p>
        <p className="text-xs text-text-secondary mt-1">{timeAgo(createdAt)}</p>
      </div>

      {/* Unread dot */}
      <div className="flex-shrink-0 mt-2">
        {!read ? (
          <span
            data-testid="unread-dot"
            className="block w-2 h-2 rounded-full bg-spotify-green"
          />
        ) : (
          <span className="block w-2 h-2" />
        )}
      </div>
    </button>
  );
}
