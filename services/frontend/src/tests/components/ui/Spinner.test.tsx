import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Spinner from '../../../components/ui/Spinner';
import SkeletonRow from '../../../components/ui/SkeletonRow';

describe('Spinner', () => {
  it('renders with default aria-label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'Đang tải…' })).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<Spinner label="Loading data" />);
    expect(screen.getByRole('status', { name: 'Loading data' })).toBeInTheDocument();
  });

  it('renders sm size class', () => {
    render(<Spinner size="sm" />);
    expect(screen.getByRole('status').className).toContain('w-4');
  });

  it('renders lg size class', () => {
    render(<Spinner size="lg" />);
    expect(screen.getByRole('status').className).toContain('w-10');
  });
});

describe('SkeletonRow', () => {
  it('renders correct number of rows', () => {
    render(<SkeletonRow rows={4} />);
    // 4 cover placeholders
    const covers = document.querySelectorAll('.skeleton-shimmer');
    // each row: 1 cover + 2 text lines = 3 shimmer elements per row
    expect(covers.length).toBe(12);
  });

  it('renders with aria status label', () => {
    render(<SkeletonRow />);
    expect(screen.getByRole('status', { name: 'Đang tải…' })).toBeInTheDocument();
  });

  it('hides cover when showCover=false', () => {
    render(<SkeletonRow rows={2} showCover={false} />);
    // without cover: 2 rows × 2 text lines = 4 shimmer elements
    const shimmers = document.querySelectorAll('.skeleton-shimmer');
    expect(shimmers.length).toBe(4);
  });
});
