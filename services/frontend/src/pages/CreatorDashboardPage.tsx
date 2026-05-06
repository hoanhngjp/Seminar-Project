import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  fetchHeatmap,
  fetchSongStats,
  type HeatmapPoint,
  type SongStats,
  type TimeRange,
} from '../api/analyticsApi';

export default function CreatorDashboardPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);

  // RBAC: chỉ Creator và Admin được vào
  useEffect(() => {
    if (role !== null && role !== 'Creator' && role !== 'Admin') {
      navigate('/', { replace: true });
    }
  }, [role, navigate]);

  const [songIdInput, setSongIdInput] = useState('');
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');

  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [stats, setStats] = useState<SongStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (songId: string, range: TimeRange) => {
    setLoading(true);
    setError(null);
    try {
      const [heatmapData, statsData] = await Promise.all([
        fetchHeatmap(songId, range),
        fetchSongStats(songId, range),
      ]);
      setHeatmap(heatmapData);
      setStats(statsData);
    } catch {
      setError('Không thể tải dữ liệu. Kiểm tra Song ID và thử lại.');
      setHeatmap([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSongId) loadAnalytics(activeSongId, timeRange);
  }, [activeSongId, timeRange, loadAnalytics]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = songIdInput.trim();
    if (!trimmed) return;
    setActiveSongId(trimmed);
  };

  if (role !== 'Creator' && role !== 'Admin') return null;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Smart Music</h1>
        <nav style={styles.nav}>
          <a href="/" style={styles.navLink}>Trang chủ</a>
          <span style={styles.navActive}>Dashboard</span>
        </nav>
      </header>

      <main style={styles.main}>
        <h2 style={styles.pageTitle}>Creator Dashboard</h2>

        {/* Song lookup */}
        <form onSubmit={handleSearch} style={styles.searchRow}>
          <input
            value={songIdInput}
            onChange={(e) => setSongIdInput(e.target.value)}
            placeholder="Nhập Song ID để xem analytics..."
            style={styles.songInput}
            aria-label="Song ID"
          />
          <button type="submit" style={styles.searchBtn}>
            Xem Analytics
          </button>
        </form>

        {/* Time range selector */}
        {activeSongId && (
          <div style={styles.timeRangeRow}>
            {(['7d', '30d'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                style={{
                  ...styles.rangeBtn,
                  ...(timeRange === r ? styles.rangeBtnActive : {}),
                }}
                aria-pressed={timeRange === r}
              >
                {r === '7d' ? '7 ngày' : '30 ngày'}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <p style={styles.loadingText} aria-label="Đang tải dữ liệu">
            Đang tải...
          </p>
        )}

        {!loading && error && (
          <p style={styles.errorText} role="alert">
            {error}
          </p>
        )}

        {/* Stats cards */}
        {!loading && stats && (
          <div style={styles.statsGrid} aria-label="Thống kê bài hát">
            <StatCard label="Lượt nghe" value={stats.totalPlays.toLocaleString()} />
            <StatCard label="Lượt bỏ qua" value={stats.totalSkips.toLocaleString()} />
            <StatCard label="Người nghe" value={stats.uniqueListeners.toLocaleString()} />
            <StatCard
              label="Nghe trung bình"
              value={`${stats.avgListenPercent.toFixed(1)}%`}
            />
          </div>
        )}

        {/* Heatmap */}
        {!loading && heatmap.length > 0 && (
          <section style={styles.heatmapSection}>
            <h3 style={styles.sectionTitle}>Drop-off Heatmap</h3>
            <p style={styles.heatmapHint}>
              Đỏ = tỷ lệ bỏ qua cao (&gt; 30%)
            </p>
            <div
              style={styles.heatmapBar}
              aria-label="Heatmap bỏ qua theo giây"
              role="img"
            >
              {heatmap.map((point) => (
                <div
                  key={point.second}
                  title={`Giây ${point.second}: skip ${(point.skipRate * 100).toFixed(1)}%`}
                  style={{
                    ...styles.heatmapCell,
                    background: point.skipRate > 0.3 ? '#e74c3c' : '#1db954',
                    opacity: 0.3 + point.skipRate * 0.7,
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {!loading && !error && !activeSongId && (
          <p style={styles.emptyText}>
            Nhập Song ID ở trên để xem analytics bài hát của bạn.
          </p>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statLabel}>{label}</p>
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
  nav: { display: 'flex', gap: '1.5rem', alignItems: 'center' },
  navLink: { color: '#aaa', textDecoration: 'none', fontSize: '0.9rem' },
  navActive: { color: '#fff', fontSize: '0.9rem', fontWeight: 600 },
  main: {
    flex: 1,
    padding: '2rem',
    maxWidth: 1200,
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  pageTitle: { margin: '0 0 1.5rem', fontSize: '1.75rem', fontWeight: 700 },
  searchRow: { display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' },
  songInput: {
    flex: 1,
    padding: '0.6rem 1rem',
    borderRadius: 8,
    border: '1px solid #333',
    background: '#1a1a1a',
    color: '#fff',
    fontSize: '0.95rem',
  },
  searchBtn: {
    padding: '0.6rem 1.25rem',
    background: '#1db954',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  timeRangeRow: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' },
  rangeBtn: {
    padding: '0.4rem 1rem',
    border: '1px solid #333',
    borderRadius: 6,
    background: 'transparent',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  rangeBtnActive: {
    border: '1px solid #1db954',
    color: '#1db954',
    background: '#1db95422',
  },
  loadingText: { color: '#aaa', textAlign: 'center', padding: '3rem' },
  errorText: { color: '#ff6b6b', textAlign: 'center', padding: '2rem' },
  emptyText: { color: '#555', textAlign: 'center', padding: '4rem', fontSize: '0.95rem' },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  statCard: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '1.25rem',
    textAlign: 'center',
  },
  statValue: { margin: '0 0 0.4rem', fontSize: '1.75rem', fontWeight: 700, color: '#1db954' },
  statLabel: { margin: 0, fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' },
  heatmapSection: { marginTop: '1rem' },
  sectionTitle: { margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 600 },
  heatmapHint: { margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#666' },
  heatmapBar: {
    display: 'flex',
    height: 40,
    borderRadius: 6,
    overflow: 'hidden',
    background: '#111',
  },
  heatmapCell: {
    flex: 1,
    minWidth: 2,
    transition: 'opacity 0.1s',
  },
};
