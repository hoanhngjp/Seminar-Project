interface Props {
  isHost: boolean;
  isPlaying: boolean;
  onPlay:  () => void;
  onPause: () => void;
  onNext:  () => void;
  onPrev:  () => void;
}

export default function HostControls({ isHost, isPlaying, onPlay, onPause, onNext, onPrev }: Props) {
  const handlePlayPause = () => {
    if (!isHost) return;
    isPlaying ? onPause() : onPlay();
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Controls row */}
      <div className="flex items-center justify-center gap-6 w-full">
        <button
          aria-label="Bài trước"
          onClick={isHost ? onPrev : undefined}
          disabled={!isHost}
          className="text-text-secondary hover:text-text-base transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          <span
            className="material-symbols-outlined text-[32px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            skip_previous
          </span>
        </button>

        <button
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
          onClick={handlePlayPause}
          disabled={!isHost}
          className="w-[56px] h-[56px] rounded-full bg-spotify-green flex items-center justify-center hover:scale-105 transition-transform shadow-level-2 disabled:opacity-40 disabled:cursor-default disabled:hover:scale-100"
        >
          <span
            className="material-symbols-outlined text-[36px] text-near-black"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        <button
          aria-label="Bài tiếp theo"
          onClick={isHost ? onNext : undefined}
          disabled={!isHost}
          className="text-text-secondary hover:text-text-base transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          <span
            className="material-symbols-outlined text-[32px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            skip_next
          </span>
        </button>
      </div>

      {/* Queue button */}
      <button className="bg-mid-dark hover:bg-dark-card border border-border-pill rounded-full py-2 px-6 font-small-bold text-small-bold flex items-center gap-2 transition-colors text-text-base">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">queue_music</span>
        📋 Hàng chờ
      </button>

      {/* Note for members */}
      {!isHost && (
        <p className="text-text-secondary font-micro text-micro italic">
          Chỉ Host mới điều khiển phát nhạc
        </p>
      )}
    </div>
  );
}
