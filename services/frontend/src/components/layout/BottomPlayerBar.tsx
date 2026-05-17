import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '../../store/playerStore';
import { apiClient } from '../../services/api';
import NowPlayingOverlay from '../../features/player/components/NowPlayingOverlay';
import QueueDrawer from '../../features/player/components/QueueDrawer';

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
  const currentSong  = usePlayerStore((s) => s.currentSong);
  const clearSong    = usePlayerStore((s) => s.clearSong);
  const pauseSignal  = usePlayerStore((s) => s.pauseSignal);
  const seekSignal   = usePlayerStore((s) => s.seekSignal);
  const seekPosition = usePlayerStore((s) => s.seekPosition);

  const audioRef        = useRef<HTMLAudioElement>(null);
  const urlFetchedAtRef = useRef<number>(0);
  const expiresInRef    = useRef<number>(0);
  const analyticsSentRef = useRef(false);
  const hasStartedRef    = useRef(false);
  // Consumed once after stream URL loads — set from currentSong.autoPlay
  const autoPlayRef      = useRef(false);

  const [streamUrl,    setStreamUrl]    = useState<string | null>(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [urlError,     setUrlError]     = useState<string | null>(null);
  const [showOverlay,  setShowOverlay]  = useState(false);
  const [showQueue,    setShowQueue]    = useState(false);
  const [seekHovered,  setSeekHovered]  = useState(false);

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
      autoPlayRef.current = false;
      return;
    }
    if (!currentSong.songId) {
      clearSong();
      return;
    }
    analyticsSentRef.current = false;
    hasStartedRef.current    = false;
    autoPlayRef.current      = currentSong.autoPlay ?? false;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    fetchStreamUrl(currentSong.songId);
  }, [currentSong, fetchStreamUrl, clearSong]);

  // Auto-play once stream URL is ready (triggered by Listening Party)
  useEffect(() => {
    if (!streamUrl || !autoPlayRef.current) return;
    autoPlayRef.current = false;
    audioRef.current?.play().then(() => {
      setIsPlaying(true);
      hasStartedRef.current = true;
    }).catch(() => {
      // Browser autoplay policy blocked — user must interact first
    });
  }, [streamUrl]);

  // Pause command from external caller (e.g. Listening Party host presses pause)
  useEffect(() => {
    if (pauseSignal === 0) return;
    audioRef.current?.pause();
    setIsPlaying(false);
  }, [pauseSignal]);

  // Seek command from external caller (e.g. Listening Party host seeks)
  useEffect(() => {
    if (seekSignal === 0 || !audioRef.current) return;
    audioRef.current.currentTime = seekPosition;
    setCurrentTime(seekPosition);
  }, [seekSignal, seekPosition]);

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

  const sendPlayAnalytics = useCallback(async (songId: string, durationSec: number, listenedSec: number) => {
    if (analyticsSentRef.current) return;
    analyticsSentRef.current = true;
    try {
      await apiClient.post(
        '/api/v1/analytics/events/play',
        {
          songId,
          durationSec: Math.max(1, Math.round(durationSec)),
          listenedSec: Math.round(listenedSec),
          platform: 'web',
        },
        { headers: { 'Idempotency-Key': `${songId}-${Date.now()}` } },
      );
    } catch {
      // analytics is best-effort
    }
  }, []);

  const handlePlay = () => {
    audioRef.current?.play();
    setIsPlaying(true);
    hasStartedRef.current = true;
    // If duration already loaded (metadata arrived before play), send now
    if (currentSong && duration > 0) {
      sendPlayAnalytics(currentSong.songId, duration, currentTime);
    }
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
      {showQueue && <QueueDrawer isOpen={showQueue} onClose={() => setShowQueue(false)} />}

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
        className="fixed bottom-14 lg:bottom-0 left-0 w-full h-[72px] bg-dark-surface border-t border-border-muted z-50 flex items-center justify-between px-md shadow-footer"
      >
        {/* Hidden audio element */}
        {streamUrl && (
          <audio
            ref={audioRef}
            src={streamUrl}
            preload="metadata"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onDurationChange={(e) => {
              const d = e.currentTarget.duration;
              setDuration(d);
              // Send analytics once we have real duration and user has already pressed play
              if (hasStartedRef.current && currentSong) {
                sendPlayAnalytics(currentSong.songId, d, audioRef.current?.currentTime ?? 0);
              }
            }}
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
              className="w-14 h-14 rounded-[6px] bg-mid-dark object-cover flex-shrink-0 group-hover:opacity-90 transition-opacity"
            />
          ) : (
            <div className="w-14 h-14 rounded-[6px] bg-mid-dark flex-shrink-0 flex items-center justify-center text-text-secondary">
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
              className="text-text-secondary hover:text-text-base transition-colors"
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
              className="w-8 h-8 rounded-full bg-spotify-green flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[20px] text-near-black" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isPlaying ? 'pause' : 'play_arrow'}
                </span>
              )}
            </button>

            <button
              className="text-text-secondary hover:text-text-base transition-colors"
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
            {/* Outer wrapper: py-2 expands hover/click area without changing visual height */}
            <div
              className="relative flex-1 py-2 cursor-pointer"
              onMouseEnter={() => setSeekHovered(true)}
              onMouseLeave={() => setSeekHovered(false)}
            >
              {/* Visual track — rendered before input so input doesn't obscure it */}
              <div className="relative z-10 pointer-events-none h-1 w-full bg-border-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-spotify-green rounded-full"
                  style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
                />
              </div>
              {/* Thumb — centered on track, visible on hover */}
              <div
                className={`absolute z-10 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow transition-opacity pointer-events-none ${seekHovered ? 'opacity-100' : 'opacity-0'}`}
                style={{ left: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
              {/* Invisible input — on top for drag events, appearance-none removes native browser track */}
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.5}
                value={currentTime}
                onChange={handleSeekInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
                aria-label="Seek"
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
            className="hover:text-text-base transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_full</span>
          </button>

          <button
            onClick={() => setShowQueue(true)}
            className="hover:text-text-base transition-colors"
            aria-label="Hàng chờ"
            data-testid="open-queue-btn"
          >
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
            className="hover:text-text-base transition-colors ml-1"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </footer>
    </>
  );
}
