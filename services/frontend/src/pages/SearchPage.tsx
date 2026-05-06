import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchSongs, type SearchResultItem } from '../api/searchApi';
import { useAuthStore } from '../store/authStore';
import AudioPlayer from '../components/Player/AudioPlayer';

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
  const [selectedSong, setSelectedSong] = useState<SearchResultItem | null>(null);

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
    <div style={styles.page}>
      <header style={styles.header}>
        <a href="/" style={styles.backLink}>← Smart Music</a>
      </header>

      <main style={styles.main}>
        <h2 style={styles.title}>Tìm kiếm</h2>

        <div style={styles.searchBox}>
          <span style={styles.searchIcon} aria-hidden="true">🔍</span>
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
              ✕
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
                    onClick={() => setSelectedSong(item)}
                    aria-label={`Phát ${item.title} — ${item.artist}`}
                  >
                    <div style={styles.resultIcon} aria-hidden="true">🎵</div>
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
    padding: '1rem 2rem',
    borderBottom: '1px solid #222',
  },
  backLink: {
    color: '#1db954',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  main: {
    flex: 1,
    padding: '2rem',
    maxWidth: 720,
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    paddingBottom: '6rem',
  },
  title: {
    margin: '0 0 1.5rem',
    fontSize: '1.5rem',
    fontWeight: 600,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 10,
    padding: '0.6rem 1rem',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  searchIcon: {
    fontSize: '1rem',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1rem',
    outline: 'none',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0 0.25rem',
    flexShrink: 0,
  },
  hintText: {
    color: '#555',
    textAlign: 'center',
    padding: '3rem 0',
    margin: 0,
  },
  skeleton: {
    height: 64,
    borderRadius: 8,
    background: '#1a1a1a',
    marginBottom: '0.5rem',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: '3rem 0',
    margin: 0,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  listItem: {
    display: 'flex',
  },
  resultBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '0.75rem 1rem',
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.15s',
  },
  resultIcon: {
    fontSize: '1.4rem',
    flexShrink: 0,
  },
  resultBody: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    margin: 0,
    fontWeight: 600,
    fontSize: '0.9rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  resultMeta: {
    margin: '0.15rem 0 0',
    fontSize: '0.8rem',
    color: '#888',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  albumText: {
    color: '#666',
  },
  loadMoreRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '1.5rem',
  },
  loadMoreBtn: {
    padding: '0.65rem 2rem',
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 500,
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
