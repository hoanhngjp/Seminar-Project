import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toast from '../../../components/ui/Toast';

describe('Toast', () => {
  it('renders message when visible', () => {
    render(<Toast visible message="Upload thành công!" />);
    expect(screen.getByText('Upload thành công!')).toBeInTheDocument();
  });

  it('does not render when not visible', () => {
    render(<Toast visible={false} message="Hidden" />);
    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  it('renders success variant with green background class', () => {
    render(<Toast visible message="OK" variant="success" />);
    expect(screen.getByTestId('toast').className).toContain('bg-spotify-green');
  });

  it('renders error variant with negative color class', () => {
    render(<Toast visible message="Lỗi" variant="error" />);
    expect(screen.getByTestId('toast').className).toContain('bg-negative');
  });

  it('renders info variant with announcement color class', () => {
    render(<Toast visible message="Info" variant="info" />);
    expect(screen.getByTestId('toast').className).toContain('bg-announcement');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<Toast visible message="Có thể đóng" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Đóng thông báo'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button when onClose is not provided', () => {
    render(<Toast visible message="No close" />);
    expect(screen.queryByLabelText('Đóng thông báo')).not.toBeInTheDocument();
  });

  it('has role=status for screen readers', () => {
    render(<Toast visible message="Screen reader" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
