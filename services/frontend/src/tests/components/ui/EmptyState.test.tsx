import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from '../../../components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState variant="music" title="Chưa có bài hát" />);
    expect(screen.getByText('Chưa có bài hát')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState variant="search" title="Không tìm thấy" description="Thử tìm kiếm khác" />);
    expect(screen.getByText('Thử tìm kiếm khác')).toBeInTheDocument();
  });

  it('does not render description when omitted', () => {
    render(<EmptyState variant="music" title="Title only" />);
    expect(screen.queryByText(/thử/i)).not.toBeInTheDocument();
  });

  it('renders music_note icon for music variant', () => {
    render(<EmptyState variant="music" title="Music" />);
    expect(screen.getByText('music_note')).toBeInTheDocument();
  });

  it('renders search_off icon for search variant', () => {
    render(<EmptyState variant="search" title="Search" />);
    expect(screen.getByText('search_off')).toBeInTheDocument();
  });

  it('renders notifications_off icon for bell variant', () => {
    render(<EmptyState variant="bell" title="Bell" />);
    expect(screen.getByText('notifications_off')).toBeInTheDocument();
  });

  it('renders groups icon for group variant', () => {
    render(<EmptyState variant="group" title="Group" />);
    expect(screen.getByText('groups')).toBeInTheDocument();
  });

  it('renders CTA button when ctaLabel and onCta provided', () => {
    const onCta = vi.fn();
    render(<EmptyState variant="music" title="Empty" ctaLabel="Upload ngay" onCta={onCta} />);
    expect(screen.getByRole('button', { name: 'Upload ngay' })).toBeInTheDocument();
  });

  it('calls onCta when CTA button clicked', () => {
    const onCta = vi.fn();
    render(<EmptyState variant="music" title="Empty" ctaLabel="Upload ngay" onCta={onCta} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload ngay' }));
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it('does not render CTA button when ctaLabel is omitted', () => {
    render(<EmptyState variant="music" title="Empty" onCta={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render CTA button when onCta is omitted', () => {
    render(<EmptyState variant="music" title="Empty" ctaLabel="Action" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('CTA button has spotify-green styling', () => {
    const onCta = vi.fn();
    render(<EmptyState variant="music" title="Empty" ctaLabel="Go" onCta={onCta} />);
    const btn = screen.getByRole('button', { name: 'Go' });
    expect(btn.className).toContain('bg-spotify-green');
    expect(btn.className).toContain('text-near-black');
    expect(btn.className).toContain('rounded-full');
  });

  it('icon container has bg-mid-dark rounded-full', () => {
    const { container } = render(<EmptyState variant="music" title="Music" />);
    const iconWrapper = container.querySelector('.bg-mid-dark.rounded-full');
    expect(iconWrapper).toBeInTheDocument();
  });
});
