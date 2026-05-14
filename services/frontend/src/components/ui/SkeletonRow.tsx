interface SkeletonRowProps {
  /** Number of rows to render */
  rows?: number;
  /** Show cover art placeholder on left */
  showCover?: boolean;
  className?: string;
}

export default function SkeletonRow({ rows = 3, showCover = true, className = '' }: SkeletonRowProps) {
  return (
    <div
      role="status"
      aria-label="Đang tải…"
      className={['space-y-3', className].filter(Boolean).join(' ')}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2">
          {showCover && (
            <div className="w-10 h-10 rounded-[6px] bg-mid-dark skeleton-shimmer flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-mid-dark skeleton-shimmer rounded-full w-3/4" />
            <div className="h-2.5 bg-mid-dark skeleton-shimmer rounded-full w-1/2" />
          </div>
        </div>
      ))}
      <span className="sr-only">Đang tải…</span>
    </div>
  );
}
