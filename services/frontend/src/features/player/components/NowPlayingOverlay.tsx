import { useState } from 'react';
import type { CurrentSong } from './NowPlayingOverlay.types';

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
  const [activeTab, setActiveTab] = useState<Tab>('lyrics');
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

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
            <div className="flex flex-col gap-2 mb-8 group">
              <div className="w-full h-1 bg-border-muted rounded-full overflow-hidden relative cursor-pointer">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.5}
                  value={currentTime}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  aria-label="Tua bài hát"
                  data-testid="overlay-seekbar"
                />
                <div
                  className="absolute left-0 top-0 h-full bg-text-emphasis rounded-full group-hover:bg-spotify-green transition-colors pointer-events-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[12px] font-bold leading-[1.5] text-text-secondary">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-6 lg:gap-8 mb-10">
              <button
                aria-label="Trộn bài"
                className="text-text-secondary hover:text-text-emphasis transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">shuffle</span>
              </button>
              <button
                aria-label="Bài trước"
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
                aria-label="Bài tiếp"
                className="text-text-base hover:text-text-emphasis transition-colors"
              >
                <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  skip_next
                </span>
              </button>
              <button
                aria-label="Lặp lại"
                className="text-text-secondary hover:text-text-emphasis transition-colors"
              >
                <span className="material-symbols-outlined text-[24px]">repeat</span>
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
                  <div className="flex flex-col items-center py-8 gap-2 text-text-secondary" data-testid="tab-content-queue">
                    <span className="material-symbols-outlined text-[40px]">queue_music</span>
                    <p className="text-[14px] leading-[1.5]">Hàng chờ trống</p>
                  </div>
                )}

                {activeTab === 'related' && (
                  <div className="flex flex-col items-center py-8 gap-2 text-text-secondary" data-testid="tab-content-related">
                    <span className="material-symbols-outlined text-[40px]">library_music</span>
                    <p className="text-[14px] leading-[1.5]">Không có bài hát liên quan</p>
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
