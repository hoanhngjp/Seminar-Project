import type { RecommendedSong } from '../../../types/domain';

interface SongCardProps {
  song: RecommendedSong;
  onPlay: (song: RecommendedSong) => void;
}

export default function SongCard({ song, onPlay }: SongCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Phát ${song.title} — ${song.artist}`}
      onClick={() => onPlay(song)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPlay(song); }}
      className="w-[160px] flex-shrink-0 bg-dark-surface p-3 rounded-[6px] hover:bg-[#282828] transition-colors group relative cursor-pointer shadow-level-2 hover:shadow-level-3 snap-start"
    >
      {/* Cover art */}
      <div className="relative w-full aspect-square mb-3 rounded shadow-md overflow-hidden">
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
        {/* Hover play button */}
        <button
          tabIndex={-1}
          aria-hidden="true"
          className="absolute bottom-2 right-2 w-10 h-10 bg-spotify-green rounded-full flex items-center justify-center text-black shadow-xl opacity-0 transform translate-y-2 transition-all duration-300 play-button hover:scale-105 hover:bg-[#34e36a]"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_arrow
          </span>
        </button>
      </div>

      {/* Metadata */}
      <h4 className="font-bold text-text-base truncate text-sm">{song.title}</h4>
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
