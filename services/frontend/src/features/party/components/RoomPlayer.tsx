import type { Song } from '../../../types/domain';
import HostControls from './HostControls';

interface Props {
  song: Song;
  isPlaying: boolean;
  positionSec: number;
  isHost: boolean;
  onPlay:  () => void;
  onPause: () => void;
  onNext:  () => void;
  onPrev:  () => void;
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
  onPlay,
  onPause,
  onNext,
  onPrev,
}: Props) {
  const progress = song.duration > 0 ? (positionSec / song.duration) * 100 : 0;

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
          <span>{formatTime(positionSec)}</span>
          <span>{formatTime(song.duration)}</span>
        </div>
        <div className="h-1.5 bg-border-muted rounded-full overflow-hidden relative">
          <div
            className="absolute top-0 left-0 h-full bg-spotify-green rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>

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
