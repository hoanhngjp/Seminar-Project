import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { usePlayerStore } from '../store/playerStore';
import { getArtist } from '../services/musicService';
import type { ArtistDetail, SongDetail } from '../types/domain';

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
  const { artistId } = useParams<{ artistId: string }>();
  const playSong = usePlayerStore((s) => s.playSong);

  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!artistId) return;
    let cancelled = false;

    getArtist(artistId)
      .then((a) => { if (!cancelled) setArtist(a); })
      .catch(() => {/* stay null */})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [artistId]);

  const songs: SongDetail[] = artist?.songs ?? [];

  function handlePlayAll() {
    if (songs.length > 0) {
      const first = songs[0];
      playSong({
        songId: String(first.id),
        title: first.title,
        artist: first.artist,
        coverUrl: first.coverUrl,
      });
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="h-[280px] rounded-[8px] bg-dark-surface animate-shimmer mb-6" data-testid="artist-hero" />
        <div className="flex gap-8 mb-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-5 w-24 rounded bg-dark-surface animate-shimmer" />)}
        </div>
      </AppShell>
    );
  }

  if (!artist) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-secondary">person_off</span>
          <p className="text-text-secondary">Không tìm thấy nghệ sĩ.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* ── Hero banner ── */}
      <div className="relative h-[280px] rounded-[8px] overflow-hidden mb-6" data-testid="artist-hero">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${artist.bannerImageUrl ?? artist.avatarUrl ?? ''})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/50 to-transparent" />
        <div className="relative h-full flex items-end p-6 gap-6">
          <img
            src={artist.avatarUrl ?? 'https://picsum.photos/seed/artist/120/120'}
            alt={artist.stageName}
            className="w-[120px] h-[120px] rounded-full object-cover shadow-level-3 flex-shrink-0 border-2 border-border-muted"
            data-testid="artist-avatar"
          />
          <div>
            <p className="text-text-secondary text-xs mb-1">Nghệ sĩ</p>
            <h1 className="text-[48px] font-bold text-text-base leading-tight" data-testid="artist-name">
              {artist.stageName}
            </h1>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="flex gap-8 mb-6 text-sm" data-testid="stats-bar">
        <div>
          <span className="text-text-base font-semibold">{songs.length}</span>
          <span className="text-text-secondary ml-1">bài hát</span>
        </div>
        <div>
          <span className="text-text-base font-semibold">{formatCount(artist.totalPlays)}</span>
          <span className="text-text-secondary ml-1">lượt nghe</span>
        </div>
        <div>
          <span className="text-text-base font-semibold">{formatCount(artist.totalFollowers)}</span>
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
      {songs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-text-base mb-4">Bài hát phổ biến</h2>
          <div className="space-y-1">
            {songs.slice(0, 10).map((song, idx) => (
              <div
                key={String(song.id)}
                className="flex items-center gap-4 px-3 py-2 rounded-[8px] hover:bg-mid-dark group cursor-pointer"
                onClick={() => playSong({
                  songId: String(song.id),
                  title: song.title,
                  artist: song.artist,
                  coverUrl: song.coverUrl,
                })}
                data-testid={`track-row-${song.id}`}
              >
                <span className="w-6 text-center text-text-secondary text-sm group-hover:hidden">{idx + 1}</span>
                <span className="w-6 text-center material-symbols-outlined text-[16px] text-text-base hidden group-hover:block">
                  play_arrow
                </span>
                <img
                  src={song.coverUrl ?? 'https://picsum.photos/seed/cover/40/40'}
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
      )}

      {/* ── Bio ── */}
      {artist.bio && (
        <section className="mb-8">
          <h2 className="text-[18px] font-semibold text-text-base mb-3">Giới thiệu</h2>
          <p className="text-text-secondary text-sm leading-relaxed">{artist.bio}</p>
        </section>
      )}
    </AppShell>
  );
}
