import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import { useAuthStore } from '../../store/authStore';
import TimeRangeSelector from '../../features/creator/components/TimeRangeSelector';
import SongStatsCard from '../../features/creator/components/SongStatsCard';
import DailyListenersChart from '../../features/creator/components/DailyListenersChart';
import HeatmapChart from '../../features/creator/components/HeatmapChart';
import { MOCK_SONG_DETAIL, MOCK_HEATMAP, MOCK_DAILY_STATS } from '../../mocks/data';

export default function CreatorSongAnalyticsPage() {
  const role = useAuthStore((s) => s.role);

  // AC: role guard — only Creator or Admin
  if (role !== 'Creator' && role !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  const song = MOCK_SONG_DETAIL;
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');

  return (
    <AppShell>
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-2 text-sm text-text-secondary mb-6" data-testid="breadcrumb">
        <Link to="/dashboard" className="hover:text-text-base hover:underline">
          Dashboard
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-text-base font-medium truncate">{song.title}</span>
      </nav>

      {/* ── Song info card ── */}
      <div className="flex items-center gap-4 bg-dark-surface rounded-[8px] p-4 mb-6" data-testid="song-info-card">
        <img
          src={song.coverUrl}
          alt={song.title}
          className="w-16 h-16 rounded object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-text-base font-bold text-[18px] truncate">{song.title}</h1>
          {song.genreName && (
            <span className="inline-block mt-1 bg-mid-dark text-text-secondary text-xs px-2 py-0.5 rounded">
              {song.genreName}
            </span>
          )}
        </div>
        <div className="flex-shrink-0">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6" data-testid="kpi-grid">
        <SongStatsCard
          icon="headphones"
          value="15,420"
          label="Lượt nghe"
          trend={{ label: '+12% so với tuần trước', positive: true }}
        />
        <SongStatsCard
          icon="person"
          value="8,930"
          label="Người nghe"
          trend={{ label: '+8% so với tuần trước', positive: true }}
        />
        <SongStatsCard
          icon="task_alt"
          value="72%"
          label="Tỉ lệ hoàn thành"
          trend={{ label: '-2% so với tuần trước', positive: false }}
        />
      </div>

      {/* ── Daily chart ── */}
      <div className="bg-dark-surface rounded-[8px] p-4 mb-6" data-testid="daily-chart-section">
        <h2 className="text-text-base font-semibold mb-4">Lượt nghe theo ngày</h2>
        <DailyListenersChart data={MOCK_DAILY_STATS} />
      </div>

      {/* ── Heatmap ── */}
      <div className="bg-dark-surface rounded-[8px] p-4" data-testid="heatmap-section">
        <h2 className="text-text-base font-semibold mb-4">Điểm thoát nghe</h2>
        <HeatmapChart data={MOCK_HEATMAP} />
      </div>
    </AppShell>
  );
}
