import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import Toast, { type ToastVariant } from '../components/ui/Toast';

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastState {
  message: string;
  variant: ToastVariant;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string, variant: ToastVariant = 'success') => {
    setToast({ message, variant });
  }, []);

  const hide = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      <Toast
        visible={toast !== null}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'success'}
        onClose={hide}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
