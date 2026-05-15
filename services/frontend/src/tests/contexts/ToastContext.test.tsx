import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider, useToast } from '../../contexts/ToastContext';
import type { ToastVariant } from '../../components/ui/Toast';

// Helper component that calls useToast inside the provider
function ShowToastButton({ message = 'Test message', variant = 'success' as ToastVariant }: { message?: string; variant?: ToastVariant }) {
  const { show } = useToast();
  return (
    <button onClick={() => show(message, variant)} data-testid="trigger">
      Show
    </button>
  );
}

function HideToastButton() {
  const { hide } = useToast();
  return (
    <button onClick={hide} data-testid="hide">
      Hide
    </button>
  );
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('ToastProvider', () => {
  it('renders children without toast initially', () => {
    renderWithProvider(<p>child content</p>);
    expect(screen.getByText('child content')).toBeInTheDocument();
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('shows toast after show() is called', () => {
    renderWithProvider(<ShowToastButton message="Hello toast" />);
    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByTestId('toast')).toBeInTheDocument();
    expect(screen.getByText('Hello toast')).toBeInTheDocument();
  });

  it('shows toast with error variant', () => {
    renderWithProvider(<ShowToastButton message="Có lỗi xảy ra" variant="error" />);
    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByTestId('toast')).toBeInTheDocument();
    expect(screen.getByText('Có lỗi xảy ra')).toBeInTheDocument();
  });

  it('shows toast with info variant', () => {
    renderWithProvider(<ShowToastButton message="Thông tin" variant="info" />);
    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByText('Thông tin')).toBeInTheDocument();
  });

  it('hides toast after hide() is called', async () => {
    renderWithProvider(
      <>
        <ShowToastButton message="Visible" />
        <HideToastButton />
      </>,
    );
    fireEvent.click(screen.getByTestId('trigger'));
    expect(screen.getByText('Visible')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hide'));
    await waitFor(() => {
      expect(screen.queryByText('Visible')).not.toBeInTheDocument();
    });
  });

  it('replaces previous toast when show() called again', () => {
    renderWithProvider(<ShowToastButton />);
    const btn = screen.getByTestId('trigger');
    fireEvent.click(btn);
    // Only one toast rendered
    expect(screen.getAllByTestId('toast')).toHaveLength(1);
  });
});

describe('useToast — outside provider', () => {
  it('throws when used outside ToastProvider', () => {
    const consoleError = console.error;
    console.error = () => {};

    expect(() => {
      render(
        <ShowToastButton />,
      );
    }).toThrow('useToast must be used within ToastProvider');

    console.error = consoleError;
  });
});
