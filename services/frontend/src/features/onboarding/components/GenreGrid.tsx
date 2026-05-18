
export interface GenreOption {
  id: string;
  name: string;
  gradient: string;
}

export const GENRE_OPTIONS: GenreOption[] = [
  { id: 'd4e5f6a7-b8c9-0123-defa-234567890123', name: 'Pop',       gradient: 'from-pink-600 to-purple-800' },
  { id: 'e5f6a7b8-c9d0-1234-efab-567890123456', name: 'Rock',      gradient: 'from-red-700 to-red-900' },
  { id: 'f6a7b8c9-d0e1-2345-fabc-678901234567', name: 'R&B',       gradient: 'from-blue-600 to-indigo-900' },
  { id: 'a7b8c9d0-e1f2-3456-abcd-789012345678', name: 'Jazz',      gradient: 'from-yellow-700 to-amber-900' },
  { id: 'b8c9d0e1-f2a3-4567-bcde-890123456789', name: 'Classical', gradient: 'from-emerald-700 to-teal-900' },
  { id: 'c9d0e1f2-a3b4-5678-cdef-901234567890', name: 'Electronic',gradient: 'from-cyan-600 to-blue-800' },
  { id: 'd0e1f2a3-b4c5-6789-defa-012345678901', name: 'Hip-Hop',   gradient: 'from-orange-600 to-red-800' },
  { id: 'e1f2a3b4-c5d6-7890-efab-123456789012', name: 'Acoustic',  gradient: 'from-green-700 to-lime-900' },
  { id: 'f2a3b4c5-d6e7-8901-fabc-234567890123', name: 'Indie',     gradient: 'from-indigo-600 to-purple-800' },
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
