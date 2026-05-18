import { useState, useRef, useCallback, useEffect } from 'react';
import type { CurrentSong } from './NowPlayingOverlay.types';
import { usePlayerStore } from '../../../store/playerStore';
import { searchContent } from '../../../services/searchService';
import type { SearchResult } from '../../../types/domain';

// Mock lyrics for demo (no lyrics API in scope)
const MOCK_LYRICS = [
  { active: false, text: 'Tôi đã thấy những ngôi sao' },
  { active: false, text: 'Sáng lên trong mắt em' },
  { active: true,  text: 'Và chuyến xe này sẽ đi về đâu' },
  { active: true,  text: 'Khi mà hai ta không còn chung lối' },
  { active: false, text: 'Chỉ còn những kỉ niệm' },
  { active: false, text: 'Rơi rớt dọc đường đi' },
  { active: false, text: 'Xin lỗi em vì những ngày qua' },
  { active: false, text: 'Không thể nào giữ lại' },
];

type Tab = 'lyrics' | 'queue' | 'related';

interface NowPlayingOverlayProps {
  currentSong: CurrentSong;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loading: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onClose: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function NowPlayingOverlay({
  currentSong,
  isPlaying,
  currentTime,
  duration,
  loading,
  onTogglePlay,
  onSeek,
  onClose,
}: NowPlayingOverlayProps) {
  const queue           = usePlayerStore((s) => s.queue);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const playSong        = usePlayerStore((s) => s.playSong);
  const playFromQueue   = usePlayerStore((s) => s.playFromQueue);
  const playNext        = usePlayerStore((s) => s.playNext);
  const playPrev        = usePlayerStore((s) => s.playPrev);
  const shuffle         = usePlayerStore((s) => s.shuffle);
  const repeat          = usePlayerStore((s) => s.repeat);
  const toggleShuffle   = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeat    = usePlayerStore((s) => s.toggleRepeat);

  const [activeTab, setActiveTab] = useState<Tab>('lyrics');
  const [relatedSongs,   setRelatedSongs]   = useState<SearchResult[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [seekHovered,  setSeekHovered]  = useState(false);
  const [hoverPercent, setHoverPercent] = useState(0);
  const [hoverTime,    setHoverTime]    = useState(0);
  const [isDragging,   setIsDragging]   = useState(false);
  const [dragValue,    setDragValue]    = useState(0);
  const seekBarRef = useRef<HTMLDivElement>(null);

  // Fetch related songs when related tab is active
  useEffect(() => {
    if (activeTab !== 'related' || !currentSong.artist) return;
    let cancelled = false;
    setRelatedLoading(true);
    setRelatedSongs([]);
    searchContent(currentSong.artist, 'song', 20)
      .then((res) => {
        if (cancelled) return;
        setRelatedSongs(res.items.filter((s) => s.id !== currentSong.songId));
      })
      .catch(() => { if (!cancelled) setRelatedSongs([]); })
      .finally(() => { if (!cancelled) setRelatedLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, currentSong.songId, currentSong.artist]);

  // During drag use local dragValue for instant visual feedback; otherwise use prop
  const displayTime = isDragging ? dragValue : currentTime;
  const progress    = duration > 0 ? (displayTime / duration) * 100 : 0;

  const handleSeekBarMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!seekBarRef.current || duration <= 0) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const pct  = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverPercent(pct * 100);
    setHoverTime(pct * duration);
  }, [duration]);

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setDragValue(val);
    setIsDragging(true);
    onSeek(val);
  }, [onSeek]);

  const handleSeekCommit = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] bg-near-black flex flex-col antialiased overflow-hidden"
      data-testid="now-playing-overlay"
      role="dialog"
      aria-label="Now Playing"
    >
      {/* Close button */}
      <div className="absolute top-8 left-8 z-50">
        <button
          onClick={onClose}
          aria-label="Đóng"
          data-testid="overlay-close-btn"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-near-black/50 hover:bg-mid-dark transition-colors group"
        >
          <span className="material-symbols-outlined text-text-secondary group-hover:text-text-emphasis transition-colors text-[24px]">
            keyboard_arrow_down
          </span>
        </button>
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-8 h-full w-full max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row w-full h-full gap-8 lg:gap-16 items-center lg:items-stretch py-12 lg:py-24">

          {/* Left: Album art */}
          <div className="flex-1 flex items-center justify-center lg:justify-end shrink-0 w-full lg:w-1/2">
            <div
              className="relative w-full max-w-[320px] aspect-square rounded-[8px] shadow-glow-green"
            >
              {currentSong.coverUrl ? (
                <img
                  src={currentSong.coverUrl}
                  alt={currentSong.title}
                  className="w-full h-full object-cover rounded-[8px] shadow-2xl z-10 relative"
                />
              ) : (
                <div className="w-full h-full rounded-[8px] bg-mid-dark flex items-center justify-center shadow-2xl z-10 relative">
                  <span className="material-symbols-outlined text-[80px] text-text-secondary">music_note</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex-1 flex flex-col justify-center max-w-[480px] w-full lg:w-1/2">

            {/* Context tag */}
            <div className="inline-flex items-center gap-2 bg-mid-dark rounded-full px-3 py-1 w-max mb-4 border border-border-muted/30">
              <span className="text-[14px] leading-[1.5] text-text-secondary">
                ☀️ Đang phát
              </span>
            </div>

            {/* Song info + actions */}
            <div className="flex items-start justify-between gap-4 mb-8">
              <div className="flex flex-col min-w-0">
                <h1 className="text-[32px] font-bold leading-tight text-text-emphasis tracking-tight mb-1 truncate">
                  {currentSong.title}
                </h1>
                <span className="text-[18px] font-[600] leading-[1.3] text-text-secondary hover:text-text-base cursor-pointer hover:underline transition-colors w-max">
                  {currentSong.artist}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2 shrink-0">
                <button
                  aria-label="Thích"
                  className="text-text-secondary hover:text-spotify-green transition-colors flex items-center justify-center w-10 h-10"
                >
                  <span className="material-symbols-outlined text-[24px]">favorite</span>
                </button>
                <button
                  aria-label="Thêm tùy chọn"
                  className="text-text-secondary hover:text-text-emphasis transition-colors flex items-center justify-center w-10 h-10"
                >
                  <span className="material-symbols-outlined text-[24px]">more_horiz</span>
                </button>
              </div>
            </div>

            {/* Seek bar */}
            <div className="flex flex-col gap-2 mb-8">
              {/* Track + thumb + tooltip */}
              <div
                ref={seekBarRef}
                className="relative w-full cursor-pointer"
                style={{ height: seekHovered ? '20px' : '16px', transition: 'height 0.15s' }}
                onMouseEnter={() => setSeekHovered(true)}
                onMouseLeave={() => setSeekHovered(false)}
                onMouseMove={handleSeekBarMouseMove}
              >
                {/* Tooltip time preview */}
                {seekHovered && duration > 0 && (
                  <div
                    className="absolute -top-7 z-20 pointer-events-none"
                    style={{
                      left: `${hoverPercent}%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <span className="bg-mid-dark text-text-emphasis text-[11px] font-bold px-1.5 py-0.5 rounded shadow-level-2 whitespace-nowrap">
                      {formatTime(hoverTime)}
                    </span>
                  </div>
                )}

                {/* Visual track */}
                <div
                  className="absolute left-0 right-0 rounded-full bg-border-muted overflow-hidden pointer-events-none"
                  style={{
                    top: '50%',
                    transform: 'translateY(-50%)',
                    height: seekHovered ? '5px' : '3px',
                    transition: 'height 0.15s',
                  }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: seekHovered ? '#1db954' : '#e0e0e0',
                      transition: isDragging ? 'none' : 'width 0.1s linear, background-color 0.15s',
                    }}
                  />
                </div>

                {/* Thumb circle — visible when hovered */}
                {seekHovered && (
                  <div
                    className="absolute z-10 pointer-events-none"
                    style={{
                      left: `${progress}%`,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                    }}
                  />
                )}

                {/* Transparent input on top — captures drag */}
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.5}
                  value={displayTime}
                  onChange={handleSeekChange}
                  onPointerUp={handleSeekCommit}
                  onMouseUp={handleSeekCommit}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 appearance-none"
                  aria-label="Tua bài hát"
                  data-testid="overlay-seekbar"
                />
              </div>

              {/* Time labels */}
              <div className="flex justify-between items-center text-[12px] font-bold leading-[1.5] text-text-secondary">
                <span>{formatTime(displayTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-6 lg:gap-8 mb-10">
              <button
                onClick={toggleShuffle}
                aria-label="Trộn bài"
                aria-pressed={shuffle}
                data-testid="overlay-shuffle-btn"
                className={`transition-colors relative ${shuffle ? 'text-spotify-green' : 'text-text-secondary hover:text-text-emphasis'}`}
              >
                <span className="material-symbols-outlined text-[24px]">shuffle</span>
                {shuffle && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-spotify-green" />
                )}
              </button>
              <button
                onClick={playPrev}
                aria-label="Bài trước"
                data-testid="overlay-prev-btn"
                className="text-text-base hover:text-text-emphasis transition-colors"
              >
                <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  skip_previous
                </span>
              </button>
              <button
                onClick={onTogglePlay}
                disabled={loading}
                aria-label={isPlaying ? 'Dừng' : 'Phát'}
                data-testid="overlay-play-btn"
                className="w-14 h-14 rounded-full flex items-center justify-center text-text-secondary hover:text-text-base hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span className="material-symbols-outlined text-[24px] animate-spin">
                    progress_activity
                  </span>
                ) : (
                  <span
                    className="material-symbols-outlined text-[28px] ml-[2px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                )}
              </button>
              <button
                onClick={playNext}
                aria-label="Bài tiếp"
                data-testid="overlay-next-btn"
                className="text-text-base hover:text-text-emphasis transition-colors"
              >
                <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  skip_next
                </span>
              </button>
              <button
                onClick={toggleRepeat}
                aria-label="Lặp lại"
                aria-pressed={repeat !== 'none'}
                data-testid="overlay-repeat-btn"
                className={`transition-colors relative ${repeat !== 'none' ? 'text-spotify-green' : 'text-text-secondary hover:text-text-emphasis'}`}
              >
                <span className="material-symbols-outlined text-[24px]">
                  {repeat === 'one' ? 'repeat_one' : 'repeat'}
                </span>
                {repeat !== 'none' && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-spotify-green" />
                )}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-col flex-1 min-h-[200px] border-t border-border-muted/30 pt-4">
              {/* Tab headers */}
              <div className="flex items-center gap-6 mb-4" role="tablist">
                {(
                  [
                    { id: 'lyrics',  label: 'Lời bài hát' },
                    { id: 'queue',   label: 'Hàng chờ'    },
                    { id: 'related', label: 'Liên quan'    },
                  ] as { id: Tab; label: string }[]
                ).map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={activeTab === t.id}
                    onClick={() => setActiveTab(t.id)}
                    data-testid={`tab-${t.id}`}
                    className={`pb-1 border-b-2 transition-colors text-[16px] leading-[1.5] ${
                      activeTab === t.id
                        ? 'font-bold text-text-emphasis border-spotify-green'
                        : 'font-normal text-text-secondary hover:text-text-base border-transparent'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div
                className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex flex-col gap-4 pr-2"
                style={{ maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)' }}
              >
                {activeTab === 'lyrics' && (
                  <div className="flex flex-col gap-4" data-testid="tab-content-lyrics">
                    {MOCK_LYRICS.map((line, i) => (
                      <p
                        key={i}
                        className={
                          line.active
                            ? 'text-[18px] font-[600] leading-[1.3] text-text-emphasis tracking-tight'
                            : 'text-[14px] leading-[1.5] text-text-secondary opacity-70'
                        }
                      >
                        {line.text}
                      </p>
                    ))}
                  </div>
                )}

                {activeTab === 'queue' && (
                  <div data-testid="tab-content-queue" className="flex flex-col gap-1">
                    {queue.length === 0 ? (
                      <div className="flex flex-col items-center py-8 gap-2 text-text-secondary">
                        <span className="material-symbols-outlined text-[40px]">queue_music</span>
                        <p className="text-[14px] leading-[1.5]">Hàng chờ trống</p>
                      </div>
                    ) : (
                      queue.map((song, idx) => (
                        <div
                          key={`${song.songId}-${idx}`}
                          className="flex items-center gap-3 px-2 py-2 rounded-[6px] hover:bg-mid-dark group transition-colors cursor-pointer"
                          data-testid={`queue-item-${idx}`}
                          onClick={() => playFromQueue(idx)}
                          role="button"
                          aria-label={`Phát ${song.title}`}
                        >
                          {song.coverUrl ? (
                            <img
                              src={song.coverUrl}
                              alt={song.title}
                              className="w-10 h-10 rounded-[4px] object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-[4px] bg-mid-dark flex-shrink-0 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[18px] text-text-secondary">music_note</span>
                            </div>
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[14px] font-[600] leading-[1.3] text-text-emphasis truncate">{song.title}</span>
                            <span className="text-[12px] leading-[1.5] text-text-secondary truncate">{song.artist}</span>
                          </div>
                          <button
                            aria-label={`Xóa ${song.title} khỏi hàng chờ`}
                            data-testid={`queue-remove-${idx}`}
                            onClick={(e) => { e.stopPropagation(); removeFromQueue(idx); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary hover:text-negative flex items-center justify-center w-8 h-8 flex-shrink-0"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'related' && (
                  <div data-testid="tab-content-related" className="flex flex-col gap-1">
                    {relatedLoading ? (
                      <div className="flex flex-col items-center py-8 gap-2 text-text-secondary" data-testid="related-loading">
                        <span className="material-symbols-outlined text-[32px] animate-spin">progress_activity</span>
                      </div>
                    ) : relatedSongs.length === 0 ? (
                      <div className="flex flex-col items-center py-8 gap-2 text-text-secondary">
                        <span className="material-symbols-outlined text-[40px]">library_music</span>
                        <p className="text-[14px] leading-[1.5]">Không có bài hát liên quan</p>
                      </div>
                    ) : (
                      relatedSongs.map((song) => (
                        <button
                          key={song.id}
                          data-testid={`related-item-${song.id}`}
                          onClick={() => playSong({ songId: song.id, title: song.name, artist: song.artist ?? '', coverUrl: song.coverUrl })}
                          className="flex items-center gap-3 px-2 py-2 rounded-[6px] hover:bg-mid-dark group transition-colors text-left w-full"
                        >
                          {song.coverUrl ? (
                            <img
                              src={song.coverUrl}
                              alt={song.name}
                              className="w-10 h-10 rounded-[4px] object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-[4px] bg-mid-dark flex-shrink-0 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[18px] text-text-secondary">music_note</span>
                            </div>
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[14px] font-[600] leading-[1.3] text-text-emphasis truncate">{song.name}</span>
                            <span className="text-[12px] leading-[1.5] text-text-secondary truncate">{song.artist}</span>
                          </div>
                          {song.duration != null && song.duration > 0 && (
                            <span className="text-[12px] text-text-secondary flex-shrink-0 tabular-nums">
                              {formatTime(song.duration)}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
