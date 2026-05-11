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
import AppShell from '../components/layout/AppShell';
import { colors, font, fontSize, fontWeight, radius, shadows, spacing } from '../styles/tokens';

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
    <AppShell>
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
                    background: point.skipRate > 0.3 ? colors.error : colors.accent,
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
    </AppShell>
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
  main: {
    padding: '2rem',
    width: '100%',
    boxSizing: 'border-box',
  },
  pageTitle: {
    margin: `0 0 ${spacing[4]}px`,
    fontSize: fontSize.section,
    fontWeight: fontWeight.bold,
    fontFamily: font.title,
    color: colors.text,
  },
  searchRow: { display: 'flex', gap: `${spacing[2]}px`, marginBottom: `${spacing[4]}px` },
  songInput: {
    flex: 1,
    padding: '12px 24px',
    borderRadius: radius.fullPill,
    border: 'none',
    boxShadow: shadows.inset,
    background: colors.surfaceMid,
    color: colors.text,
    fontSize: fontSize.body,
    outline: 'none',
  },
  searchBtn: {
    padding: '12px 24px',
    background: colors.accent,
    color: '#000000',
    border: 'none',
    borderRadius: radius.fullPill,
    cursor: 'pointer',
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: '1.4px',
    fontSize: fontSize.caption,
  },
  timeRangeRow: { display: 'flex', gap: `${spacing[2]}px`, marginBottom: `${spacing[4]}px` },
  rangeBtn: {
    padding: '6px 16px',
    border: 'none',
    borderRadius: radius.fullPill,
    background: colors.surfaceMid,
    color: colors.textMuted,
    cursor: 'pointer',
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
  },
  rangeBtnActive: {
    color: '#000000',
    background: colors.accent,
  },
  loadingText: { color: colors.textMuted, textAlign: 'center', padding: `${spacing[6]}px` },
  errorText: { color: colors.error, textAlign: 'center', padding: `${spacing[6]}px` },
  emptyText: { color: colors.textMuted, textAlign: 'center', padding: `${spacing[6]}px`, fontSize: fontSize.body },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: `${spacing[4]}px`,
    marginBottom: `${spacing[6]}px`,
  },
  statCard: {
    background: colors.surface,
    borderRadius: radius.card,
    boxShadow: shadows.medium,
    padding: `${spacing[5]}px`,
    textAlign: 'center',
  },
  statValue: { margin: `0 0 ${spacing[1]}px`, fontSize: '32px', fontWeight: fontWeight.bold, color: colors.text },
  statLabel: { margin: 0, fontSize: fontSize.caption, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' },
  heatmapSection: { marginTop: `${spacing[4]}px` },
  sectionTitle: { margin: `0 0 ${spacing[2]}px`, fontSize: fontSize.feature, fontWeight: fontWeight.bold, fontFamily: font.title },
  heatmapHint: { margin: `0 0 ${spacing[3]}px`, fontSize: fontSize.small, color: colors.textMuted },
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
