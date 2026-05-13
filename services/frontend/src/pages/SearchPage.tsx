import { useRef } from 'react';
import AppShell from '../components/layout/AppShell';
import Spinner from '../components/ui/Spinner';
import { useSearch } from '../features/search/hooks/useSearch';
import { usePlayerStore } from '../store/playerStore';
import type { SearchResult } from '../types/domain';

// ── Genre data (Stitch design) ────────────────────────────────────────────────

const GENRES = [
  { name: 'Pop',        gradient: 'from-pink-500 to-purple-600' },
  { name: 'Rock',       gradient: 'from-red-600 to-red-900' },
  { name: 'R&B',        gradient: 'from-indigo-500 to-blue-700' },
  { name: 'Jazz',       gradient: 'from-orange-400 to-amber-700' },
  { name: 'Classical',  gradient: 'from-gray-500 to-gray-800' },
  { name: 'Electronic', gradient: 'from-cyan-400 to-blue-600' },
  { name: 'Hip-Hop',    gradient: 'from-yellow-500 to-orange-600' },
  { name: 'Acoustic',   gradient: 'from-green-500 to-emerald-700' },
  { name: 'Indie',      gradient: 'from-purple-400 to-fuchsia-600' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SearchInput({
  value,
  onChange,
  onClear,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="relative group w-full">
      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-text-base transition-colors select-none">
        search
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Bài hát, nghệ sĩ, thể loại…"
        aria-label="Tìm kiếm"
        className="w-full h-12 bg-mid-dark rounded-full pl-12 pr-12 font-body-regular text-[16px] text-text-base border border-border-muted placeholder:text-text-secondary shadow-[inset_0px_1px_3px_rgba(0,0,0,0.5)] focus:outline-none focus:border-text-secondary transition-all duration-200"
      />
      {value && (
        <button
          onClick={onClear}
          aria-label="Xóa tìm kiếm"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-base transition-colors"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      )}
    </div>
  );
}

// ── Genre browse grid (empty state) ──────────────────────────────────────────

function GenreGrid() {
  return (
    <section data-testid="genre-browse">
      <h3 className="font-[600] text-[18px] leading-[1.3] text-text-base mb-6">
        Khám phá thể loại
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {GENRES.map((g) => (
          <div
            key={g.name}
            className={`relative h-[160px] rounded-[8px] overflow-hidden group cursor-pointer
              shadow-[0_8px_8px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)]
              transition-all duration-300 transform hover:-translate-y-1`}
            data-testid={`genre-card-${g.name}`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${g.gradient} opacity-90 group-hover:opacity-100 transition-opacity`} />
            <div className="absolute inset-0 p-4 flex items-start z-10">
              <span className="font-[600] text-[18px] leading-[1.3] text-white drop-shadow-md">
                {g.name}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Top result card ───────────────────────────────────────────────────────────

function TopResultCard({
  result,
  onPlay,
}: {
  result: SearchResult;
  onPlay: (r: SearchResult) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-[600] text-[18px] leading-[1.3] text-text-base">Kết quả hàng đầu</h2>
      <div
        className="bg-dark-surface rounded-lg p-6 flex flex-col justify-end relative group h-[240px] cursor-pointer
          transition-colors duration-300 hover:bg-[#282828]
          shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        onClick={() => onPlay(result)}
        data-testid="top-result-card"
      >
        <button
          className="absolute bottom-6 right-6 w-12 h-12 bg-spotify-green rounded-full flex items-center justify-center
            opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0
            transition-all duration-300 shadow-xl hover:scale-105 active:scale-95 z-10"
          aria-label={`Phát ${result.name}`}
          onClick={(e) => { e.stopPropagation(); onPlay(result); }}
        >
          <span className="material-symbols-outlined text-near-black text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            play_arrow
          </span>
        </button>
        <div className="w-24 h-24 rounded-full overflow-hidden mb-4 shadow-lg bg-mid-dark">
          {result.coverUrl ? (
            <img src={result.coverUrl} alt={result.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-secondary">
              <span className="material-symbols-outlined text-[36px]">person</span>
            </div>
          )}
        </div>
        <h3 className="font-[700] text-[24px] leading-[1.2] text-text-base mb-1 truncate">{result.name}</h3>
        <div className="flex items-center">
          <span className="bg-near-black px-3 py-1 rounded-full text-[10px] font-[400] text-text-base uppercase tracking-wider border border-border-muted/30">
            {result.type === 'artist' ? 'Nghệ sĩ' : 'Bài hát'}
          </span>
        </div>
      </div>
    </section>
  );
}

// ── Songs list ────────────────────────────────────────────────────────────────

function SongsList({
  songs,
  onPlay,
}: {
  songs: SearchResult[];
  onPlay: (r: SearchResult) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-[600] text-[18px] leading-[1.3] text-text-base">Bài hát</h2>
      <div className="flex flex-col gap-1">
        {songs.map((song, idx) => (
          <div
            key={song.id}
            className="group flex items-center gap-4 p-2 rounded-md hover:bg-dark-surface transition-colors duration-200 cursor-pointer"
            onClick={() => onPlay(song)}
            data-testid={`song-row-${song.id}`}
          >
            <div className="w-8 flex justify-center text-text-secondary text-[16px] group-hover:hidden select-none">
              {idx + 1}
            </div>
            <div className="w-8 hidden justify-center text-text-base group-hover:flex">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                play_arrow
              </span>
            </div>
            <div className="w-10 h-10 rounded shadow-md overflow-hidden flex-shrink-0 bg-mid-dark">
              {song.coverUrl ? (
                <img src={song.coverUrl} alt={song.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-secondary">
                  <span className="material-symbols-outlined text-[16px]">music_note</span>
                </div>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center min-w-0">
              <span className="font-[700] text-[16px] leading-[1.5] text-text-base truncate group-hover:text-spotify-green transition-colors">
                {song.name}
              </span>
              <span className="text-[14px] leading-[1.5] text-text-secondary truncate">{song.artist}</span>
            </div>
            <div className="text-text-secondary text-[14px] leading-[1.5] pr-4 tabular-nums">
              {song.duration ? formatDuration(song.duration) : '—'}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Artists row ───────────────────────────────────────────────────────────────

function ArtistsRow({ artists }: { artists: SearchResult[] }) {
  if (!artists.length) return null;
  return (
    <section data-testid="artists-section">
      <h2 className="font-[600] text-[18px] leading-[1.3] text-text-base mb-4">Nghệ sĩ</h2>
      <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {artists.map((a) => (
          <div
            key={a.id}
            className="flex flex-col items-center gap-3 min-w-[140px] snap-start group cursor-pointer"
            data-testid={`artist-card-${a.id}`}
          >
            <div className="w-[120px] h-[120px] rounded-full overflow-hidden shadow-lg relative bg-mid-dark flex-shrink-0">
              {a.coverUrl ? (
                <img
                  src={a.coverUrl}
                  alt={a.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-secondary">
                  <span className="material-symbols-outlined text-[48px]">person</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="material-symbols-outlined text-text-base text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
              </div>
            </div>
            <span className="font-[700] text-[16px] leading-[1.5] text-text-base text-center hover:underline">
              {a.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Related songs grid ────────────────────────────────────────────────────────

function RelatedSongsGrid({
  songs,
  onPlay,
}: {
  songs: SearchResult[];
  onPlay: (r: SearchResult) => void;
}) {
  if (!songs.length) return null;
  return (
    <section data-testid="related-section">
      <h2 className="font-[600] text-[18px] leading-[1.3] text-text-base mb-4">Bài hát liên quan</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {songs.map((song) => (
          <div
            key={`related-${song.id}`}
            className="bg-dark-surface p-4 rounded-lg flex flex-col gap-3 group cursor-pointer
              hover:bg-mid-card transition-colors duration-300
              shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_16px_rgba(0,0,0,0.4)]"
            onClick={() => onPlay(song)}
            data-testid={`related-card-${song.id}`}
          >
            <div className="relative w-full aspect-square rounded-md overflow-hidden shadow-md bg-mid-dark">
              {song.coverUrl ? (
                <img src={song.coverUrl} alt={song.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-secondary">
                  <span className="material-symbols-outlined text-[36px]">music_note</span>
                </div>
              )}
              <button
                className="absolute bottom-2 right-2 w-10 h-10 bg-spotify-green rounded-full flex items-center justify-center
                  opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0
                  transition-all duration-300 shadow-xl hover:scale-105"
                aria-label={`Phát ${song.name}`}
                onClick={(e) => { e.stopPropagation(); onPlay(song); }}
              >
                <span className="material-symbols-outlined text-near-black text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
              </button>
            </div>
            <div className="flex flex-col">
              <span className="font-[700] text-[16px] leading-[1.5] text-text-base truncate">{song.name}</span>
              <span className="text-[14px] leading-[1.5] text-text-secondary truncate mt-1">{song.artist}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery, results, loading, clearQuery } = useSearch();
  const playSong = usePlayerStore((s) => s.playSong);

  const hasQuery  = query.trim().length > 0;
  const songs     = results.filter((r) => r.type === 'song');
  const artists   = results.filter((r) => r.type === 'artist');
  const topResult = results.reduce<SearchResult | null>(
    (best, r) => (!best || r.score > best.score ? r : best),
    null,
  );
  const relatedSongs = songs.filter((s) => s.id !== topResult?.id).slice(0, 5);

  function handlePlay(r: SearchResult) {
    if (r.type === 'song') {
      playSong({
        songId:   r.id,
        title:    r.name,
        artist:   r.artist ?? '',
        coverUrl: r.coverUrl,
      });
    }
  }

  const searchInput = (
    <SearchInput value={query} onChange={setQuery} onClear={clearQuery} inputRef={inputRef} />
  );

  return (
    <AppShell
      headerContent={
        <div className="hidden lg:flex flex-1 max-w-[680px]">{searchInput}</div>
      }
    >
      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* Mobile heading + input */}
        <div className="lg:hidden mb-8">
          <h2 className="font-[700] text-[24px] leading-[1.2] text-text-base mb-4">Tìm kiếm</h2>
          {searchInput}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16" data-testid="search-loading">
            <Spinner />
          </div>
        )}

        {/* Empty state */}
        {!hasQuery && !loading && <GenreGrid />}

        {/* No results */}
        {hasQuery && !loading && results.length === 0 && (
          <div className="flex flex-col items-center py-24 gap-4" data-testid="no-results">
            <span className="material-symbols-outlined text-[64px] text-text-secondary">search_off</span>
            <p className="font-[600] text-[18px] text-text-base">Không tìm thấy kết quả</p>
            <p className="text-[14px] text-text-secondary">
              Không có kết quả nào cho &ldquo;{query}&rdquo;
            </p>
          </div>
        )}

        {/* Results */}
        {hasQuery && !loading && results.length > 0 && (
          <div className="flex flex-col gap-10" data-testid="search-results">
            {(topResult || songs.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {topResult && (
                  <div className="lg:col-span-2">
                    <TopResultCard result={topResult} onPlay={handlePlay} />
                  </div>
                )}
                {songs.length > 0 && (
                  <div className={topResult ? 'lg:col-span-3' : 'lg:col-span-5'}>
                    <SongsList songs={songs.slice(0, 4)} onPlay={handlePlay} />
                  </div>
                )}
              </div>
            )}
            <ArtistsRow artists={artists} />
            <RelatedSongsGrid songs={relatedSongs} onPlay={handlePlay} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
