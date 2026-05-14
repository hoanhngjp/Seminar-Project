import { useState } from 'react';

// ─── Helpers (co-located with this component) ─────────────────────────────────

function buildChartPaths(data: { count: number }[]): {
  line: string;
  area: string;
  pts: { x: number; y: number }[];
} {
  if (data.length < 2) return { line: '', area: '', pts: [] };
  const max = Math.max(...data.map((d) => d.count));
  if (max === 0) return { line: '', area: '', pts: [] };
  const H = 100;
  const W = 100;
  const PAD_TOP = 8;
  const PAD_BOT = 12;
  const usableH = H - PAD_TOP - PAD_BOT;
  const pts = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: PAD_TOP + (1 - d.count / max) * usableH,
  }));
  const linePath = 'M' + pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L');
  const areaPath = `${linePath} L${W},${H} L0,${H} Z`;
  return { line: linePath, area: areaPath, pts };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface DailyListenersChartProps {
  data: { date: string; count: number }[];
  height?: number;
}

export default function DailyListenersChart({ data, height = 240 }: DailyListenersChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.length === 0) return null;

  const { line, area, pts } = buildChartPaths(data);
  const max = Math.max(...data.map((d) => d.count));

  const yLabels = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0].map((v) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v),
  );

  const step = Math.max(1, Math.floor(data.length / 6));
  const xLabels = data
    .filter((_, i) => i % step === 0 || i === data.length - 1)
    .map((d) => {
      const [, month, day] = d.date.split('-');
      return `${parseInt(day)}/${parseInt(month)}`;
    });

  // Width of each hit-area segment in SVG units (0–100)
  const segW = pts.length > 1 ? 100 / (pts.length - 1) : 100;

  return (
    <div className="bg-dark-surface rounded-[8px] p-lg hover:shadow-level-2 transition-all duration-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[16px] font-bold text-text-base">Lượt nghe theo ngày</h2>
      </div>

      <div className="relative w-full flex" style={{ height }}>
        {/* Y-axis */}
        <div className="w-10 flex flex-col justify-between text-[12px] text-text-secondary py-2 border-r border-border-muted/10 pr-2 text-right">
          {yLabels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>

        {/* Graph area */}
        <div className="flex-1 relative ml-2">
          {/* Grid lines */}
          {[0, 33, 66, 90].map((pct) => (
            <div
              key={pct}
              className="absolute w-full border-t border-border-muted/20"
              style={{ top: `${pct}%` }}
            />
          ))}

          {/* SVG chart */}
          <div className="absolute inset-0 pb-6">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="lineGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#1ed760" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#1ed760" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#lineGrad)" />
              <path
                d={line}
                fill="none"
                stroke="#1ed760"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />

              {/* Invisible hit areas — one per data point */}
              {pts.map((p, i) => (
                <rect
                  key={i}
                  x={Math.max(0, p.x - segW / 2)}
                  y={0}
                  width={segW}
                  height={100}
                  fill="transparent"
                  aria-hidden="true"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              ))}

              {/* Highlight dot on hover */}
              {hoveredIdx !== null && pts[hoveredIdx] && (
                <circle
                  cx={pts[hoveredIdx].x}
                  cy={pts[hoveredIdx].y}
                  r={3}
                  fill="#1ed760"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* Hover tooltip */}
            {hoveredIdx !== null && (
              <div
                role="tooltip"
                className="absolute -top-8 bg-dark-card rounded-[8px] px-3 py-1.5 shadow-level-3 whitespace-nowrap text-[12px] text-text-base pointer-events-none z-10"
                style={{
                  left: `${(hoveredIdx / Math.max(data.length - 1, 1)) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {data[hoveredIdx].date}: {data[hoveredIdx].count.toLocaleString('vi-VN')} lượt nghe
              </div>
            )}
          </div>

          {/* X-axis labels */}
          <div className="absolute bottom-0 w-full flex justify-between text-[12px] text-text-secondary pt-2">
            {xLabels.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
