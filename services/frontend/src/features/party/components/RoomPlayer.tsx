import { useState, useCallback } from 'react';
import type { Song } from '../../../types/domain';
import HostControls from './HostControls';

interface Props {
  song: Song | null;
  isPlaying: boolean;
  positionSec: number;
  isHost: boolean;
  /** Actual audio duration from BottomPlayerBar — overrides potentially-wrong DB metadata */
  audioDuration?: number;
  onPlay:  () => void;
  onPause: () => void;
  onNext:  () => void;
  onPrev:  () => void;
  onSeek?: (sec: number) => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RoomPlayer({
  song,
  isPlaying,
  positionSec,
  isHost,
  audioDuration,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
}: Props) {
  const [isDragging, setIsDragging]     = useState(false);
  const [dragValue,  setDragValue]      = useState(0);
  const [seekHovered, setSeekHovered]   = useState(false);
  const [hoverPercent, setHoverPercent] = useState(0);
  const [hoverTime,    setHoverTime]    = useState(0);

  // During drag show dragValue instantly; otherwise follow server positionSec
  const displaySec = isDragging ? dragValue : positionSec;
  // Use actual audio duration when available — DB metadata can be wrong
  const effectiveDuration = (audioDuration && audioDuration > 0) ? audioDuration : (song?.duration ?? 0);

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setDragValue(val);
    setIsDragging(true);
    onSeek?.(val);
  }, [onSeek]);

  const handleSeekCommit = useCallback(() => setIsDragging(false), []);

  const handleTrackMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>, dur: number) => {
    if (dur <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHoverPercent(pct * 100);
    setHoverTime(pct * dur);
  }, []);

  if (!song) {
    return (
      <div className="flex flex-col items-center text-center w-full py-16">
        <div className="w-[280px] h-[280px] rounded-[8px] bg-mid-dark animate-pulse mb-8" />
        <div className="h-6 w-48 bg-mid-dark rounded animate-pulse mb-2" />
        <div className="h-4 w-32 bg-mid-dark rounded animate-pulse" />
      </div>
    );
  }

  const progress = effectiveDuration > 0 ? (displaySec / effectiveDuration) * 100 : 0;

  return (
    <div className="flex flex-col items-center text-center w-full">

      {/* Album art with glow */}
      <div className="relative group cursor-pointer mb-8">
        <div className="absolute -inset-4 bg-spotify-green/20 blur-2xl rounded-full opacity-70 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        <img
          src={song.coverUrl ?? `https://picsum.photos/seed/${song.id}/280/280`}
          alt={`Ảnh bìa ${song.title}`}
          className="w-[280px] h-[280px] object-cover rounded-[8px] shadow-level-3 relative z-10 transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </div>

      {/* Song info */}
      <div className="mb-2">
        <h3 className="text-[24px] font-bold text-text-emphasis leading-tight mb-1">
          {song.title}
        </h3>
        <p className="text-[16px] text-text-secondary font-body-regular">{song.artist}</p>
      </div>

      {/* Sync / Live indicator */}
      {isHost ? (
        <div className="flex items-center gap-2 text-spotify-green font-small-bold text-small-bold mb-8 bg-spotify-green/10 px-3 py-1.5 rounded-full">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">broadcast_on_personal</span>
          Đang phát trực tiếp
        </div>
      ) : (
        <div className="flex items-center gap-2 text-spotify-green font-small-bold text-small-bold mb-8 bg-spotify-green/10 px-3 py-1.5 rounded-full">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">sync</span>
          🔄 Đồng bộ với Host
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full mb-8 relative" aria-label="Thanh tiến trình bài hát">
        <div className="flex justify-between text-text-secondary font-micro text-micro mb-2">
          <span>{formatTime(displaySec)}</span>
          <span>{formatTime(effectiveDuration)}</span>
        </div>

        {isHost && onSeek ? (
          /* Host: interactive seek bar */
          <div
            className="relative cursor-pointer"
            style={{ height: seekHovered || isDragging ? '20px' : '16px', transition: 'height 0.15s' }}
            onMouseEnter={() => setSeekHovered(true)}
            onMouseLeave={() => { setSeekHovered(false); }}
            onMouseMove={(e) => handleTrackMouseMove(e, effectiveDuration)}
          >
            {/* Tooltip */}
            {(seekHovered || isDragging) && effectiveDuration > 0 && (
              <div
                className="absolute -top-7 z-20 pointer-events-none"
                style={{ left: `${isDragging ? progress : hoverPercent}%`, transform: 'translateX(-50%)' }}
              >
                <span className="bg-mid-dark text-text-emphasis text-[11px] font-bold px-1.5 py-0.5 rounded shadow-level-2 whitespace-nowrap">
                  {formatTime(isDragging ? displaySec : hoverTime)}
                </span>
              </div>
            )}

            {/* Visual track */}
            <div
              className="absolute left-0 right-0 rounded-full bg-border-muted overflow-hidden pointer-events-none"
              style={{
                top: '50%', transform: 'translateY(-50%)',
                height: seekHovered || isDragging ? '5px' : '3px',
                transition: 'height 0.15s',
              }}
            >
              <div
                className="h-full bg-spotify-green rounded-full"
                style={{ width: `${progress}%`, transition: isDragging ? 'none' : 'width 0.1s linear' }}
              />
            </div>

            {/* Thumb circle */}
            {(seekHovered || isDragging) && (
              <div
                className="absolute z-10 pointer-events-none"
                style={{
                  left: `${progress}%`, top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '14px', height: '14px',
                  borderRadius: '50%', backgroundColor: '#ffffff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                }}
              />
            )}

            <input
              type="range"
              min={0}
              max={effectiveDuration || 0}
              step={1}
              value={displaySec}
              onChange={handleSeekChange}
              onPointerUp={handleSeekCommit}
              onMouseUp={handleSeekCommit}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 appearance-none"
              aria-label="Tua nhạc"
            />
          </div>
        ) : (
          /* Member: read-only bar */
          <div className="h-1.5 bg-border-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-spotify-green rounded-full"
              style={{ width: `${progress}%`, transition: 'width 0.1s linear' }}
            />
          </div>
        )}

        {/* LIVE badge */}
        <div className="absolute -right-2 top-0 -translate-y-full pb-1">
          <span className="bg-negative text-near-black text-micro font-bold px-1.5 py-0.5 rounded-sm tracking-widest uppercase animate-pulse">
            LIVE
          </span>
        </div>
      </div>

      {/* Playback controls */}
      <HostControls
        isHost={isHost}
        isPlaying={isPlaying}
        onPlay={onPlay}
        onPause={onPause}
        onNext={onNext}
        onPrev={onPrev}
      />

    </div>
  );
}
