import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { useAuthStore } from '../store/authStore';
import { userService, type UserProfile } from '../services/userService';
import { GENRE_OPTIONS } from '../features/onboarding/components/GenreGrid';
import { ALL_ARTISTS } from '../features/onboarding/data/artistAvatars';

const GENRE_NAME: Record<string, string> = Object.fromEntries(GENRE_OPTIONS.map((g) => [g.id, g.name]));
const ARTIST_NAME: Record<string, string> = Object.fromEntries(ALL_ARTISTS.map((a) => [a.id, a.name]));

export default function ProfilePage() {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    userService.getProfile()
      .then((p) => {
        setProfile(p);
        setDisplayName(p.displayName);
        setAvatarSrc(p.avatarUrl ?? '');
      })
      .catch(() => {/* stay null → show generic fallback */})
      .finally(() => setLoading(false));
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setAvatarSrc(URL.createObjectURL(file));
  }

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-[640px] mx-auto py-8 space-y-4">
          <div className="w-[120px] h-[120px] rounded-full bg-dark-surface animate-shimmer mx-auto" />
          <div className="h-12 rounded-[8px] bg-dark-surface animate-shimmer" />
          <div className="h-12 rounded-[8px] bg-dark-surface animate-shimmer" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-[640px] mx-auto py-8">
        <h1 className="text-[24px] font-bold text-text-base mb-8">Hồ sơ của tôi</h1>

        {/* ── Avatar ── */}
        <div className="flex justify-center mb-8">
          <div className="relative group" data-testid="avatar-wrapper">
            <img
              src={avatarSrc || 'https://picsum.photos/seed/avatar/120/120'}
              alt="Avatar"
              className="w-[120px] h-[120px] rounded-full object-cover border-2 border-border-muted"
              data-testid="profile-avatar"
            />
            <button
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Đổi ảnh đại diện"
              data-testid="change-avatar-button"
            >
              <span className="material-symbols-outlined text-white text-[28px]">photo_camera</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
              data-testid="avatar-file-input"
            />
          </div>
        </div>

        {/* ── Display name ── */}
        <div className="bg-dark-surface rounded-[8px] p-4 mb-4" data-testid="name-section">
          <p className="text-text-secondary text-xs mb-2">Tên hiển thị</p>
          {editingName ? (
            <input
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') setEditingName(false); }}
              className="w-full bg-transparent text-text-base text-[16px] font-medium border-b border-spotify-green focus:outline-none pb-1"
              data-testid="name-input"
            />
          ) : (
            <span
              onClick={() => setEditingName(true)}
              className="text-text-base text-[16px] font-medium cursor-pointer hover:text-spotify-green transition-colors"
              data-testid="name-display"
            >
              {displayName || '—'}
            </span>
          )}
        </div>

        {/* ── Email ── */}
        <div className="bg-dark-surface rounded-[8px] p-4 mb-4 flex items-center gap-3" data-testid="email-section">
          <span className="material-symbols-outlined text-text-secondary text-[18px]">lock</span>
          <div>
            <p className="text-text-secondary text-xs">Email</p>
            <p className="text-text-base text-[14px]">{profile?.email ?? '—'}</p>
          </div>
        </div>

        {/* ── Role ── */}
        <div className="mb-6" data-testid="role-section">
          <span className="inline-block bg-mid-dark text-text-secondary text-xs px-3 py-1 rounded-full">
            {profile?.role ?? '—'}
          </span>
        </div>

        {/* ── Preferences ── */}
        <div className="mb-6" data-testid="preferences-section">
          {profile?.preferredGenres && profile.preferredGenres.length > 0 && (
            <div className="mb-4">
              <p className="text-text-secondary text-xs mb-2">Thể loại yêu thích</p>
              <div className="flex flex-wrap gap-2">
                {profile.preferredGenres.map((g) => (
                  <span key={g} className="bg-mid-dark text-text-base text-sm px-3 py-1 rounded-full">
                    {GENRE_NAME[g] ?? g}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profile?.preferredArtists && profile.preferredArtists.length > 0 && (
            <div>
              <p className="text-text-secondary text-xs mb-2">Nghệ sĩ yêu thích</p>
              <div className="flex flex-wrap gap-2">
                {profile.preferredArtists.map((a) => (
                  <span key={a} className="bg-mid-dark text-text-base text-sm px-3 py-1 rounded-full">
                    {ARTIST_NAME[a] ?? a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Edit preferences link ── */}
        <div className="mb-8">
          <Link
            to="/settings/preferences"
            className="text-spotify-green text-sm hover:underline"
            data-testid="edit-preferences-link"
          >
            Chỉnh sửa sở thích →
          </Link>
        </div>

        {/* ── Logout ── */}
        <button
          onClick={handleLogout}
          className="w-full py-3 rounded-[8px] border border-negative text-negative text-sm font-medium hover:bg-negative/10 transition-colors"
          data-testid="logout-button"
        >
          Đăng xuất
        </button>
      </div>
    </AppShell>
  );
}
