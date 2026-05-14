import type { NotificationFilter } from '../hooks/useNotifications';

interface Props {
  active: NotificationFilter;
  unreadCount: number;
  onChange: (filter: NotificationFilter) => void;
}

const PILLS: { value: NotificationFilter; label: string }[] = [
  { value: 'all',         label: 'Tất cả'       },
  { value: 'unread',      label: 'Chưa đọc'     },
  { value: 'new_release', label: 'Bài hát mới'  },
];

export default function FilterPills({ active, unreadCount, onChange }: Props) {
  return (
    <div role="group" aria-label="Lọc thông báo" className="flex gap-2 px-6 py-3 overflow-x-auto">
      {PILLS.map(({ value, label }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            aria-pressed={isActive}
            data-testid={`filter-pill-${value}`}
            style={isActive ? { backgroundColor: '#ffffff', color: '#121212' } : undefined}
            className={[
              'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium',
              'whitespace-nowrap transition-colors duration-150',
              isActive
                ? ''
                : 'bg-mid-dark text-text-secondary hover:text-text-base hover:bg-dark-surface',
            ].join(' ')}
          >
            {label}
            {value === 'unread' && unreadCount > 0 && (
              <span
                data-testid="unread-count-badge"
                style={isActive ? { backgroundColor: '#121212', color: '#ffffff' } : undefined}
                className={[
                  'min-w-[18px] h-[18px] rounded-full text-[11px] font-bold',
                  'flex items-center justify-center px-1',
                  isActive ? '' : 'bg-spotify-green text-[#121212]',
                ].join(' ')}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
