
export interface GenreOption {
  id: string;
  name: string;
  gradient: string;
}

export const GENRE_OPTIONS: GenreOption[] = [
  { id: 'pop', name: 'Pop', gradient: 'from-pink-600 to-purple-800' },
  { id: 'rock', name: 'Rock', gradient: 'from-red-700 to-red-900' },
  { id: 'rb', name: 'R&B', gradient: 'from-blue-600 to-indigo-900' },
  { id: 'jazz', name: 'Jazz', gradient: 'from-yellow-700 to-amber-900' },
  { id: 'classical', name: 'Classical', gradient: 'from-emerald-700 to-teal-900' },
  { id: 'electronic', name: 'Electronic', gradient: 'from-cyan-600 to-blue-800' },
  { id: 'hiphop', name: 'Hip-Hop', gradient: 'from-orange-600 to-red-800' },
  { id: 'acoustic', name: 'Acoustic', gradient: 'from-green-700 to-lime-900' },
  { id: 'indie', name: 'Indie', gradient: 'from-indigo-600 to-purple-800' },
];

interface GenreGridProps {
  selectedGenres: string[];
  toggleGenre: (id: string) => void;
}

export function GenreGrid({ selectedGenres, toggleGenre }: GenreGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-md w-full mb-xl">
      {GENRE_OPTIONS.map((genre) => {
        const isSelected = selectedGenres.includes(genre.id);
        
        return (
          <button
            key={genre.id}
            type="button"
            onClick={() => toggleGenre(genre.id)}
            className={`relative h-[100px] w-full rounded-[8px] overflow-hidden text-left border-2 transform hover:scale-[1.02] transition-all shadow-level-2 focus:outline-none ${
              isSelected ? 'border-spotify-green' : 'border-transparent hover:border-border-muted'
            }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${genre.gradient} ${isSelected ? 'opacity-80' : 'opacity-60'}`}></div>
            <div className="absolute inset-0 p-base flex flex-col justify-between">
              <span className="font-feature-heading text-feature-heading text-text-base drop-shadow-md">{genre.name}</span>
              {isSelected && (
                <div className="self-end bg-spotify-green rounded-full p-1 shadow-[rgba(0,0,0,0.5)_0px_4px_8px] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px] text-near-black" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
