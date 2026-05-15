import { useNavigate } from 'react-router-dom';
import type { SearchResult } from '../../../types/domain';

interface ArtistCardProps {
  artist: SearchResult;
}

export default function ArtistCard({ artist }: ArtistCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="min-w-[160px] w-[160px] bg-dark-surface rounded-[8px] p-4 flex flex-col items-center cursor-pointer hover:bg-mid-card transition-all duration-300 group"
      data-testid={`artist-card-${artist.id}`}
      onClick={() => navigate(`/artists/${artist.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/artists/${artist.id}`); }}
      aria-label={`Xem trang nghệ sĩ ${artist.name}`}
    >
      {/* Avatar circular + floating play */}
      <div className="relative w-[100px] h-[100px] rounded-full mb-4 overflow-hidden shadow-lg flex-shrink-0">
        {artist.coverUrl ? (
          <img
            src={artist.coverUrl}
            alt={artist.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-mid-dark flex items-center justify-center">
            <span className="material-symbols-outlined text-text-secondary text-[48px]">person</span>
          </div>
        )}

        {/* Floating play button — appears on hover */}
        <button
          className="absolute bottom-0 right-0 w-[40px] h-[40px] bg-spotify-green rounded-full flex items-center justify-center text-near-black shadow-lg hover:scale-105 transition-all duration-300 z-10 translate-y-1/4 translate-x-1/4 opacity-0 group-hover:opacity-100"
          aria-label={`Phát nhạc của ${artist.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span
            className="material-symbols-outlined text-[20px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            play_arrow
          </span>
        </button>
      </div>

      <h3 className="font-[600] text-[18px] leading-[1.3] text-text-emphasis text-center w-full truncate">
        {artist.name}
      </h3>
      <p className="text-[14px] leading-[1.5] text-text-secondary mt-1">Nghệ sĩ</p>
    </div>
  );
}
