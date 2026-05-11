import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchSongs, type SearchResultItem } from '../api/searchApi';
import { useAuthStore } from '../store/authStore';
import AppShell from '../components/layout/AppShell';
import { usePlayerStore } from '../store/playerStore';
import { colors, font, fontSize, fontWeight, radius, shadows, spacing } from '../styles/tokens';

const DEBOUNCE_MS = 300;

export default function SearchPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) navigate('/login', { replace: true });
  }, [accessToken, navigate]);

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false); // true after first search attempt
  const setSong = usePlayerStore((s) => s.setSong);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string, cursor?: string) => {
    if (!q.trim()) {
      setItems([]);
      setNextCursor(null);
      setHasMore(false);
      setSearched(false);
      return;
    }

    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setItems([]);
      setNextCursor(null);
      setHasMore(false);
    }

    try {
      const data = await searchSongs(q.trim(), 10, cursor);
      setItems((prev) => (cursor ? [...prev, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setSearched(true);
    } catch {
      // Search fallback: return empty list per contract — no error thrown to user
      if (!cursor) setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      if (!cursor) setSearched(true);
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  const handleLoadMore = () => {
    if (nextCursor) void runSearch(query, nextCursor);
  };

  if (!accessToken) return null;

  return (
    <AppShell>
      <main style={styles.main}>
        <h2 style={styles.title}>Tìm kiếm</h2>

        <div style={styles.searchBox}>
          <i className="fa-solid fa-magnifying-glass" style={styles.searchIcon} aria-hidden="true"></i>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm bài hát, nghệ sĩ..."
            style={styles.input}
            aria-label="Tìm kiếm bài hát"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={styles.clearBtn}
              aria-label="Xoá từ khoá"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>

        {/* Empty query state */}
        {!query && (
          <p style={styles.hintText}>Tìm kiếm bài hát, nghệ sĩ...</p>
        )}

        {/* Loading */}
        {loading && (
          <div aria-label="Đang tìm kiếm">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={styles.skeleton} aria-hidden="true" />
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && searched && query && items.length === 0 && (
          <p style={styles.emptyText} role="status">
            Không tìm thấy kết quả cho &ldquo;{query}&rdquo;
          </p>
        )}

        {/* Results list */}
        {!loading && items.length > 0 && (
          <div>
            <ul style={styles.list} role="list">
              {items.map((item) => (
                <li key={item.songId} style={styles.listItem} role="listitem">
                  <button
                    style={styles.resultBtn}
                    onClick={() => setSong({ songId: item.songId, title: item.title, artist: item.artist })}
                    aria-label={`Phát ${item.title} — ${item.artist}`}
                  >
                    <div style={styles.resultIcon} aria-hidden="true"><i className="fa-solid fa-music"></i></div>
                    <div style={styles.resultBody}>
                      <p style={styles.resultTitle}>{item.title}</p>
                      <p style={styles.resultMeta}>
                        {item.artist}
                        {item.album && (
                          <span style={styles.albumText}> · {item.album}</span>
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {hasMore && (
              <div style={styles.loadMoreRow}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  style={styles.loadMoreBtn}
                  aria-label="Tải thêm kết quả"
                >
                  {loadingMore ? 'Đang tải…' : 'Xem thêm'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </AppShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    padding: '2rem',
    maxWidth: 720,
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    paddingBottom: '6rem',
  },
  title: {
    margin: `0 0 ${spacing[4]}px`,
    fontSize: fontSize.section,
    fontWeight: fontWeight.bold,
    fontFamily: font.title,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: colors.surfaceMid,
    boxShadow: shadows.inset,
    borderRadius: radius.fullPill,
    padding: '12px 24px',
    gap: `${spacing[2]}px`,
    marginBottom: `${spacing[4]}px`,
  },
  searchIcon: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: colors.text,
    fontSize: fontSize.body,
    outline: 'none',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: colors.textMuted,
    cursor: 'pointer',
    fontSize: fontSize.body,
    padding: `0 ${spacing[1]}px`,
    flexShrink: 0,
  },
  hintText: {
    color: colors.textMuted,
    textAlign: 'center',
    padding: `${spacing[6]}px 0`,
    margin: 0,
  },
  skeleton: {
    height: 64,
    borderRadius: radius.card,
    background: colors.surfaceCard,
    animation: 'shimmer 1.5s infinite',
    marginBottom: `${spacing[2]}px`,
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    padding: `${spacing[6]}px 0`,
    margin: 0,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: `${spacing[2]}px`,
  },
  listItem: {
    display: 'flex',
  },
  resultBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: `${spacing[3]}px`,
    background: colors.surface,
    border: 'none',
    borderRadius: radius.card,
    padding: `${spacing[3]}px ${spacing[4]}px`,
    color: colors.text,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.15s',
  },
  resultIcon: {
    fontSize: fontSize.feature,
    color: colors.textMuted,
    flexShrink: 0,
  },
  resultBody: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    margin: 0,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.body,
    fontFamily: font.title,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resultMeta: {
    margin: `${spacing[1]}px 0 0`,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  albumText: {
    color: colors.textNear,
  },
  loadMoreRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: `${spacing[4]}px`,
  },
  loadMoreBtn: {
    padding: '8px 24px',
    background: 'transparent',
    border: `1px solid ${colors.borderLight}`,
    borderRadius: radius.fullPill,
    color: colors.text,
    cursor: 'pointer',
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: '1.4px',
    fontSize: fontSize.caption,
  },
};
