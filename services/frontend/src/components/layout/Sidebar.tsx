import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { userService, type UserProfile } from '../../services/userService';
import { apiClient } from '../../services/api';
import type { ApiResponse } from '../../types/api';
import type { Party } from '../../types/domain';
import CreateRoomModal from '../../features/party/components/CreateRoomModal';
import JoinRoomModal from '../../features/party/components/JoinRoomModal';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',            label: 'Trang chủ',      icon: 'home'          },
  { to: '/search',      label: 'Tìm kiếm',       icon: 'search'        },
  { to: '/notifications', label: 'Thông báo',    icon: 'notifications' },
  { to: '/party',       label: 'Listening Party', icon: 'groups'        },
  { to: '/upload',      label: 'Tải nhạc lên',   icon: 'upload',       roles: ['Creator', 'Admin'] },
  { to: '/analytics',   label: 'Analytics',      icon: 'analytics',    roles: ['Creator', 'Admin'] },
];

// Static library items — no playlist API in MVP
const LIBRARY_ITEMS = [
  { id: 'lib-1', name: 'Nhạc Indie Việt',    sub: 'Playlist • Vì bạn nghe sáng nay', round: false },
  { id: 'lib-2', name: 'Acoustic Chill',     sub: 'Playlist • SoundWave',            round: false },
  { id: 'lib-3', name: 'The Strokes',        sub: 'Nghệ sĩ',                         round: true  },
];

type PartyModal = 'none' | 'create' | 'join';

export default function Sidebar() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const role        = useAuthStore((s) => s.role);

  const [profile,     setProfile]     = useState<UserProfile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [partyModal,  setPartyModal]  = useState<PartyModal>('none');

  useEffect(() => {
    if (!accessToken) return;
    userService.getProfile().then(setProfile).catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    apiClient
      .get<ApiResponse<{ items: unknown[]; totalUnread: number }>>('/api/v1/notifications/unread')
      .then((res) => setUnreadCount(res.data.data?.totalUnread ?? 0))
      .catch(() => {});
  }, [accessToken]);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  );

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
      aria-label="Điều hướng chính"
      className="hidden lg:flex flex-col h-full bg-near-black pt-xl fixed left-0 top-0 w-[240px] shadow-[rgba(0,0,0,0.5)_0px_8px_24px] z-50 pb-[72px]"
    >
      {/* ── Logo ── */}
      <div className="px-lg mb-8">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-spotify-green"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            music_note
          </span>
          <h1 className="font-bold text-[16px] text-text-emphasis tracking-tight">SoundWave</h1>
        </div>
      </div>

      {/* ── Nav links ── */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {visibleItems.map((item) => {
          const active = isActive(item.to);
          const isNotif = item.to === '/notifications';
          const isParty = item.to === '/party';

          const itemClass = [
            'flex items-center gap-4 py-3 px-4 rounded-md w-full text-left',
            'transition-all duration-200 active:scale-95',
            active
              ? 'text-text-base font-bold bg-mid-dark/50 hover:text-text-base'
              : 'text-text-secondary hover:text-text-base font-normal',
          ].join(' ');

          const iconEl = isNotif ? (
            <div className="relative">
              <span
                className="material-symbols-outlined"
                style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                notifications
              </span>
              {unreadCount > 0 && (
                <span
                  data-testid="notification-dot"
                  className="absolute top-0 right-0 w-2 h-2 bg-spotify-green rounded-full"
                />
              )}
            </div>
          ) : (
            <span
              className="material-symbols-outlined"
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              {item.icon}
            </span>
          );

          if (isParty) {
            return (
              <button
                key={item.to}
                onClick={() => setPartyModal('create')}
                aria-label={item.label}
                className={itemClass}
              >
                {iconEl}
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={itemClass}
            >
              {iconEl}
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* ── Thư viện (static) ── */}
        <div className="mt-6 pt-4 border-t border-border-muted/30 px-4">
          <div className="flex items-center justify-between text-text-secondary mb-4">
            <span className="font-bold text-sm tracking-wide">Thư viện của bạn</span>
            <span className="material-symbols-outlined hover:text-text-base cursor-pointer">add</span>
          </div>
          <div className="space-y-3">
            {LIBRARY_ITEMS.map((lib) => (
              <a key={lib.id} className="flex items-center gap-3 group" href="#">
                <div
                  className={[
                    'w-12 h-12 bg-mid-dark overflow-hidden flex-shrink-0 relative',
                    lib.round ? 'rounded-full' : 'rounded',
                  ].join(' ')}
                >
                  <span className="material-symbols-outlined text-text-secondary absolute inset-0 m-auto w-fit h-fit text-[18px]">
                    music_note
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-text-base truncate group-hover:text-spotify-green transition-colors">
                    {lib.name}
                  </span>
                  <span className="text-text-secondary truncate text-xs">{lib.sub}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── User bottom section ── */}
      <div className="p-4 mt-auto">
        <div className="bg-dark-surface rounded-lg p-3 flex items-center gap-3 hover:bg-mid-dark transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-full border border-border-muted bg-mid-dark flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-text-secondary text-[18px]">person</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span
              data-testid="sidebar-username"
              className="font-bold text-sm group-hover:text-white transition-colors truncate"
            >
              {profile?.displayName ?? '···'}
            </span>
            <span className="text-xs text-text-secondary truncate">
              {role === 'Creator' ? 'Creator' : role === 'Admin' ? 'Admin' : 'Listener'}
            </span>
          </div>
        </div>
      </div>
    </nav>

    {/* Party modals — rendered outside nav to avoid z-index clipping */}
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
