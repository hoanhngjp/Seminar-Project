import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RecommendedSong } from '../../../types/domain';
import { songUrl } from '../../../utils/slugify';

interface RecommendationFeedRowProps {
  song: RecommendedSong;
  index: number;
  onPlay: (song: RecommendedSong) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecommendationFeedRow({ song, index, onPlay }: RecommendationFeedRowProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="row"
      className="flex items-center gap-4 h-16 px-2 rounded-md hover:bg-mid-dark transition-colors group cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Index / Play icon */}
      <div className="w-8 flex-shrink-0 flex items-center justify-center">
        {hovered ? (
          <button
            aria-label={`Phát ${song.title}`}
            onClick={() => onPlay(song)}
            className="text-text-base hover:text-spotify-green transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              play_arrow
            </span>
          </button>
        ) : (
          <span className="text-text-secondary text-sm select-none">{index + 1}</span>
        )}
      </div>

      {/* Cover */}
      <div className="w-14 h-14 flex-shrink-0 rounded-[6px] overflow-hidden bg-mid-dark">
        {song.coverUrl ? (
          <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="material-symbols-outlined text-text-secondary text-[24px]">music_note</span>
          </div>
        )}
      </div>

      {/* Title + reason + artist */}
      <div className="flex-1 min-w-0">
        <button
          className="font-bold text-text-base text-sm truncate block hover:underline text-left w-full"
          onClick={() => navigate(songUrl(song))}
        >
          {song.title}
        </button>
        <div className="flex items-center gap-2 mt-0.5">
          {song.reason.text && (
            <span className="bg-mid-dark px-2 py-0.5 rounded text-[10px] text-text-secondary flex-shrink-0">
              {song.reason.text}
            </span>
          )}
          <span className="text-text-secondary text-xs truncate">{song.artist}</span>
        </div>
      </div>

      {/* Duration */}
      <span className="text-text-secondary text-sm flex-shrink-0 tabular-nums">
        {song.duration ? formatDuration(song.duration) : '—'}
      </span>
    </div>
  );
}
