import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AudioPlayer from '../components/Player/AudioPlayer';
import {
  fetchRecommendations,
  getTimeContext,
  type RecommendationItem,
  type ContextType,
} from '../api/recommendationApi';
import { useAuthStore } from '../store/authStore';

export default function HomePage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) navigate('/login', { replace: true });
  }, [accessToken, navigate]);

  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSong, setSelectedSong] = useState<RecommendationItem | null>(null);
  const [context] = useState<ContextType>(() => getTimeContext());

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecommendations(context);
      setItems(data);
    } catch {
      setError('Không thể tải gợi ý. Thử lại.');
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    if (accessToken) loadRecommendations();
  }, [accessToken, loadRecommendations]);

  if (!accessToken) return null;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Smart Music</h1>
        <nav>
          <a href="/search" style={styles.navLink}>Tìm kiếm</a>
        </nav>
      </header>

      <main style={styles.main}>
        <h2 style={styles.sectionTitle}>
          Gợi ý cho bạn
          {context !== 'none' && (
            <span style={styles.contextBadge}>{context}</span>
          )}
        </h2>

        {loading && (
          <div style={styles.grid} aria-label="Đang tải danh sách nhạc">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={styles.skeleton} aria-hidden="true" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={styles.errorBox} role="alert">
            <p style={styles.errorText}>{error}</p>
            <button onClick={loadRecommendations} style={styles.retryBtn}>
              Thử lại
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p style={styles.emptyText}>
            Không có gợi ý. Hãy nghe nhạc để cá nhân hoá!
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <div style={styles.grid}>
            {items.map((item) => (
              <button
                key={item.songId}
                style={styles.card}
                onClick={() => setSelectedSong(item)}
                aria-label={`Phát ${item.title} — ${item.artist}`}
              >
                <div style={styles.coverPlaceholder} aria-hidden="true">🎵</div>
                <div style={styles.cardBody}>
                  <p style={styles.cardTitle}>{item.title}</p>
                  <p style={styles.cardArtist}>{item.artist}</p>
                  {item.explainText && (
                    <span data-testid="explain-badge" style={styles.explainBadge}>
                      {item.explainText}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {selectedSong && (
        <div style={styles.playerBar}>
          <AudioPlayer
            songId={selectedSong.songId}
            title={selectedSong.title}
            artist={selectedSong.artist}
          />
          <button
            onClick={() => setSelectedSong(null)}
            style={styles.closeBtn}
            aria-label="Đóng player"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0f0f0f',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 2rem',
    borderBottom: '1px solid #222',
    position: 'sticky',
    top: 0,
    background: '#0f0f0f',
    zIndex: 10,
  },
  logo: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#1db954',
  },
  navLink: {
    color: '#aaa',
    textDecoration: 'none',
    fontSize: '0.9rem',
  },
  main: {
    flex: 1,
    padding: '2rem',
    maxWidth: 1200,
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  sectionTitle: {
    margin: '0 0 1.5rem',
    fontSize: '1.5rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  contextBadge: {
    fontSize: '0.75rem',
    fontWeight: 500,
    background: '#1db95433',
    color: '#1db954',
    border: '1px solid #1db95466',
    borderRadius: 20,
    padding: '0.2rem 0.65rem',
    textTransform: 'capitalize',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
  },
  skeleton: {
    height: 220,
    borderRadius: 10,
    background: 'linear-gradient(90deg, #1a1a1a 25%, #242424 50%, #1a1a1a 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '1rem',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#fff',
    transition: 'background 0.15s, transform 0.1s',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  coverPlaceholder: {
    fontSize: '2.5rem',
    textAlign: 'center',
    padding: '0.5rem 0',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  cardTitle: {
    margin: 0,
    fontWeight: 600,
    fontSize: '0.9rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardArtist: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#888',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  explainBadge: {
    fontSize: '0.7rem',
    color: '#1db954',
    background: '#1db95422',
    borderRadius: 4,
    padding: '0.15rem 0.4rem',
    display: 'inline-block',
    marginTop: '0.25rem',
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '3rem',
    textAlign: 'center',
  },
  errorText: {
    margin: 0,
    color: '#ff6b6b',
  },
  retryBtn: {
    padding: '0.6rem 1.5rem',
    background: '#1db954',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: '3rem',
  },
  playerBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#111',
    borderTop: '1px solid #222',
    padding: '0.75rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    zIndex: 100,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#aaa',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    marginLeft: 'auto',
  },
};
