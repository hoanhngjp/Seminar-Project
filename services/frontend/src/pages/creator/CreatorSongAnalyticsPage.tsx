import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import { useAuthStore } from '../../store/authStore';
import TimeRangeSelector from '../../features/creator/components/TimeRangeSelector';
import SongStatsCard from '../../features/creator/components/SongStatsCard';
import DailyListenersChart from '../../features/creator/components/DailyListenersChart';
import HeatmapChart from '../../features/creator/components/HeatmapChart';
import { fetchHeatmap, fetchSongStats, type TimeRange } from '../../services/analyticsService';
import { getSong } from '../../services/musicService';
import type { HeatmapDropOff, AnalyticsStats } from '../../types/domain';

export default function CreatorSongAnalyticsPage() {
  const { songId } = useParams<{ songId: string }>();
  const role = useAuthStore((s) => s.role);

  if (role !== 'Creator' && role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  const [songTitle, setSongTitle] = useState('');
  const [songCover, setSongCover] = useState('');
  const [songGenre, setSongGenre] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [heatmap, setHeatmap] = useState<HeatmapDropOff[]>([]);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load song metadata
  useEffect(() => {
    if (!songId) return;
    getSong(songId).then((s) => {
      setSongTitle((s as any).title ?? '');
      setSongCover((s as any).coverUrl ?? '');
      setSongGenre((s as any).genreName ?? '');
    }).catch(() => {});
  }, [songId]);

  const loadAnalytics = useCallback(async (id: string, range: TimeRange) => {
    setLoading(true);
    setError(null);
    try {
      const [heatmapData, statsData] = await Promise.all([
        fetchHeatmap(id, range),
        fetchSongStats(id, range),
      ]);
      setHeatmap(heatmapData);
      setStats(statsData);
    } catch {
      setError('Không thể tải dữ liệu. Kiểm tra kết nối và thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (songId) loadAnalytics(songId, timeRange);
  }, [songId, timeRange, loadAnalytics]);

  const totalPlays = stats?.dailyListeners.reduce((s, d) => s + d.count, 0) ?? 0;
  const uniqueListeners = stats?.uniqueUsers ?? 0;
  const completionRate = stats?.completionRate ?? 0;

  return (
    <AppShell>
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-text-secondary mb-6" data-testid="breadcrumb">
        <Link to="/dashboard" className="hover:text-text-base hover:underline">
          Dashboard
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-text-base font-medium truncate">{songTitle || songId}</span>
      </nav>

      {/* ── Song info card ── */}
      <div className="flex items-center gap-4 bg-dark-surface rounded-[8px] p-4 mb-6" data-testid="song-info-card">
        {songCover && (
          <img src={songCover} alt={songTitle} className="w-16 h-16 rounded object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-text-base font-bold text-[18px] truncate">{songTitle || songId}</h1>
          {songGenre && (
            <span className="inline-block mt-1 bg-mid-dark text-text-secondary text-xs px-2 py-0.5 rounded">
              {songGenre}
            </span>
          )}
        </div>
        <div className="flex-shrink-0">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[96px] bg-dark-surface rounded-[8px] animate-shimmer" />
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-negative">{error}</p>
          <button
            onClick={() => songId && loadAnalytics(songId, timeRange)}
            className="px-6 py-2.5 bg-spotify-green text-near-black font-bold rounded-full hover:scale-105 transition-transform text-sm"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* ── KPI cards ── */}
      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="kpi-grid">
            <SongStatsCard
              icon="headphones"
              value={totalPlays.toLocaleString('vi-VN')}
              label="Lượt nghe"
              trend={{ label: '', positive: true }}
            />
            <SongStatsCard
              icon="person"
              value={uniqueListeners.toLocaleString('vi-VN')}
              label="Người nghe"
              trend={{ label: '', positive: true }}
            />
            <SongStatsCard
              icon="task_alt"
              value={`${Math.round(completionRate * 100)}%`}
              label="Tỉ lệ hoàn thành"
              trend={{ label: '', positive: completionRate >= 0.5 }}
            />
          </div>

          {/* ── Daily chart ── */}
          <div className="bg-dark-surface rounded-[8px] p-4 mb-6" data-testid="daily-chart-section">
            <h2 className="text-text-base font-semibold mb-4">Lượt nghe theo ngày</h2>
            <DailyListenersChart data={stats.dailyListeners} />
          </div>

          {/* ── Heatmap ── */}
          <div className="bg-dark-surface rounded-[8px] p-4" data-testid="heatmap-section">
            <h2 className="text-text-base font-semibold mb-4">Điểm thoát nghe</h2>
            <HeatmapChart data={heatmap} />
          </div>
        </>
      )}
    </AppShell>
  );
}
