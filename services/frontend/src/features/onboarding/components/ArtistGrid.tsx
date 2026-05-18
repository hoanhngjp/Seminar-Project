import { useMemo } from 'react';
import { getOnboardingArtists } from '../data/artistAvatars';

interface ArtistGridProps {
  selectedArtists: string[];
  toggleArtist: (id: string) => void;
}

export function ArtistGrid({ selectedArtists, toggleArtist }: ArtistGridProps) {
  const artists = useMemo(() => getOnboardingArtists(), []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-y-xl gap-x-md place-items-center w-full pb-32">
      {artists.map((artist) => {
        const isSelected = selectedArtists.includes(artist.id);

        return (
          <button
            key={artist.id}
            type="button"
            onClick={() => toggleArtist(artist.id)}
            aria-pressed={isSelected}
            className="flex flex-col items-center gap-sm group focus:outline-none w-full"
          >
            <div className={`relative rounded-full transition-all duration-300 transform group-hover:scale-105 group-active:scale-95 ${
              isSelected ? 'ring-2 ring-spotify-green ring-offset-4 ring-offset-near-black' : ''
            }`}>
              <img
                src={artist.imageUrl}
                alt={artist.name}
                className={`w-24 h-24 rounded-full object-cover ${
                  isSelected ? 'shadow-level-3' : 'shadow-none group-hover:shadow-level-2'
                }`}
              />
              {isSelected && (
                <div className="absolute bottom-0 right-0 bg-spotify-green text-near-black rounded-full w-7 h-7 flex items-center justify-center border-4 border-near-black shadow-md">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
                </div>
              )}
            </div>
            <span className={`font-body-bold text-body-bold text-center line-clamp-2 mt-sm transition-colors duration-200 ${
              isSelected ? 'text-text-base' : 'text-text-secondary group-hover:text-text-base'
            }`}>
              {artist.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
