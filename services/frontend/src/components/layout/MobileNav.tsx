import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/api';
import type { ApiResponse } from '../../types/api';
import type { Party } from '../../types/domain';
import CreateRoomModal from '../../features/party/components/CreateRoomModal';
import JoinRoomModal from '../../features/party/components/JoinRoomModal';

type PartyModal = 'none' | 'create' | 'join';

const NAV_ITEMS = [
  { to: '/',              label: 'Trang chủ', icon: 'home'          },
  { to: '/search',        label: 'Tìm kiếm',  icon: 'search'        },
  { to: '/notifications', label: 'Thông báo', icon: 'notifications' },
  { to: '/party',         label: 'Party',     icon: 'groups'        },
  { to: '/profile',       label: 'Hồ sơ',     icon: 'person'        },
];

export default function MobileNav() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [unreadCount, setUnreadCount] = useState(0);
  const [partyModal,  setPartyModal]  = useState<PartyModal>('none');

  // Fetch unread count on mount (best-effort)
  useState(() => {
    if (!accessToken) return;
    apiClient
      .get<ApiResponse<{ totalUnread?: number; items: unknown[] }>>('/api/v1/notifications/unread')
      .then((res) => setUnreadCount(res.data.data?.totalUnread ?? 0))
      .catch(() => {});
  });

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handlePartyCreated = (party: Party) => {
    setPartyModal('none');
    navigate(`/party/${party.roomId}`, { state: { party, isHost: true } });
  };

  const handlePartyJoined = (party: Party) => {
    setPartyModal('none');
    navigate(`/party/${party.roomId}`, { state: { party, isHost: false } });
  };

  return (
    <>
      <nav
        aria-label="Điều hướng mobile"
        data-testid="mobile-nav"
        className="fixed bottom-0 left-0 right-0 h-14 bg-dark-surface border-t border-border-muted/30 flex lg:hidden z-[60] shadow-footer"
      >
        {NAV_ITEMS.map((item) => {
          const active   = isActive(item.to);
          const isNotif  = item.to === '/notifications';
          const isParty  = item.to === '/party';

          const btnClass = [
            'flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors duration-150',
            active ? 'text-text-base' : 'text-text-secondary',
          ].join(' ');

          const iconEl = (
            <div className="relative">
              <span
                className="material-symbols-outlined text-[22px]"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              {isNotif && unreadCount > 0 && (
                <span
                  data-testid="mobile-notification-dot"
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-spotify-green rounded-full"
                />
              )}
            </div>
          );

          if (isParty) {
            return (
              <button
                key={item.to}
                onClick={() => setPartyModal('create')}
                aria-label={item.label}
                className={btnClass}
              >
                {iconEl}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={btnClass}
            >
              {iconEl}
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {partyModal === 'create' && (
        <CreateRoomModal
          onClose={() => setPartyModal('none')}
          onCreated={handlePartyCreated}
          onSwitchToJoin={() => setPartyModal('join')}
        />
      )}
      {partyModal === 'join' && (
        <JoinRoomModal
          onClose={() => setPartyModal('none')}
          onJoined={handlePartyJoined}
        />
      )}
    </>
  );
}
