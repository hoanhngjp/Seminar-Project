import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterPills from '../../../features/notifications/components/FilterPills';

describe('FilterPills — rendering', () => {
  it('renders all three filter pills', () => {
    render(<FilterPills active="all" unreadCount={0} onChange={vi.fn()} />);
    expect(screen.getByTestId('filter-pill-all')).toBeInTheDocument();
    expect(screen.getByTestId('filter-pill-unread')).toBeInTheDocument();
    expect(screen.getByTestId('filter-pill-new_release')).toBeInTheDocument();
  });

  it('renders correct labels', () => {
    render(<FilterPills active="all" unreadCount={0} onChange={vi.fn()} />);
    expect(screen.getByText('Tất cả')).toBeInTheDocument();
    expect(screen.getByText('Chưa đọc')).toBeInTheDocument();
    expect(screen.getByText('Bài hát mới')).toBeInTheDocument();
  });

  it('marks active pill with aria-pressed=true', () => {
    render(<FilterPills active="unread" unreadCount={2} onChange={vi.fn()} />);
    expect(screen.getByTestId('filter-pill-unread')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('filter-pill-all')).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows unread count badge when unreadCount > 0', () => {
    render(<FilterPills active="all" unreadCount={5} onChange={vi.fn()} />);
    expect(screen.getByTestId('unread-count-badge')).toHaveTextContent('5');
  });

  it('hides unread count badge when unreadCount = 0', () => {
    render(<FilterPills active="all" unreadCount={0} onChange={vi.fn()} />);
    expect(screen.queryByTestId('unread-count-badge')).not.toBeInTheDocument();
  });

  it('shows 99+ when unread count exceeds 99', () => {
    render(<FilterPills active="all" unreadCount={100} onChange={vi.fn()} />);
    expect(screen.getByTestId('unread-count-badge')).toHaveTextContent('99+');
  });

  it('has group aria-label', () => {
    render(<FilterPills active="all" unreadCount={0} onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Lọc thông báo' })).toBeInTheDocument();
  });
});

describe('FilterPills — interactions', () => {
  it('calls onChange with "all" when Tất cả is clicked', () => {
    const onChange = vi.fn();
    render(<FilterPills active="unread" unreadCount={2} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('filter-pill-all'));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('calls onChange with "unread" when Chưa đọc is clicked', () => {
    const onChange = vi.fn();
    render(<FilterPills active="all" unreadCount={0} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('filter-pill-unread'));
    expect(onChange).toHaveBeenCalledWith('unread');
  });

  it('calls onChange with "new_release" when Bài hát mới is clicked', () => {
    const onChange = vi.fn();
    render(<FilterPills active="all" unreadCount={0} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('filter-pill-new_release'));
    expect(onChange).toHaveBeenCalledWith('new_release');
  });
});
