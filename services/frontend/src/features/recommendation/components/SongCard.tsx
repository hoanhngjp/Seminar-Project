import { useNavigate } from 'react-router-dom';
import type { RecommendedSong } from '../../../types/domain';
import { songUrl } from '../../../utils/slugify';
import { usePlayerStore } from '../../../store/playerStore';
import { useToast } from '../../../contexts/ToastContext';

interface SongCardProps {
  song: RecommendedSong;
  onPlay: (song: RecommendedSong) => void;
}

export default function SongCard({ song, onPlay }: SongCardProps) {
  const navigate    = useNavigate();
  const addToQueue  = usePlayerStore((s) => s.addToQueue);
  const currentSong = usePlayerStore((s) => s.currentSong);
  const queue       = usePlayerStore((s) => s.queue);
  const { show }    = useToast();

  const goToDetail = () => navigate(songUrl(song));

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isDuplicate =
      currentSong?.songId === song.id ||
      queue.some((q) => q.songId === song.id);
    if (isDuplicate) {
      show(`"${song.title}" đã có trong hàng chờ`, 'info');
      return;
    }
    addToQueue({ songId: song.id, title: song.title, artist: song.artist, coverUrl: song.coverUrl });
    show(`Đã thêm "${song.title}" vào hàng chờ`, 'success');
  };

  return (
    <div
      className="w-[160px] flex-shrink-0 bg-dark-surface p-3 rounded-[6px] hover:bg-[#282828] transition-colors group relative cursor-pointer shadow-level-2 hover:shadow-level-3 snap-start"
    >
      {/* Cover art — click navigates to detail */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Xem chi tiết ${song.title}`}
        onClick={goToDetail}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goToDetail(); }}
        className="relative w-full aspect-square mb-3 rounded shadow-md overflow-hidden"
      >
        {song.coverUrl ? (
          <img
            src={song.coverUrl}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-mid-dark flex items-center justify-center">
            <span className="material-symbols-outlined text-text-secondary text-[32px]">music_note</span>
          </div>
        )}
        {/* Hover play button — click plays without navigating */}
        <button
          aria-label={`Phát ${song.title}`}
          onClick={(e) => { e.stopPropagation(); onPlay(song); }}
          className="absolute bottom-2 right-2 w-10 h-10 bg-spotify-green rounded-full flex items-center justify-center text-black shadow-xl opacity-0 transform translate-y-2 transition-all duration-300 play-button hover:scale-105 hover:bg-[#34e36a]"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_arrow
          </span>
        </button>

        {/* Hover queue button — top-right corner */}
        <button
          aria-label={`Thêm ${song.title} vào hàng chờ`}
          onClick={handleAddToQueue}
          className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-white opacity-0 transition-opacity duration-200 queue-button hover:bg-black/90"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>
      </div>

      {/* Title — click navigates to detail */}
      <button
        onClick={goToDetail}
        className="font-bold text-text-base truncate text-sm text-left w-full hover:underline block"
      >
        {song.title}
      </button>
      <p className="text-text-secondary truncate text-xs mt-1">{song.artist}</p>

      {/* Explain badge — only when present */}
      {song.reason.text && (
        <div
          data-testid="explain-badge"
          className="mt-2 inline-flex items-center gap-1 bg-mid-dark px-2 py-0.5 rounded text-[10px] text-text-secondary"
        >
          <span>{song.reason.text}</span>
        </div>
      )}
    </div>
  );
}
