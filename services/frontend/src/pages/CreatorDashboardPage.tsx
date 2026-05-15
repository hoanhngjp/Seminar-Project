import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { fetchHeatmap, fetchSongStats, type TimeRange } from '../services/analyticsService';
import AppShell from '../components/layout/AppShell';
import type { AnalyticsStats, HeatmapDropOff } from '../types/domain';
import TimeRangeSelector from '../features/creator/components/TimeRangeSelector';
import SongStatsCard from '../features/creator/components/SongStatsCard';
import DailyListenersChart from '../features/creator/components/DailyListenersChart';
import HeatmapChart from '../features/creator/components/HeatmapChart';
import CreatorSongTable from '../features/creator/components/CreatorSongTable';
import { MOCK_CREATOR_SONG_ROWS } from '../mocks/data';

// ─── Song options (Creator picks which song to inspect) ──────────────────────

const SONG_OPTIONS = [
  { id: 'song-001', title: 'Lạc Trôi' },
  { id: 'song-003', title: 'Chuyến Xe' },
  { id: 'song-006', title: 'Đưa Nhau Đi Trốn' },
];

// ─── Hardcoded trend badges (static demo — real API would compute these) ─────

const TRENDS = {
  uniqueUsers:    { label: '↑ 8%',  positive: true  },
  totalPlays:     { label: '↑ 12%', positive: true  },
  completionRate: { label: '- 2%',  positive: false },
  todayListeners: { label: '↑ 3%',  positive: true  },
};

function BarChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count));
  // Show max 7 bars for readability
  const display = data.length > 7 ? data.slice(-7) : data;
  const xLabels = [display[0], display[Math.floor(display.length / 2)], display[display.length - 1]].map((d) => {
    const [, month, day] = d.date.split('-');
    return `${parseInt(day)}/${parseInt(month)}`;
  });

  return (
    <div className="bg-dark-surface rounded-[8px] p-lg hover:shadow-level-2 transition-all duration-200 h-[300px] flex flex-col">
      <h2 className="text-[16px] font-bold text-text-base mb-6">Người nghe theo ngày</h2>
      <div className="flex-1 flex items-end justify-between gap-1 pb-6 relative">
        {display.map((d) => {
          const heightPct = max > 0 ? (d.count / max) * 100 : 0;
          return (
            <div
              key={d.date}
              className="flex-1 bg-spotify-green rounded-t-[4px] hover:bg-accent-border transition-colors cursor-pointer"
              style={{ height: `${heightPct}%` }}
              title={`${d.date}: ${d.count.toLocaleString()} lượt`}
            />
          );
        })}
        <div className="absolute bottom-0 w-full flex justify-between text-[12px] text-text-secondary px-0.5">
          {xLabels.map((l) => <span key={l}>{l}</span>)}
        </div>
      </div>
    </div>
  );
}

