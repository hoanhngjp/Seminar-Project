import type { TimeContext } from '../../../types/domain';

interface ContextSelectorProps {
  value: TimeContext | 'none';
  onChange: (ctx: TimeContext | 'none') => void;
}

const CHIPS: { key: TimeContext | 'none'; label: string }[] = [
  { key: 'none',      label: '🎵 Tất cả' },
  { key: 'morning',   label: '🌅 Sáng'   },
  { key: 'afternoon', label: '☀️ Chiều'  },
  { key: 'evening',   label: '🌙 Tối'    },
  { key: 'night',     label: '🌃 Khuya'  },
];

export default function ContextSelector({ value, onChange }: ContextSelectorProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Lọc theo thời điểm">
      {CHIPS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={[
            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
            value === key
              ? 'bg-spotify-green text-near-black font-bold'
              : 'bg-mid-dark text-text-secondary hover:text-text-base',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
