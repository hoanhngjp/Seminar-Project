import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { usePlayerStore } from '../store/playerStore';
import { colors, font, fontSize, fontWeight, radius, spacing } from '../styles/tokens';
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
  const setSong = usePlayerStore((s) => s.setSong);
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
    <AppShell>
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
                onClick={() => setSong({ songId: item.songId, title: item.title, artist: item.artist })}
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
    </AppShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    padding: '2rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  sectionTitle: {
    margin: `0 0 ${spacing[4]}px`,
    fontSize: fontSize.section,
    fontWeight: fontWeight.bold,
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing[2]}px`,
    fontFamily: font.title,
    color: colors.text,
  },
  contextBadge: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    background: '#1ed76020',
    color: colors.accent,
    borderRadius: radius.subtle,
    padding: '2px 6px',
    textTransform: 'capitalize',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: `${spacing[4]}px`,
  },
  skeleton: {
    height: 220,
    borderRadius: radius.card,
    background: colors.surfaceCard,
    animation: 'shimmer 1.5s infinite',
  },
  card: {
    background: colors.surface,
    border: 'none',
    borderRadius: radius.card,
    padding: `${spacing[4]}px`,
    cursor: 'pointer',
    textAlign: 'left',
    color: colors.text,
    transition: 'background 0.15s',
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing[2]}px`,
  },
  coverPlaceholder: {
    fontSize: '2.5rem',
    textAlign: 'center',
    padding: `${spacing[2]}px 0`,
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing[1]}px`,
  },
  cardTitle: {
    margin: 0,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.body,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: font.title,
  },
  cardArtist: {
    margin: 0,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  explainBadge: {
    fontSize: fontSize.small,
    color: colors.accent,
    background: '#1ed76020',
    borderRadius: radius.subtle,
    padding: '2px 6px',
    display: 'inline-block',
    marginTop: `${spacing[1]}px`,
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: `${spacing[4]}px`,
    padding: `${spacing[6]}px`,
    textAlign: 'center',
  },
  errorText: {
    margin: 0,
    color: colors.error,
  },
  retryBtn: {
    padding: '10px 24px',
    background: colors.accent,
    color: '#000000',
    border: 'none',
    borderRadius: radius.fullPill,
    cursor: 'pointer',
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: '1.4px',
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    padding: `${spacing[6]}px`,
  },
};
