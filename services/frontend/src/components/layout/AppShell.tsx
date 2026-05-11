import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePlayerStore } from '../../store/playerStore';
import NotificationBell from '../NotificationBell';
import AudioPlayer from '../Player/AudioPlayer';
import { colors, font, fontSize, fontWeight, layout, shadows } from '../../styles/tokens';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const role = useAuthStore((s) => s.role);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const clearSong = usePlayerStore((s) => s.clearSong);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <div style={styles.root}>
      {/* ── Sidebar ── */}
      <aside style={styles.sidebar}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <span style={styles.logoIcon}>♪</span>
          <span style={styles.logoText}>Smart Music</span>
        </div>

        {/* Nav */}
        <nav style={styles.nav}>
          <NavLink to="/" label="Trang chủ" icon="🏠" active={isActive('/')} />
          <NavLink to="/search" label="Tìm kiếm" icon="🔍" active={isActive('/search')} />
          {(role === 'Creator' || role === 'Admin') && (
            <NavLink to="/dashboard" label="Dashboard" icon="📊" active={isActive('/dashboard')} />
          )}
        </nav>

        {/* Notification Bell at bottom of sidebar */}
        <div style={styles.sidebarBottom}>
          <NotificationBell />
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main style={styles.main}>
        {children}
      </main>

      {/* ── Bottom Player Bar ── */}
      <div style={styles.bottomBar}>
        {currentSong ? (
          <div style={styles.playerWrap}>
            <AudioPlayer
              songId={currentSong.songId}
              title={currentSong.title}
              artist={currentSong.artist}
            />
            <button
              onClick={clearSong}
              style={styles.closeBtn}
              aria-label="Đóng player"
            >
              ✕
            </button>
          </div>
        ) : (
          <span style={styles.emptyPlayer}>Chọn bài hát để phát</span>
        )}
      </div>
    </div>
  );
}

interface NavLinkProps {
  to: string;
  label: string;
  icon: string;
  active: boolean;
}

function NavLink({ to, label, icon, active }: NavLinkProps) {
  return (
    <Link
      to={to}
      style={{
        ...styles.navLink,
        color: active ? colors.text : colors.textMuted,
        fontWeight: active ? fontWeight.bold : fontWeight.regular,
        background: active ? colors.surfaceMid : 'transparent',
      }}
    >
      <span style={styles.navIcon}>{icon}</span>
      {label}
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    background: colors.bg,
    fontFamily: font.family,
    color: colors.text,
    position: 'relative',
  },

  // Sidebar
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: layout.sidebarWidth,
    height: '100vh',
    background: colors.bg,
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    overflowY: 'auto',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '24px 20px 20px',
  },
  logoIcon: {
    fontSize: 22,
    color: colors.accent,
  },
  logoText: {
    fontFamily: font.title,
    fontSize: fontSize.section,
    fontWeight: fontWeight.bold,
    color: colors.accent,
    letterSpacing: '-0.3px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '8px 12px',
    flex: 1,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    borderRadius: 6,
    fontSize: fontSize.caption,
    textDecoration: 'none',
    transition: 'background 0.15s, color 0.15s',
  },
  navIcon: {
    fontSize: 16,
    width: 20,
    textAlign: 'center',
  },
  sidebarBottom: {
    padding: '12px 20px 24px',
    borderTop: `1px solid ${colors.border}`,
    marginTop: 'auto',
  },

  // Main content
  main: {
    marginLeft: layout.sidebarWidth,
    marginBottom: layout.bottomBarHeight,
    minHeight: '100vh',
    flex: 1,
    overflowY: 'auto',
  },

  // Bottom bar
  bottomBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: layout.bottomBarHeight,
    background: colors.surface,
    borderTop: `1px solid ${colors.border}`,
    boxShadow: shadows.heavy,
    display: 'flex',
    alignItems: 'center',
    zIndex: 100,
  },
  playerWrap: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    paddingRight: 16,
    overflow: 'hidden',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: colors.textMuted,
    fontSize: 16,
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: 4,
    flexShrink: 0,
    transition: 'color 0.15s',
    marginLeft: 'auto',
  },
  emptyPlayer: {
    color: colors.textMuted,
    fontSize: fontSize.caption,
    paddingLeft: layout.sidebarWidth + 24,
  },
};
