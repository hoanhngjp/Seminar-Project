import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open:       boolean;
  onClose:    () => void;
  title?:     string;
  children:   ReactNode;
  /** Max width class, default 'max-w-md' */
  maxWidth?:  string;
}

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
  // Trap focus / scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        data-testid="modal-backdrop"
      />

      {/* Panel */}
      <div
        className={[
          'relative z-10 w-full',
          maxWidth,
          'bg-dark-card rounded-lg shadow-level-3',
          'p-6 flex flex-col gap-4',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          {title && (
            <h2 id="modal-title" className="text-feature-heading text-text-emphasis font-semibold">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto text-text-secondary hover:text-text-base transition-colors"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div>{children}</div>
      </div>
    </div>
  );
}
