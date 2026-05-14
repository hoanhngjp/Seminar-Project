import type { TimeRange } from '../../../services/analyticsService';

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}

export default function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center gap-2 bg-mid-dark rounded-full p-1 border border-border-muted/30">
      {(['7d', '30d'] as TimeRange[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          aria-pressed={value === r}
          className={[
            'font-bold text-[12px] rounded-full px-4 py-2 transition-colors',
            value === r
              ? 'bg-spotify-green text-near-black'
              : 'text-text-secondary hover:text-text-base',
          ].join(' ')}
        >
          {r === '7d' ? '7 ngày' : '30 ngày'}
        </button>
      ))}
    </div>
  );
}
