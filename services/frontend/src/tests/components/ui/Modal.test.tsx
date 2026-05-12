import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../../../components/ui/Modal';

describe('Modal', () => {
  it('renders nothing when open=false', () => {
    render(<Modal open={false} onClose={() => {}}><p>Content</p></Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders content when open=true', () => {
    render(<Modal open onClose={() => {}}><p>Modal body</p></Modal>);
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Modal open onClose={() => {}} title="Tạo phòng"><p>body</p></Modal>);
    expect(screen.getByText('Tạo phòng')).toBeInTheDocument();
  });

  it('has role=dialog and aria-modal', () => {
    render(<Modal open onClose={() => {}}><p>body</p></Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}><p>body</p></Modal>);
    fireEvent.click(screen.getByLabelText('Đóng'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}><p>body</p></Modal>);
    fireEvent.click(screen.getByTestId('modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key pressed', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}><p>body</p></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on non-Escape key', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}><p>body</p></Modal>);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
