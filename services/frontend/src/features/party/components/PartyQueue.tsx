import { useState, useRef, useEffect, useCallback } from 'react';
import { searchContent } from '../../../services/searchService';
import type { QueueItem } from '../../../types/listening-party';
import type { SearchResult } from '../../../types/domain';

interface Props {
  queueItems:      QueueItem[];
  currentUserId:   string;
  onAddSong:       (songId: string) => void;
  onRemoveSong:    (songId: string) => void;
}

export default function PartyQueue({
  queueItems,
  currentUserId,
  onAddSong,
  onRemoveSong,
}: Props) {
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchContent(query.trim(), 'song', 5);
        setResults(res.items);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleAdd = useCallback((songId: string) => {
    onAddSong(songId);
    setQuery('');
    setResults([]);
  }, [onAddSong]);

  return (
    <div className="flex flex-col h-full">

      {/* Search bar */}
      <div className="relative mb-4">
        <span
          className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px] pointer-events-none"
          aria-hidden="true"
        >
          search
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm bài để thêm..."
          aria-label="Tìm bài hát để thêm vào hàng chờ"
          className="w-full bg-near-black border border-border-muted rounded-[8px] pl-9 pr-4 py-2 text-text-base font-body text-body placeholder:text-text-secondary focus:outline-none focus:border-spotify-green transition-colors"
        />
        {isSearching && (
          <span
            className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary text-[18px] animate-spin"
            aria-hidden="true"
          >
            progress_activity
          </span>
        )}
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div
          className="mb-4 bg-near-black border border-border-muted rounded-[8px] overflow-hidden"
          aria-label="Kết quả tìm kiếm"
        >
          {results.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-mid-dark/60 group transition-colors"
            >
              {r.coverUrl ? (
                <img src={r.coverUrl} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded bg-mid-dark flex-shrink-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px] text-text-secondary" aria-hidden="true">music_note</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-body-bold text-body-bold text-text-base truncate">{r.name}</p>
                <p className="font-caption text-caption text-text-secondary truncate">{r.artist}</p>
              </div>
              <button
                onClick={() => handleAdd(r.id)}
                aria-label={`Thêm ${r.name} vào hàng chờ`}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-spotify-green"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Queue list */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-small-bold text-small-bold text-text-secondary uppercase tracking-wider">
          Hàng chờ ({queueItems.length})
        </h4>
      </div>

      {queueItems.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-secondary py-8">
          <span className="material-symbols-outlined text-[32px]" aria-hidden="true">queue_music</span>
          <p className="font-body text-body text-center">
            Hàng chờ trống
          </p>
          <p className="font-caption text-caption text-center">
            Tìm bài hát bên trên để thêm
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {queueItems.map((item, index) => (
            <QueueRow
              key={`${item.songId}-${index}`}
              item={item}
              index={index}
              isOwner={item.addedByUserId === currentUserId}
              onRemove={onRemoveSong}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-component ─────────────────────────────────────────────────────────────

interface QueueRowProps {
  item:     QueueItem;
  index:    number;
  isOwner:  boolean;
  onRemove: (songId: string) => void;
}

function QueueRow({ item, index, isOwner, onRemove }: QueueRowProps) {
  return (
    <div
      className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-mid-dark/50 group transition-colors"
      aria-label={`Bài ${index + 1} trong hàng chờ`}
    >
      {/* Position badge */}
      <span className="w-5 text-center font-caption text-caption text-text-secondary flex-shrink-0">
        {index + 1}
      </span>

      {/* Song id as placeholder — PartyRoomPage can enrich with title later */}
      <div className="flex-1 min-w-0">
        <p
          className="font-body text-body text-text-base truncate"
          title={item.songId}
          data-testid="queue-row-song-id"
        >
          {item.songId}
        </p>
      </div>

      {/* Remove button — only visible to the user who added the song */}
      {isOwner && (
        <button
          onClick={() => onRemove(item.songId)}
          aria-label="Xóa khỏi hàng chờ"
          className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-negative"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">remove_circle_outline</span>
        </button>
      )}
    </div>
  );
}
