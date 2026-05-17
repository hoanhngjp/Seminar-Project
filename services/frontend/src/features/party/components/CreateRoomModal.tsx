import { useState, useEffect, useRef, useCallback } from 'react';
import { createParty } from '../../../services/partyService';
import { fetchRecommendations } from '../../../services/recommendationService';
import { searchContent } from '../../../services/searchService';
import { getTimeContext } from '../../../utils/time';
import type { Party } from '../../../types/domain';

interface SongOption {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
}

interface Props {
  onClose: () => void;
  onCreated: (party: Party) => void;
  onSwitchToJoin?: () => void;
}

export default function CreateRoomModal({ onClose, onCreated, onSwitchToJoin }: Props) {
  const [roomName, setRoomName]         = useState('');
  const [songQuery, setSongQuery]       = useState('');
  const [selectedSong, setSelectedSong] = useState<SongOption | null>(null);
  const [songList, setSongList]         = useState<SongOption[]>([]);
  const [songLoading, setSongLoading]   = useState(false);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [nextCursor, setNextCursor]     = useState<string | null>(null);
  const [hasMore, setHasMore]           = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load recommendations (default) OR debounced search when query changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!songQuery.trim()) {
      setIsSearchMode(false);
      setNextCursor(null);
      setHasMore(false);
      setSongLoading(true);
      fetchRecommendations(getTimeContext(), 4)
        .then((items) =>
          setSongList(items.map((s) => ({ id: s.id, title: s.title, artist: s.artist, coverUrl: s.coverUrl ?? '' })))
        )
        .catch(() => setSongList([]))
        .finally(() => setSongLoading(false));
      return;
    }

    debounceRef.current = setTimeout(() => {
      setIsSearchMode(true);
      setSongList([]);
      setNextCursor(null);
      setHasMore(false);
      setSongLoading(true);
      searchContent(songQuery.trim(), 'song', 10)
        .then((res) => {
          setSongList(res.items.map((s) => ({ id: s.id, title: s.name, artist: s.artist ?? '', coverUrl: s.coverUrl ?? '' })));
          setNextCursor(res.nextCursor);
          setHasMore(res.hasMore);
        })
        .catch(() => setSongList([]))
        .finally(() => setSongLoading(false));
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [songQuery]);

  // Load next page of search results
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !nextCursor || !songQuery.trim()) return;
    setLoadingMore(true);
    try {
      const res = await searchContent(songQuery.trim(), 'song', 10, nextCursor);
      setSongList((prev) => [
        ...prev,
        ...res.items.map((s) => ({ id: s.id, title: s.name, artist: s.artist ?? '', coverUrl: s.coverUrl ?? '' })),
      ]);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch {
      // silent — already showing results
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextCursor, songQuery]);

  // IntersectionObserver on sentinel div (search mode only)
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !isSearchMode) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isSearchMode, loadMore]);

  const handleCreate = async () => {
    if (!roomName.trim()) {
      setError('Vui lòng nhập tên phòng');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const party = await createParty({
        name: roomName.trim(),
        songId: selectedSong?.id,
      });
      onCreated(party);
    } catch {
      setError('Không thể tạo phòng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Overlay */
    <div
      className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm flex items-center justify-center p-md"
      role="dialog"
      aria-modal="true"
      aria-label="Tạo phòng nghe nhạc"
    >
      {/* Modal container */}
      <div className="w-full max-w-[480px] bg-dark-surface rounded-[8px] shadow-level-3 flex flex-col relative overflow-hidden z-50">

        {/* Header */}
        <div className="flex items-center justify-between p-lg pb-md border-b border-border-muted/30">
          <h2 className="font-section-title text-[20px] font-bold text-text-emphasis m-0">
            🎉 Tạo phòng nghe nhạc
          </h2>
          <button
            aria-label="Đóng"
            onClick={onClose}
            className="text-text-secondary hover:text-text-emphasis transition-colors p-sm rounded-full hover:bg-mid-dark"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
              close
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-lg flex flex-col gap-lg">
          {/* Room name */}
          <div className="flex flex-col gap-sm">
            <label className="font-nav-link text-nav-link text-text-emphasis">Tên phòng</label>
            <input
              type="text"
              placeholder="Nhập tên phòng..."
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="w-full h-12 bg-mid-dark rounded-full px-lg text-text-base placeholder-text-secondary border-none focus:ring-1 focus:ring-border-pill shadow-input-inset outline-none font-body-regular text-body-regular transition-all"
              aria-label="Tên phòng"
            />
          </div>

          {/* Song search */}
          <div className="flex flex-col gap-sm">
            <label className="font-nav-link text-nav-link text-text-emphasis">Bài hát đầu tiên</label>
            <div className="relative">
              <span
                className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-text-secondary"
                aria-hidden="true"
              >
                search
              </span>
              <input
                type="text"
                placeholder="Tìm bài hát…"
                value={selectedSong ? `${selectedSong.title} — ${selectedSong.artist}` : songQuery}
                onChange={(e) => {
                  setSelectedSong(null);
                  setSongQuery(e.target.value);
                }}
                onFocus={() => { if (selectedSong) { setSelectedSong(null); setSongQuery(''); } }}
                className="w-full h-12 bg-mid-dark rounded-full pl-[48px] pr-lg text-text-base placeholder-text-secondary border-none focus:ring-1 focus:ring-border-pill shadow-input-inset outline-none font-body-regular text-body-regular transition-all"
                aria-label="Tìm bài hát"
              />
            </div>

            {/* Song list */}
            {!selectedSong && (
              <div
                className={`flex flex-col gap-xs bg-mid-dark rounded-[8px] p-xs${isSearchMode ? ' max-h-[240px] overflow-y-auto' : ''}`}
                role="listbox"
                aria-label="Kết quả tìm kiếm"
              >
                {songLoading ? (
                  <div className="flex items-center justify-center py-md">
                    <span className="material-symbols-outlined animate-spin text-text-secondary">refresh</span>
                  </div>
                ) : songList.length === 0 ? (
                  <p className="text-center font-caption text-caption text-text-secondary py-md">Không tìm thấy bài hát</p>
                ) : (
                  <>
                    {songList.map((song, idx) => (
                      <button
                        key={song.id}
                        role="option"
                        aria-selected={false}
                        onClick={() => setSelectedSong(song)}
                        className="flex items-center gap-md p-sm rounded-[4px] hover:bg-mid-card transition-colors w-full text-left group"
                      >
                        <span className="font-micro text-micro text-text-secondary w-4 text-center">
                          {idx + 1}
                        </span>
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-10 h-10 rounded-[4px] object-cover"
                        />
                        <div className="flex flex-col flex-grow overflow-hidden">
                          <span className="font-body-regular text-body-regular text-text-base truncate group-hover:text-spotify-green transition-colors">
                            {song.title}
                          </span>
                          <span className="font-caption text-caption text-text-secondary truncate">
                            {song.artist}
                          </span>
                        </div>
                      </button>
                    ))}

                    {/* Sentinel — triggers loadMore when scrolled into view */}
                    {isSearchMode && (
                      <div ref={sentinelRef} className="flex items-center justify-center py-xs">
                        {loadingMore && (
                          <span className="material-symbols-outlined animate-spin text-text-secondary text-[18px]">refresh</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-negative font-caption text-caption" role="alert">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-md p-lg pt-sm">
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full h-12 bg-spotify-green text-near-black rounded-full font-button-uppercase text-button-uppercase hover:brightness-110 transition-all flex items-center justify-center tracking-[1.4px] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
            ) : (
              'TẠO PHÒNG'
            )}
          </button>
          {onSwitchToJoin && (
            <button
              onClick={onSwitchToJoin}
              className="w-full h-12 border border-border-muted/50 text-text-emphasis hover:border-spotify-green rounded-full font-button-uppercase text-button-uppercase transition-colors flex items-center justify-center tracking-[1.4px]"
            >
              THAM GIA PHÒNG
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full text-center text-text-secondary hover:text-text-emphasis font-body-bold text-body-bold transition-colors py-sm"
          >
            Hủy
          </button>
        </div>

      </div>
    </div>
  );
}
