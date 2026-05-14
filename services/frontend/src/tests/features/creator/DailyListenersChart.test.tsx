import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DailyListenersChart from '../../../features/creator/components/DailyListenersChart';

const SAMPLE_DATA = [
  { date: '2026-05-07', count: 1240 },
  { date: '2026-05-08', count: 1580 },
  { date: '2026-05-09', count: 2100 },
  { date: '2026-05-10', count: 1870 },
  { date: '2026-05-11', count: 2340 },
  { date: '2026-05-12', count: 3100 },
  { date: '2026-05-13', count: 2760 },
];

describe('DailyListenersChart', () => {
  it('renders the chart title', () => {
    render(<DailyListenersChart data={SAMPLE_DATA} />);
    expect(screen.getByText('Lượt nghe theo ngày')).toBeInTheDocument();
  });

  it('returns null when data is empty', () => {
    const { container } = render(<DailyListenersChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders SVG chart when data is provided', () => {
    const { container } = render(<DailyListenersChart data={SAMPLE_DATA} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders area and line paths in SVG', () => {
    const { container } = render(<DailyListenersChart data={SAMPLE_DATA} />);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2); // area + line
  });

  it('renders x-axis date labels', () => {
    render(<DailyListenersChart data={SAMPLE_DATA} />);
    // First date: 7/5, last date: 13/5
    expect(screen.getByText('7/5')).toBeInTheDocument();
    expect(screen.getByText('13/5')).toBeInTheDocument();
  });

  it('renders y-axis labels with k suffix for large values', () => {
    render(<DailyListenersChart data={SAMPLE_DATA} />);
    // max = 3100 → "3.1k"
    expect(screen.getByText('3.1k')).toBeInTheDocument();
    // min = 0
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders hit-area rects per data point', () => {
    const { container } = render(<DailyListenersChart data={SAMPLE_DATA} />);
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(SAMPLE_DATA.length);
  });

  it('tooltip is not visible initially', () => {
    render(<DailyListenersChart data={SAMPLE_DATA} />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip with correct date and count on hover', () => {
    const { container } = render(<DailyListenersChart data={SAMPLE_DATA} />);
    const rects = container.querySelectorAll('rect');
    fireEvent.mouseEnter(rects[0]);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toContain('2026-05-07');
    expect(tooltip.textContent).toContain('lượt nghe');
  });

  it('shows tooltip for the correct data point index', () => {
    const { container } = render(<DailyListenersChart data={SAMPLE_DATA} />);
    const rects = container.querySelectorAll('rect');
    // Hover the last rect (index 6 = 2026-05-13)
    fireEvent.mouseEnter(rects[6]);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('2026-05-13');
  });

  it('hides tooltip on mouse leave', () => {
    const { container } = render(<DailyListenersChart data={SAMPLE_DATA} />);
    const rects = container.querySelectorAll('rect');
    fireEvent.mouseEnter(rects[0]);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(rects[0]);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders highlight circle on hover', () => {
    const { container } = render(<DailyListenersChart data={SAMPLE_DATA} />);
    const rects = container.querySelectorAll('rect');
    fireEvent.mouseEnter(rects[0]);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
  });

  it('applies custom height prop', () => {
    const { container } = render(<DailyListenersChart data={SAMPLE_DATA} height={300} />);
    const heightEl = container.querySelector('[style]') as HTMLElement;
    expect(heightEl?.style.height).toBe('300px');
  });

  it('renders with single data point gracefully (no crash)', () => {
    const { container } = render(
      <DailyListenersChart data={[{ date: '2026-05-07', count: 500 }]} />,
    );
    // Should render container but SVG paths may be empty
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders y-axis values as plain numbers for small counts', () => {
    const smallData = [
      { date: '2026-05-07', count: 10 },
      { date: '2026-05-08', count: 20 },
    ];
    render(<DailyListenersChart data={smallData} />);
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
