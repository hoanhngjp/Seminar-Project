import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface NavItem {
  to:    string;
  label: string;
  icon:  string;
  /** Only show for these roles; undefined = show for all */
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',          label: 'Trang chủ',      icon: 'home'           },
  { to: '/search',    label: 'Tìm kiếm',       icon: 'search'         },
  { to: '/notifications', label: 'Thông báo',  icon: 'notifications'  },
  { to: '/party',     label: 'Listening Party', icon: 'groups'         },
  { to: '/upload',    label: 'Tải nhạc lên',   icon: 'upload',         roles: ['Creator', 'Admin'] },
  { to: '/analytics', label: 'Analytics',      icon: 'analytics',      roles: ['Creator', 'Admin'] },
];

export default function Sidebar() {
  const location = useLocation();
  const role     = useAuthStore((s) => s.role);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  );

  return (
    <nav
      aria-label="Điều hướng chính"
      className="hidden lg:flex flex-col h-full bg-near-black pt-xl fixed left-0 top-0 w-[240px] shadow-level-3 z-50 pb-[72px]"
    >
      {/* Logo */}
      <div className="px-lg mb-8">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-spotify-green"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            music_note
          </span>
          <span className="font-bold text-base text-text-emphasis tracking-tight">SoundWave</span>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {visibleItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex items-center gap-4 py-3 px-4 rounded-md',
                'transition-all duration-200 active:scale-95',
                active
                  ? 'text-text-base font-bold bg-mid-dark/50'
                  : 'text-text-secondary hover:text-text-base font-normal',
              ].join(' ')}
            >
              <span className="material-symbols-outlined" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
