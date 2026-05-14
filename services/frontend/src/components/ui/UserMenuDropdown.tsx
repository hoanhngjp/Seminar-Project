import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface UserProfile {
  displayName: string;
  email: string;
  role: string;
}

interface UserMenuDropdownProps {
  profile: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}

export default function UserMenuDropdown({ profile, isOpen, onClose, anchorRef }: UserMenuDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  function handleLogout() {
    clearAuth();
    navigate('/login');
    onClose();
  }

  const initials = profile?.displayName?.charAt(0).toUpperCase() ?? '?';

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute w-[220px] bg-[#282828] rounded-[8px] shadow-heavy z-[100]"
    >
      {/* Profile header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-muted">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-mid-dark flex items-center justify-center text-sm font-bold text-text-primary">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">{profile?.displayName}</p>
          <p className="text-xs text-text-secondary truncate">{profile?.email}</p>
        </div>
      </div>

      {/* Menu items */}
      <div className="py-1">
        <button
          role="menuitem"
          className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-white/10 transition-colors"
          onClick={() => { navigate('/profile'); onClose(); }}
        >
          Profile
        </button>
        <button
          role="menuitem"
          className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-white/10 transition-colors"
          onClick={() => { navigate('/settings/preferences'); onClose(); }}
        >
          Preferences
        </button>
        <div className="my-1 border-t border-border-muted" />
        <button
          role="menuitem"
          className="w-full text-left px-4 py-2 text-sm text-negative hover:bg-white/10 transition-colors"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
