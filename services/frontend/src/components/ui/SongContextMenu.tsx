import React, { useEffect, useRef } from 'react';

interface SongContextMenuProps {
  songId: string;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  onAddToQueue?: () => void;
  onAddToParty?: () => void;
  onGoToArtist?: () => void;
}

export default function SongContextMenu({
  isOpen,
  onClose,
  anchorRef,
  onAddToQueue,
  onAddToParty,
  onGoToArtist,
}: SongContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={menuRef}
      role="menu"
      className="absolute w-[200px] bg-[#282828] rounded-[8px] shadow-heavy border border-border-muted z-[100] py-1"
    >
      <button
        role="menuitem"
        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-white/10 transition-colors"
        onClick={onClose}
      >
        Phát ngay
      </button>
      <button
        role="menuitem"
        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-white/10 transition-colors"
        onClick={() => { onAddToQueue?.(); onClose(); }}
      >
        Thêm vào Queue
      </button>
      <button
        role="menuitem"
        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-white/10 transition-colors"
        onClick={() => { onAddToParty?.(); onClose(); }}
      >
        Thêm vào Party
      </button>
      <div className="my-1 border-t border-border-muted" />
      <button
        role="menuitem"
        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-white/10 transition-colors"
        onClick={() => { onGoToArtist?.(); onClose(); }}
      >
        Đến trang nghệ sĩ
      </button>
      <button
        role="menuitem"
        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-white/10 transition-colors"
        onClick={onClose}
      >
        Chia sẻ
      </button>
    </div>
  );
}
