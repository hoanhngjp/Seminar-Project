import type { HeatmapDropOff } from '../../../types/domain';

// ─── Helpers (co-located with this component) ─────────────────────────────────

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function heatColor(ratio: number): string {
  if (ratio > 0.75) return 'bg-negative';
  if (ratio > 0.5) return 'bg-warning';
  if (ratio > 0.25) return 'bg-warning/50';
  return 'bg-mid-dark';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface HeatmapChartProps {
  data: HeatmapDropOff[];
  /** Fraction (0–1) of song at which to draw a threshold dashed line. Default: 0.3 */
  thresholdPct?: number;
}

export default function HeatmapChart({ data, thresholdPct = 0.3 }: HeatmapChartProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.count));
  const peakIdx = data.findIndex((d) => d.count === max);
  const totalSec = data[data.length - 1].second + 12;

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

      {/* Heatmap bar */}
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

        {/* Peak marker — dashed warning line */}
        <div
          aria-label="Đỉnh bỏ qua"
          className="absolute top-0 h-full w-px border-l border-dashed border-warning pointer-events-none"
          style={{ left: `${peakPct}%` }}
        />

        {/* Threshold marker — dashed secondary line */}
        <div
          aria-label={`Ngưỡng ${Math.round(thresholdPct * 100)}%`}
          className="absolute top-0 h-full w-px border-l border-dashed border-text-secondary/60 pointer-events-none"
          style={{ left: `${thresholdPct * 100}%` }}
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
