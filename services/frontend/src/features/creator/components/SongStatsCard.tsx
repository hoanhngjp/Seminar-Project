interface TrendProps {
  label: string;
  positive: boolean;
}

interface SongStatsCardProps {
  icon: string;
  label: string;
  value: string;
  trend?: TrendProps;
  valueClass?: string;
}

function TrendBadge({ label, positive }: TrendProps) {
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

export default function SongStatsCard({
  icon,
  label,
  value,
  trend,
  valueClass = 'text-text-base',
}: SongStatsCardProps) {
  return (
    <div className="bg-dark-surface rounded-[8px] p-[20px] pb-[24px] hover:bg-mid-card hover:shadow-level-2 transition-all duration-200 flex flex-col justify-between h-full">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-text-secondary">{icon}</span>
          <div className="text-[12px] font-bold uppercase text-text-secondary tracking-[1.4px]">
            {label}
          </div>
        </div>
        {trend && <TrendBadge {...trend} />}
      </div>
      <div className={`text-[24px] font-bold mt-2 ${valueClass}`}>{value}</div>
    </div>
  );
}
