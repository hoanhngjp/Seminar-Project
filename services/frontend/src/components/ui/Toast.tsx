import { useEffect, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastProps {
  message:   string;
  variant?:  ToastVariant;
  /** Auto-dismiss after ms. Set 0 to disable. Default 4000. */
  duration?: number;
  onClose?:  () => void;
  visible:   boolean;
}

const variantConfig: Record<ToastVariant, { bg: string; icon: string }> = {
  success: { bg: 'bg-spotify-green text-near-black', icon: 'check_circle' },
  error:   { bg: 'bg-negative text-white',           icon: 'error'         },
  info:    { bg: 'bg-announcement text-white',        icon: 'info'          },
};

export default function Toast({
  message,
  variant  = 'success',
  duration = 4000,
  onClose,
  visible,
}: ToastProps) {
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || duration === 0 || !onClose) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [visible, duration, onClose]);

  if (!rendered) return null;

  const { bg, icon } = variantConfig[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="toast"
      className={[
        'fixed bottom-24 left-1/2 -translate-x-1/2 z-[200]',
        'flex items-center gap-2 px-5 py-3 rounded-full shadow-level-3',
        'text-sm font-semibold',
        'transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none',
        bg,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
        {icon}
      </span>
      {message}
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 hover:opacity-70 transition-opacity"
          aria-label="Đóng thông báo"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  );
}
