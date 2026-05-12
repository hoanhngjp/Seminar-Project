interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-4',
};

export default function Spinner({ size = 'md', className = '', label = 'Đang tải…' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={['inline-block', sizeClasses[size], className].filter(Boolean).join(' ')}
    >
      <span
        className={[
          'block w-full h-full rounded-full',
          'border-text-secondary border-t-spotify-green',
          'animate-spin',
        ].join(' ')}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