function DonutChart({ completionRate }: { completionRate: number }) {
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const filled = circumference * completionRate;
  const pct = Math.round(completionRate * 100);

  return (
    <div className="bg-dark-surface rounded-[8px] p-lg hover:shadow-level-2 transition-all duration-200 h-[300px] flex flex-col items-center justify-center relative">
      <div className="absolute top-lg left-lg">
        <h2 className="text-[16px] font-bold text-text-base">Tỷ lệ nghe đủ bài</h2>
      </div>

      <div className="relative w-[160px] h-[160px] mt-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="transparent" stroke="#4d4d4d" strokeWidth="12" />
          <circle
            cx="50" cy="50" r={r}
            fill="transparent"
            stroke="#1ed760"
            strokeWidth="12"
            strokeDasharray={`${filled.toFixed(1)} ${circumference.toFixed(1)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-bold text-text-base leading-none">{pct}%</span>
          <span className="text-[12px] text-text-secondary mt-1">Nghe đủ</span>
        </div>
      </div>

      <div className="mt-6 flex space-x-6 text-[12px] text-text-secondary">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-spotify-green" />
          Nghe đủ bài: {pct}%
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-border-muted" />
          Bỏ qua: {100 - pct}%
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreatorDashboardPage() {
  const navigate = useNavigate();
  const role     = useAuthStore((s) => s.role);

  useEffect(() => {
    if (role !== null && role !== 'Creator' && role !== 'Admin') {
      navigate('/', { replace: true });
    }
  }, [role, navigate]);

  const [selectedSong, setSelectedSong] = useState(SONG_OPTIONS[0]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [timeRange, setTimeRange]       = useState<TimeRange>('7d');

  const [heatmap, setHeatmap] = useState<HeatmapDropOff[]>([]);
  const [stats, setStats]     = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

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
      setError('Không thể tải dữ liệu. Kiểm tra kết nối và thử lại.');
      setHeatmap([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load on mount and when song/timeRange changes
  useEffect(() => {
    if (role === 'Creator' || role === 'Admin') {
      loadAnalytics(selectedSong.id, timeRange);
    }
  }, [selectedSong.id, timeRange, role, loadAnalytics]);

  if (role !== 'Creator' && role !== 'Admin') return null;

  const totalPlays = stats?.dailyListeners.reduce((s, d) => s + d.count, 0) ?? 0;
  const todayCount = stats?.dailyListeners.at(-1)?.count ?? 0;
  const completionRate = stats?.completionRate ?? 0;

  return (
    <AppShell>
      <div className="p-xl max-w-7xl mx-auto space-y-6">

        {/* ── Dashboard Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <h1 className="text-[24px] font-bold text-text-base flex items-center">
              <span className="mr-2">📊</span> Analytics
            </h1>

            {/* Song selector */}
            <div className="relative mt-1" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown((v) => !v)}
                className="bg-mid-dark text-text-base text-[12px] font-bold rounded-full px-4 py-2 flex items-center gap-1 hover:bg-mid-card transition-colors border border-border-muted/30"
              >
                {selectedSong.title}
                <span className="material-symbols-outlined text-[18px]">arrow_drop_down</span>
              </button>

              {showDropdown && (
                <div className="absolute top-full mt-1 left-0 bg-dark-card rounded-[8px] shadow-[rgba(0,0,0,0.5)_0px_8px_24px] border border-border-muted/20 z-50 min-w-[180px] overflow-hidden">
                  {SONG_OPTIONS.map((song) => (
                    <button
                      key={song.id}
                      onClick={() => { setSelectedSong(song); setShowDropdown(false); }}
                      className={[
                        'w-full text-left px-4 py-2.5 text-[14px] hover:bg-mid-dark transition-colors',
                        song.id === selectedSong.id ? 'text-spotify-green font-bold' : 'text-text-base',
                      ].join(' ')}
                    >
                      {song.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Time range pills */}
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div aria-label="Đang tải dữ liệu" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[96px] bg-dark-surface rounded-[8px] animate-shimmer" />
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div role="alert" className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-negative">{error}</p>
            <button
              onClick={() => loadAnalytics(selectedSong.id, timeRange)}
              className="px-6 py-2.5 bg-spotify-green text-near-black font-bold rounded-full hover:scale-105 transition-transform text-sm tracking-wider"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* ── Content ── */}
        {!loading && !error && stats && (
          <>
            {/* KPI Cards */}
            <div
              aria-label="Thống kê bài hát"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <SongStatsCard
                icon="headphones"
                label="Lượt nghe độc nhất"
                value={stats.uniqueUsers.toLocaleString('vi-VN')}
                trend={TRENDS.uniqueUsers}
              />
              <SongStatsCard
                icon="play_circle"
                label="Tổng lượt phát"
                value={totalPlays.toLocaleString('vi-VN')}
                trend={TRENDS.totalPlays}
              />
              <SongStatsCard
                icon="task_alt"
                label="Tỷ lệ nghe đủ bài"
                value={`${Math.round(completionRate * 100)}%`}
                trend={TRENDS.completionRate}
                valueClass="text-spotify-green"
              />
              <SongStatsCard
                icon="trending_up"
                label="Lượt nghe hôm nay"
                value={todayCount.toLocaleString('vi-VN')}
                trend={TRENDS.todayListeners}
              />
            </div>

            {/* Heatmap */}
            <HeatmapChart data={heatmap} />

            {/* Line chart */}
            <DailyListenersChart data={stats.dailyListeners} />

            {/* Bar + Donut */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BarChart data={stats.dailyListeners} />
              <DonutChart completionRate={completionRate} />
            </div>
          </>
        )}

        {/* ── Song Table — always visible for Creator/Admin ── */}
        <section aria-label="Bài hát của tôi" className="pb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[18px] font-bold text-text-base">Bài hát của tôi</h2>
            <button
              onClick={() => navigate('/upload')}
              className="bg-spotify-green text-near-black rounded-full px-5 py-2 text-[13px] font-bold uppercase tracking-[1.4px] hover:scale-105 transition-transform duration-200"
            >
              TẢI LÊN BÀI MỚI
            </button>
          </div>
          <CreatorSongTable
            rows={MOCK_CREATOR_SONG_ROWS.slice(1)}
            onViewAnalytics={(id) => navigate(`/dashboard/songs/${id}`)}
            onUpload={() => navigate('/upload')}
          />
        </section>
      </div>
    </AppShell>
  );
}
