import { useState } from 'react';
import AppShell from '../components/layout/AppShell';
import { usePlayerStore } from '../store/playerStore';
import { MOCK_ARTIST, MOCK_RELATED_SONGS } from '../mocks/data';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ArtistPage() {
  const playSong = usePlayerStore((s) => s.playSong);
  const artist = MOCK_ARTIST;
  const songs = MOCK_RELATED_SONGS;

  const [isFollowing, setIsFollowing] = useState(false);

  function handlePlayAll() {
    if (songs.length > 0) {
      const first = songs[0];
      playSong({ songId: first.id, title: first.title, artist: first.artist, coverUrl: first.coverUrl });
    }
  }

  return (
    <AppShell>
      {/* ── Hero banner ── */}
      <div className="relative h-[280px] rounded-[8px] overflow-hidden mb-6" data-testid="artist-hero">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${artist.avatarUrl ?? ''})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/50 to-transparent" />
        <div className="relative h-full flex items-end p-6 gap-6">
          <img
            src={artist.avatarUrl}
            alt={artist.name}
            className="w-[120px] h-[120px] rounded-full object-cover shadow-level-3 flex-shrink-0 border-2 border-border-muted"
            data-testid="artist-avatar"
          />
          <div>
            <p className="text-text-secondary text-xs mb-1">Nghệ sĩ</p>
            <h1 className="text-[48px] font-bold text-text-base leading-tight" data-testid="artist-name">
              {artist.name}
            </h1>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="flex gap-8 mb-6 text-sm" data-testid="stats-bar">
        <div>
          <span className="text-text-base font-semibold">{artist.songCount ?? 0}</span>
          <span className="text-text-secondary ml-1">bài hát</span>
        </div>
        <div>
          <span className="text-text-base font-semibold">{formatCount(artist.totalPlays ?? 0)}</span>
          <span className="text-text-secondary ml-1">lượt nghe</span>
        </div>
        <div>
          <span className="text-text-base font-semibold">{formatCount(artist.followerCount ?? 0)}</span>
          <span className="text-text-secondary ml-1">người theo dõi</span>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 mb-8">
        <button
          onClick={handlePlayAll}
          className="flex items-center gap-2 bg-spotify-green text-near-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-transform"
          data-testid="play-all-button"
        >
          <span className="material-symbols-outlined text-[20px]">play_arrow</span>
          Phát
        </button>
        <button
          onClick={() => setIsFollowing((v) => !v)}
          className={`px-6 py-3 rounded-full font-medium border transition-colors ${
            isFollowing
              ? 'bg-spotify-green/20 border-spotify-green text-spotify-green'
              : 'border-border-muted text-text-base hover:bg-mid-dark'
          }`}
          data-testid="follow-button"
        >
          {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
        </button>
      </div>

      {/* ── Popular tracks ── */}
      <section className="mb-8">
        <h2 className="text-[18px] font-semibold text-text-base mb-4">Bài hát phổ biến</h2>
        <div className="space-y-1">
          {songs.map((song, idx) => (
            <div
              key={song.id}
              className="flex items-center gap-4 px-3 py-2 rounded-[8px] hover:bg-mid-dark group cursor-pointer"
              onClick={() => playSong({ songId: song.id, title: song.title, artist: song.artist, coverUrl: song.coverUrl })}
              data-testid={`track-row-${song.id}`}
            >
              <span className="w-6 text-center text-text-secondary text-sm group-hover:hidden">{idx + 1}</span>
              <span className="w-6 text-center material-symbols-outlined text-[16px] text-text-base hidden group-hover:block">
                play_arrow
              </span>
              <img
                src={song.coverUrl}
                alt={song.title}
                className="w-10 h-10 rounded object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-text-base text-sm font-medium truncate">{song.title}</p>
              </div>
              <span className="text-text-secondary text-sm flex-shrink-0">{formatDuration(song.duration)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Fans Also Like ── */}
      <section>
        <h2 className="text-[18px] font-semibold text-text-base mb-4">Người hâm mộ cũng thích</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {[MOCK_ARTIST, { ...MOCK_ARTIST, id: 'artist-002', name: 'Vũ.', avatarUrl: 'https://picsum.photos/seed/vu/400/400' }].map((a) => (
            <div
              key={a.id}
              className="flex-shrink-0 w-[160px] text-center cursor-pointer group"
              data-testid={`similar-artist-${a.id}`}
            >
              <div className="w-[120px] h-[120px] mx-auto rounded-full overflow-hidden mb-3 shadow-level-2">
                <img src={a.avatarUrl} alt={a.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </div>
              <p className="text-text-base text-sm font-medium truncate">{a.name}</p>
              <p className="text-text-secondary text-xs">Nghệ sĩ</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
