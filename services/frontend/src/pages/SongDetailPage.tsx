import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import SongCard from '../features/recommendation/components/SongCard';
import { usePlayerStore } from '../store/playerStore';
import { MOCK_SONG_DETAIL, MOCK_RELATED_SONGS } from '../mocks/data';
import type { RecommendedSong } from '../types/domain';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function SongDetailPage() {
  const navigate = useNavigate();
  const playSong = usePlayerStore((s) => s.playSong);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  const song = MOCK_SONG_DETAIL;
  const related = MOCK_RELATED_SONGS;

  const [showContextMenu, setShowContextMenu] = useState(false);

  function handlePlay() {
    playSong({ songId: song.id, title: song.title, artist: song.artist, coverUrl: song.coverUrl });
  }

  function handleAddToQueue() {
    addToQueue({ songId: song.id, title: song.title, artist: song.artist, coverUrl: song.coverUrl });
    setShowContextMenu(false);
  }

  function handleRelatedPlay(s: RecommendedSong) {
    playSong({ songId: s.id, title: s.title, artist: s.artist, coverUrl: s.coverUrl });
  }

  return (
    <AppShell>
      {/* ── Hero ── */}
      <div className="relative h-[320px] rounded-[8px] overflow-hidden mb-8" data-testid="hero-section">
        {/* Blurred background */}
        <div
          className="absolute inset-0 bg-cover bg-center blur-3xl scale-110 opacity-50"
          style={{ backgroundImage: `url(${song.coverUrl ?? ''})` }}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/60 to-transparent" />

        {/* Content */}
        <div className="relative h-full flex items-end gap-6 p-6">
          <img
            src={song.coverUrl}
            alt={song.title}
            className="w-[160px] h-[160px] rounded-[8px] object-cover shadow-level-3 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-text-secondary text-sm mb-1">Bài hát</p>
            <h1 className="text-[24px] font-bold text-text-base truncate mb-1">{song.title}</h1>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Link
                to={`/artists/${song.genreId ?? 'artist-001'}`}
                className="hover:text-text-base hover:underline font-medium"
                data-testid="artist-link"
              >
                {song.artist}
              </Link>
              {song.album && (
                <>
                  <span>·</span>
                  <span>{song.album}</span>
                </>
              )}
              <span>·</span>
              <span>{formatDuration(song.duration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={handlePlay}
          className="flex items-center gap-2 bg-spotify-green text-near-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-transform"
          data-testid="play-button"
        >
          <span className="material-symbols-outlined text-[20px]">play_arrow</span>
          Phát
        </button>
        <button
          onClick={handleAddToQueue}
          className="flex items-center gap-2 border border-border-muted text-text-base font-medium px-5 py-3 rounded-full hover:bg-mid-dark transition-colors"
          data-testid="add-to-queue-button"
        >
          <span className="material-symbols-outlined text-[18px]">queue_music</span>
          Thêm vào Queue
        </button>
        <div className="relative">
          <button
            onClick={() => setShowContextMenu((v) => !v)}
            className="p-2 rounded-full hover:bg-mid-dark transition-colors text-text-secondary"
            aria-label="Thêm tùy chọn"
            data-testid="more-options-button"
          >
            <span className="material-symbols-outlined">more_horiz</span>
          </button>
          {showContextMenu && (
            <div className="absolute left-0 top-10 bg-[#282828] rounded-[8px] shadow-heavy border border-border-muted z-[100] w-[200px] py-1">
              <button
                className="w-full text-left px-4 py-2 text-sm text-text-base hover:bg-mid-dark"
                onClick={() => navigate(`/artists/artist-001`)}
              >
                Đến trang nghệ sĩ
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm text-text-base hover:bg-mid-dark"
                onClick={() => setShowContextMenu(false)}
              >
                Chia sẻ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Metadata grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" data-testid="metadata-grid">
        {song.genreName && (
          <div className="bg-dark-surface rounded-[8px] p-4">
            <p className="text-text-secondary text-xs mb-1">Thể loại</p>
            <p className="text-text-base font-medium text-sm">{song.genreName}</p>
          </div>
        )}
        {song.moodName && (
          <div className="bg-dark-surface rounded-[8px] p-4">
            <p className="text-text-secondary text-xs mb-1">Tâm trạng</p>
            <p className="text-text-base font-medium text-sm">{song.moodName}</p>
          </div>
        )}
        {song.language && (
          <div className="bg-dark-surface rounded-[8px] p-4">
            <p className="text-text-secondary text-xs mb-1">Ngôn ngữ</p>
            <p className="text-text-base font-medium text-sm">{song.language}</p>
          </div>
        )}
        {song.releaseDate && (
          <div className="bg-dark-surface rounded-[8px] p-4">
            <p className="text-text-secondary text-xs mb-1">Ngày phát hành</p>
            <p className="text-text-base font-medium text-sm">{song.releaseDate.slice(0, 4)}</p>
          </div>
        )}
        {song.playCount !== undefined && (
          <div className="bg-dark-surface rounded-[8px] p-4">
            <p className="text-text-secondary text-xs mb-1">Lượt nghe</p>
            <p className="text-text-base font-medium text-sm">{formatCount(song.playCount)}</p>
          </div>
        )}
      </div>

      {/* ── Suggestion card ── */}
      {song.explainText && (
        <div className="bg-dark-surface rounded-[8px] p-4 mb-8 flex items-center gap-3" data-testid="explain-card">
          <span className="material-symbols-outlined text-spotify-green text-[20px]">lightbulb</span>
          <p className="text-text-secondary text-sm">{song.explainText}</p>
        </div>
      )}

      {/* ── Related songs ── */}
      <section>
        <div className="mb-4">
          <h3 className="text-[18px] font-semibold text-text-base">Bài hát liên quan</h3>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {related.map((s) => (
            <SongCard key={s.id} song={s} onPlay={handleRelatedPlay} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
