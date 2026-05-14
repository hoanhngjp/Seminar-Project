import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { fetchHeatmap, fetchSongStats, type TimeRange } from '../services/analyticsService';
import AppShell from '../components/layout/AppShell';
import type { AnalyticsStats, HeatmapDropOff } from '../types/domain';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Build SVG line + area path from dailyListeners data.
 *  Uses a 100×100 viewBox with 10% vertical padding. */
function buildChartPaths(data: { count: number }[]): { line: string; area: string } {
  if (data.length < 2) return { line: '', area: '' };
  const max = Math.max(...data.map((d) => d.count));
  if (max === 0) return { line: '', area: '' };
  const H = 100;
  const W = 100;
  const PAD_TOP = 8;
  const PAD_BOT = 12; // room for x-axis labels
  const usableH = H - PAD_TOP - PAD_BOT;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: PAD_TOP + (1 - d.count / max) * usableH,
  }));
  const linePath = 'M' + pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  return { line: linePath, area: areaPath };
}

/** Pick Tailwind bg class for a heatmap segment by its intensity ratio (0–1). */
function heatColor(ratio: number): string {
  if (ratio > 0.75) return 'bg-negative';
  if (ratio > 0.5)  return 'bg-warning';
  if (ratio > 0.25) return 'bg-warning/50';
  return 'bg-mid-dark';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrendBadge({ label, positive }: { label: string; positive: boolean }) {
  return (
    <div
      className={[
        'text-[12px] font-bold px-2 py-0.5 rounded-full flex items-center',
        positive
          ? 'bg-spotify-green/15 text-spotify-green'
          : 'bg-warning/15 text-warning',
      ].join(' ')}
    >
      {label}
    </div>
  );
}

function KpiCard({
  label,
  value,
  trend,
  valueClass = 'text-text-base',
}: {
  label: string;
  value: string;
  trend: { label: string; positive: boolean };
  valueClass?: string;
}) {
  return (
    <div className="bg-dark-surface rounded-[8px] p-[20px] pb-[24px] hover:bg-mid-card hover:shadow-level-2 transition-all duration-200 flex flex-col justify-between h-full">
      <div className="flex justify-between items-start mb-2">
        <div className="text-[12px] font-bold uppercase text-text-secondary tracking-[1.4px]">
          {label}
        </div>
        <TrendBadge {...trend} />
      </div>
      <div className={`text-[24px] font-bold mt-2 ${valueClass}`}>{value}</div>
    </div>
  );
}

function SkipHeatmap({ data }: { data: HeatmapDropOff[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count));
  const peakIdx = data.findIndex((d) => d.count === max);
  const totalSec = data[data.length - 1].second + 12;

  // X-axis time labels at 8 evenly-spaced positions
  const xLabels = Array.from({ length: 8 }, (_, i) => {
    const sec = Math.round((i / 7) * (totalSec - 1));
    return formatSeconds(sec);
  });
  const peakSec = data[peakIdx]?.second ?? 0;
  const peakPct = (peakIdx / (data.length - 1)) * 100;

  return (
    <div className="bg-dark-surface rounded-[8px] p-lg hover:shadow-level-2 transition-all duration-200">
      <div className="mb-6">
        <h2 className="text-[16px] font-bold text-text-base">Heatmap tỷ lệ bỏ qua (skip)</h2>
        <p className="text-[12px] text-text-secondary mt-1">Điểm người nghe hay bỏ qua nhất</p>
      </div>

      {/* Bar */}
      <div
        aria-label="Heatmap bỏ qua theo giây"
        role="img"
        className="relative w-full h-[40px] bg-mid-dark rounded-[4px] overflow-hidden flex shadow-inner"
      >
        {data.map((point, i) => {
          const ratio = point.count / max;
          const isPeak = i === peakIdx;
          return (
            <div
              key={point.second}
              title={`${formatSeconds(point.second)}: ${point.count} lượt bỏ qua`}
              className={[
                'h-full flex-1 group relative',
                isPeak ? 'cursor-pointer' : '',
                heatColor(ratio),
              ].join(' ')}
            >
              {isPeak && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:block bg-dark-card rounded-[8px] px-3 py-2 shadow-level-3 z-10 whitespace-nowrap">
                  <div className="text-[12px] font-bold text-text-base">
                    {formatSeconds(point.second)}: {point.count} lượt bỏ qua
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {/* Dashed peak marker */}
        <div
          className="absolute top-0 h-full w-px border-l border-dashed border-warning pointer-events-none"
          style={{ left: `${peakPct}%` }}
        />
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-[12px] text-text-secondary mt-2">
        {xLabels.map((label, i) => {
          const labelSec = Math.round((i / 7) * (totalSec - 1));
          const isPeakLabel = Math.abs(labelSec - peakSec) < 15;
          return (
            <span key={i} className={isPeakLabel ? 'text-warning font-bold relative' : ''}>
              {label}
              {isPeakLabel && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap text-warning text-[12px] font-bold flex flex-col items-center pointer-events-none">
                  <span>⚠️ Đỉnh bỏ qua</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                </div>
              )}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end space-x-2 mt-6">
        <span className="text-[12px] text-text-secondary">Ít</span>
        <div className="flex h-3 rounded-full overflow-hidden w-32 shadow-inner">
          <div className="w-1/4 bg-mid-dark" />
          <div className="w-1/4 bg-warning/50" />
          <div className="w-1/4 bg-warning" />
          <div className="w-1/4 bg-negative" />
        </div>
        <span className="text-[12px] text-text-secondary">Nhiều</span>
      </div>
    </div>
  );
}

function LineChart({
  data,
  timeRange,
}: {
  data: { date: string; count: number }[];
  timeRange: TimeRange;
}) {
  if (data.length === 0) return null;
  const { line, area } = buildChartPaths(data);
  const max = Math.max(...data.map((d) => d.count));

  // Y-axis labels: 0, max/3, 2*max/3, max (rounded)
  const yLabels = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0].map((v) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v),
  );

  // X-axis: show first, middle(s), last date labels
  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d) => {
      const [, month, day] = d.date.split('-');
      return `${parseInt(day)}/${parseInt(month)}`;
    });

  return (
    <div className="bg-dark-surface rounded-[8px] p-lg hover:shadow-level-2 transition-all duration-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[16px] font-bold text-text-base">Lượt nghe theo ngày</h2>
        <span className="bg-mid-dark text-text-secondary text-[12px] font-bold rounded-full px-3 py-1 border border-border-muted/30">
          {timeRange === '7d' ? '7 ngày' : '30 ngày'}
        </span>
      </div>

      <div className="relative w-full h-[240px] flex">
        {/* Y-axis */}
        <div className="w-10 flex flex-col justify-between text-[12px] text-text-secondary py-2 border-r border-border-muted/10 pr-2 text-right">
          {yLabels.map((l) => <span key={l}>{l}</span>)}
        </div>

        {/* Graph */}
        <div className="flex-1 relative ml-2">
          {/* Grid lines */}
          {[0, 33, 66, 90].map((pct) => (
            <div key={pct} className="absolute w-full border-t border-border-muted/20" style={{ top: `${pct}%` }} />
          ))}

          {/* SVG */}
          <div className="absolute inset-0 pb-6">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#1ed760" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#1ed760" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#lineGrad)" />
              <path d={line} fill="none" stroke="#1ed760" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>

          {/* X-axis labels */}
          <div className="absolute bottom-0 w-full flex justify-between text-[12px] text-text-secondary pt-2">
            {xLabels.map((l) => <span key={l}>{l}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

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
          <div className="flex items-center gap-2 bg-mid-dark rounded-full p-1 border border-border-muted/30">
            {(['7d', '30d'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                aria-pressed={timeRange === r}
                className={[
                  'font-bold text-[12px] rounded-full px-4 py-2 transition-colors',
                  timeRange === r
                    ? 'bg-spotify-green text-near-black'
                    : 'text-text-secondary hover:text-text-base',
                ].join(' ')}
              >
                {r === '7d' ? '7 ngày' : '30 ngày'}
              </button>
            ))}
          </div>
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
              <KpiCard
                label="Lượt nghe độc nhất"
                value={stats.uniqueUsers.toLocaleString('vi-VN')}
                trend={TRENDS.uniqueUsers}
              />
              <KpiCard
                label="Tổng lượt phát"
                value={totalPlays.toLocaleString('vi-VN')}
                trend={TRENDS.totalPlays}
              />
              <KpiCard
                label="Tỷ lệ nghe đủ bài"
                value={`${Math.round(completionRate * 100)}%`}
                trend={TRENDS.completionRate}
                valueClass="text-spotify-green"
              />
              <KpiCard
                label="Lượt nghe hôm nay"
                value={todayCount.toLocaleString('vi-VN')}
                trend={TRENDS.todayListeners}
              />
            </div>

            {/* Heatmap */}
            <SkipHeatmap data={heatmap} />

            {/* Line chart */}
            <LineChart data={stats.dailyListeners} timeRange={timeRange} />

            {/* Bar + Donut */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
              <BarChart data={stats.dailyListeners} />
              <DonutChart completionRate={completionRate} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
