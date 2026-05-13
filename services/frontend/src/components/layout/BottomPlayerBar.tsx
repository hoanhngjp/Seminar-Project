import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { apiClient } from '../../services/api';
import NowPlayingOverlay from '../../features/player/components/NowPlayingOverlay';

interface StreamingUrlData {
  url:       string;
  expiresIn: number;
}

const REFETCH_BEFORE_EXPIRY_SEC = 60;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function BottomPlayerBar() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const clearSong   = usePlayerStore((s) => s.clearSong);

  const audioRef        = useRef<HTMLAudioElement>(null);
  const urlFetchedAtRef = useRef<number>(0);
  const expiresInRef    = useRef<number>(0);
  const analyticsSentRef = useRef(false);

  const [streamUrl,    setStreamUrl]    = useState<string | null>(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [urlError,     setUrlError]     = useState<string | null>(null);
  const [showOverlay,  setShowOverlay]  = useState(false);

  const fetchStreamUrl = useCallback(async (songId: string) => {
    setUrlError(null);
    setLoading(true);
    try {
      const res = await apiClient.get<{ success: boolean; data: StreamingUrlData }>(
        `/api/v1/streaming/${songId}/url`,
      );
      setStreamUrl(res.data.data.url);
      urlFetchedAtRef.current = Date.now() / 1000;
      expiresInRef.current    = res.data.data.expiresIn;
    } catch {
      setUrlError('Không thể tải bài hát.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset and fetch when song changes
  useEffect(() => {
    if (!currentSong) {
      setStreamUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setShowOverlay(false);
      return;
    }
    analyticsSentRef.current = false;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    fetchStreamUrl(currentSong.songId);
  }, [currentSong, fetchStreamUrl]);

  // Proactive URL refresh
  useEffect(() => {
    if (!isPlaying || !currentSong) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() / 1000 - urlFetchedAtRef.current;
      if (expiresInRef.current - elapsed < REFETCH_BEFORE_EXPIRY_SEC) {
        fetchStreamUrl(currentSong.songId);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [isPlaying, currentSong, fetchStreamUrl]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const sendPlayAnalytics = useCallback(async (songId: string) => {
    if (analyticsSentRef.current) return;
    analyticsSentRef.current = true;
    try {
      await apiClient.post(
        '/api/v1/analytics/events/play',
        { songId, durationPercent: 0 },
        { headers: { 'Idempotency-Key': `${songId}-${Date.now()}` } },
      );
    } catch {
      // analytics is best-effort
    }
  }, []);

  const handlePlay = () => {
    audioRef.current?.play();
    setIsPlaying(true);
    if (currentSong) sendPlayAnalytics(currentSong.songId);
  };

  const handlePause  = () => { audioRef.current?.pause(); setIsPlaying(false); };
  const handleToggle = () => (isPlaying ? handlePause() : handlePlay());

  const handleSeek = useCallback((t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  }, []);

  const handleSeekInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSeek(Number(e.target.value));
  };

  if (!currentSong) return null;

  return (
    <>
      {/* NowPlayingOverlay — fullscreen */}
      {showOverlay && (
        <NowPlayingOverlay
          currentSong={currentSong}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          loading={loading}
          onTogglePlay={handleToggle}
          onSeek={handleSeek}
          onClose={() => setShowOverlay(false)}
        />
      )}

      <footer
        data-testid="bottom-player-bar"
        className="fixed bottom-0 left-0 w-full h-[72px] bg-dark-surface border-t border-border-muted z-50 flex items-center justify-between px-md shadow-[0_-4px_12px_rgba(0,0,0,0.5)]"
      >
        {/* Hidden audio element */}
        {streamUrl && (
          <audio
            ref={audioRef}
            src={streamUrl}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onDurationChange={(e) => setDuration(e.currentTarget.duration)}
            onEnded={() => setIsPlaying(false)}
            onError={() => fetchStreamUrl(currentSong.songId)}
          />
        )}

        {/* ── Left: Song info — click to open overlay ── */}
        <div
          className="flex items-center gap-3 w-[30%] min-w-[160px] cursor-pointer group"
          onClick={() => setShowOverlay(true)}
          data-testid="player-song-info"
          role="button"
          aria-label="Mở Now Playing"
        >
          {currentSong.coverUrl ? (
            <img
              src={currentSong.coverUrl}
              alt={currentSong.title}
              className="w-14 h-14 rounded bg-mid-dark object-cover flex-shrink-0 group-hover:opacity-90 transition-opacity"
            />
          ) : (
            <div className="w-14 h-14 rounded bg-mid-dark flex-shrink-0 flex items-center justify-center text-text-secondary">
              <span className="material-symbols-outlined text-[20px]">music_note</span>
            </div>
          )}
          <div className="flex flex-col truncate">
            <span className="font-bold text-sm text-text-base truncate group-hover:text-spotify-green transition-colors">
              {currentSong.title}
            </span>
            <span className="text-xs text-text-secondary truncate">{currentSong.artist}</span>
          </div>
        </div>

        {/* ── Center: Playback controls ── */}
        <div className="flex flex-col items-center max-w-[40%] w-full gap-1">
          <div className="flex items-center gap-4">
            <button
              className="text-text-secondary hover:text-white transition-colors"
              aria-label="Bài trước"
            >
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                skip_previous
              </span>
            </button>

            <button
              onClick={handleToggle}
              disabled={loading}
              aria-label={isPlaying ? 'Dừng' : 'Phát'}
              className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-white hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isPlaying ? 'pause' : 'play_arrow'}
                </span>
              )}
            </button>

            <button
              className="text-text-secondary hover:text-white transition-colors"
              aria-label="Bài tiếp"
            >
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                skip_next
              </span>
            </button>
          </div>

          {/* Seek bar */}
          <div className="flex items-center gap-2 w-full max-w-md">
            <span className="text-[10px] text-text-secondary w-7 text-right tabular-nums">
              {formatTime(currentTime)}
            </span>
            <div className="h-1 flex-1 bg-border-muted rounded-full overflow-hidden group cursor-pointer relative">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.5}
                value={currentTime}
                onChange={handleSeekInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                aria-label="Seek"
              />
              <div
                className="h-full bg-white group-hover:bg-spotify-green rounded-full transition-colors pointer-events-none"
                style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-[10px] text-text-secondary w-7 tabular-nums">
              {formatTime(duration)}
            </span>
          </div>

          {urlError && (
            <span className="text-negative text-[10px]">{urlError}</span>
          )}
        </div>

        {/* ── Right: Volume + expand + close ── */}
        <div className="flex items-center justify-end gap-3 w-[30%] min-w-[160px] text-text-secondary">
          {/* Expand to fullscreen overlay */}
          <button
            onClick={() => setShowOverlay(true)}
            aria-label="Mở Now Playing"
            data-testid="open-overlay-btn"
            className="hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_full</span>
          </button>

          <button className="hover:text-white transition-colors" aria-label="Hàng chờ">
            <span className="material-symbols-outlined text-[18px]">queue_music</span>
          </button>

          <div className="flex items-center gap-2 w-20 group">
            <span className="material-symbols-outlined text-[18px]">volume_up</span>
            <div className="h-1 flex-1 bg-border-muted rounded-full relative overflow-hidden cursor-pointer">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                aria-label="Volume"
              />
              <div
                className="h-full bg-white group-hover:bg-spotify-green rounded-full pointer-events-none"
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          </div>

          <button
            onClick={clearSong}
            aria-label="Đóng player"
            className="hover:text-white transition-colors ml-1"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </footer>
    </>
  );
}
