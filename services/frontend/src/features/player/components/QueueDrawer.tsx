import { useState } from 'react';
import { usePlayerStore } from '../../../store/playerStore';

interface QueueDrawerProps {
  isOpen:  boolean;
  onClose: () => void;
}


export default function QueueDrawer({ isOpen, onClose }: QueueDrawerProps) {
  const currentSong     = usePlayerStore((s) => s.currentSong);
  const queue           = usePlayerStore((s) => s.queue) ?? [];
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const clearQueue      = usePlayerStore((s) => s.clearQueue);
  const playFromQueue   = usePlayerStore((s) => s.playFromQueue);
  const reorderQueue    = usePlayerStore((s) => s.reorderQueue);

  // Drag state — dragIndex: item being dragged, overIndex: insert-before position (0..queue.length)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function handleDragStart(index: number) {
    setDragIndex(index);
    setOverIndex(null);
  }

  function handleDragEnter(index: number) {
    setOverIndex(index);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleDrop() {
    if (dragIndex !== null && overIndex !== null && overIndex !== dragIndex && overIndex !== dragIndex + 1) {
      const to = dragIndex < overIndex ? overIndex - 1 : overIndex;
      reorderQueue(dragIndex, to);
    }
    setDragIndex(null);
    setOverIndex(null);
  }

  // Line indicator is visible when overIndex is not the same effective position as dragIndex
  function showLine(pos: number): boolean {
    if (dragIndex === null || overIndex !== pos) return false;
    return overIndex !== dragIndex && overIndex !== dragIndex + 1;
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[59]"
          onClick={onClose}
          aria-hidden="true"
          data-testid="queue-backdrop"
        />
      )}

      {/* Drawer panel */}
      <aside
        data-testid="queue-drawer"
        aria-label="Hàng chờ phát nhạc"
        className={[
          'fixed right-0 top-0 h-full w-[360px] bg-dark-surface border-l border-border-muted/30',
          'z-[60] flex flex-col transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-muted/30 flex-shrink-0">
          <h2 className="font-bold text-text-base text-base">Hàng chờ</h2>
          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="text-xs text-text-secondary hover:text-negative transition-colors"
                aria-label="Xóa tất cả"
              >
                Xóa tất cả
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Đóng hàng chờ"
              className="text-text-secondary hover:text-text-base transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Now Playing */}
          {currentSong && (
            <section className="px-3 mb-3">
              <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider px-2 mb-1">
                Đang phát
              </p>
              <div
                data-testid="now-playing-row"
                className="flex items-center gap-3 px-2 py-2 rounded-md ring-2 ring-spotify-green"
              >
                <QueueSongCover coverUrl={currentSong.coverUrl} title={currentSong.title} size={40} />
                <div className="flex-1 truncate">
                  <p className="text-sm font-semibold text-text-base truncate">{currentSong.title}</p>
                  <p className="text-xs text-text-secondary truncate">{currentSong.artist}</p>
                </div>
                <span className="material-symbols-outlined text-[16px] text-spotify-green flex-shrink-0"
                  style={{ fontVariationSettings: "'FILL' 1" }}>
                  graphic_eq
                </span>
              </div>
            </section>
          )}

          {/* Queue */}
          <section
            className="px-3"
            onDragOver={(e) => e.preventDefault()}
          >
            {queue.length > 0 && (
              <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider px-2 mb-1">
                Tiếp theo ({queue.length})
              </p>
            )}
            {queue.length === 0 && !currentSong && (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-text-secondary">
                <span className="material-symbols-outlined text-[40px]">queue_music</span>
                <p className="text-sm">Hàng chờ trống</p>
              </div>
            )}
            {queue.length === 0 && currentSong && (
              <p className="text-sm text-text-secondary px-2 py-3">Không có bài tiếp theo.</p>
            )}

            {queue.map((song, index) => (
              <div key={`${song.songId}-${index}`}>
                {/* Drop line — insert before this item */}
                {showLine(index) && (
                  <div
                    data-testid={`drop-line-${index}`}
                    className="h-0.5 bg-spotify-green mx-2 rounded-full my-0.5"
                  />
                )}
                <QueueItem
                  song={song}
                  index={index}
                  isDragging={dragIndex === index}
                  onRemove={removeFromQueue}
                  onPlay={playFromQueue}
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                />
              </div>
            ))}

            {/* Drop zone at end of list */}
            {queue.length > 0 && (
              <div
                data-testid="drop-zone-end"
                className="h-4"
                onDragEnter={() => handleDragEnter(queue.length)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {showLine(queue.length) && (
                  <div
                    data-testid={`drop-line-${queue.length}`}
                    className="h-0.5 bg-spotify-green mx-2 rounded-full mt-0.5"
                  />
                )}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

interface QueueSongCoverProps {
  coverUrl?: string;
  title:     string;
  size:      number;
}

function QueueSongCover({ coverUrl, title, size }: QueueSongCoverProps) {
  const px = `${size}px`;
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={title}
        className="rounded-[4px] object-cover flex-shrink-0 bg-mid-dark"
        style={{ width: px, height: px }}
      />
    );
  }
  return (
    <div
      className="rounded-[4px] bg-mid-dark flex items-center justify-center flex-shrink-0 text-text-secondary"
      style={{ width: px, height: px }}
    >
      <span className="material-symbols-outlined text-[16px]">music_note</span>
    </div>
  );
}

interface QueueItemProps {
  song:        ReturnType<typeof usePlayerStore.getState>['queue'][number];
  index:       number;
  isDragging:  boolean;
  onRemove:    (index: number) => void;
  onPlay:      (index: number) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd:   () => void;
  onDrop:      () => void;
}

function QueueItem({ song, index, isDragging, onRemove, onPlay, onDragStart, onDragEnter, onDragEnd, onDrop }: QueueItemProps) {
  return (
    <div
      data-testid={`queue-item-${index}`}
      role="button"
      aria-label={`Phát ${song.title}`}
      draggable
      onClick={() => onPlay(index)}
      onDragStart={onDragStart}
      onDragEnter={(e) => { e.preventDefault(); onDragEnter(); }}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className={[
        'flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/5 group transition-colors cursor-pointer',
        isDragging ? 'opacity-40' : 'opacity-100',
      ].join(' ')}
    >
      {/* Drag handle */}
      <span
        data-testid={`drag-handle-${index}`}
        className="material-symbols-outlined text-[16px] text-border-muted group-hover:text-text-secondary transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing"
      >
        drag_indicator
      </span>

      <QueueSongCover coverUrl={song.coverUrl} title={song.title} size={40} />

      <div className="flex-1 truncate">
        <p className="text-sm text-text-base truncate">{song.title}</p>
        <p className="text-xs text-text-secondary truncate">{song.artist}</p>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(index); }}
        aria-label={`Xóa ${song.title} khỏi hàng chờ`}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-negative ml-1 flex-shrink-0"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
}
