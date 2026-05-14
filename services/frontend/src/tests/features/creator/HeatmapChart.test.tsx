import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeatmapChart from '../../../features/creator/components/HeatmapChart';
import type { HeatmapDropOff } from '../../../types/domain';

const SAMPLE_HEATMAP: HeatmapDropOff[] = [
  { second: 0, count: 8 },
  { second: 12, count: 12 },
  { second: 24, count: 18 },
  { second: 36, count: 25 },
  { second: 48, count: 38 },
  { second: 60, count: 52 },
  { second: 72, count: 65 },
  { second: 84, count: 78 },
  { second: 96, count: 88 },
  { second: 108, count: 90 }, // peak
  { second: 120, count: 82 },
  { second: 132, count: 68 },
  { second: 144, count: 52 },
  { second: 156, count: 40 },
  { second: 168, count: 32 },
  { second: 180, count: 24 },
  { second: 192, count: 18 },
  { second: 204, count: 14 },
  { second: 216, count: 10 },
  { second: 228, count: 7 },
];

describe('HeatmapChart', () => {
  it('renders chart title', () => {
    render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    expect(screen.getByText('Heatmap tỷ lệ bỏ qua (skip)')).toBeInTheDocument();
  });

  it('renders subtitle description', () => {
    render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    expect(screen.getByText('Điểm người nghe hay bỏ qua nhất')).toBeInTheDocument();
  });

  it('returns null when data is empty', () => {
    const { container } = render(<HeatmapChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders heatmap bar with correct aria-label', () => {
    render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    expect(screen.getByRole('img', { name: 'Heatmap bỏ qua theo giây' })).toBeInTheDocument();
  });

  it('renders correct number of heatmap segments', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    const bar = screen.getByRole('img', { name: 'Heatmap bỏ qua theo giây' });
    // Each segment is a div.flex-1 inside the bar (excluding the dashed marker divs)
    const segments = bar.querySelectorAll('.flex-1');
    expect(segments.length).toBe(SAMPLE_HEATMAP.length);
  });

  it('renders peak marker dashed line (warning border)', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    const peakMarker = container.querySelector('[aria-label="Đỉnh bỏ qua"]');
    expect(peakMarker).toBeInTheDocument();
    expect(peakMarker?.className).toContain('border-warning');
    expect(peakMarker?.className).toContain('border-dashed');
  });

  it('renders threshold line with default 30% position', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    const thresholdEl = container.querySelector('[aria-label="Ngưỡng 30%"]');
    expect(thresholdEl).toBeInTheDocument();
    expect((thresholdEl as HTMLElement).style.left).toBe('30%');
  });

  it('renders threshold line at custom thresholdPct', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} thresholdPct={0.5} />);
    const thresholdEl = container.querySelector('[aria-label="Ngưỡng 50%"]');
    expect(thresholdEl).toBeInTheDocument();
    expect((thresholdEl as HTMLElement).style.left).toBe('50%');
  });

  it('threshold line has dashed styling', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    const thresholdEl = container.querySelector('[aria-label="Ngưỡng 30%"]');
    expect(thresholdEl?.className).toContain('border-dashed');
  });

  it('renders x-axis time labels', () => {
    render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    // First label: 0:00
    expect(screen.getByText('0:00')).toBeInTheDocument();
  });

  it('renders legend with "Ít" and "Nhiều" labels', () => {
    render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    expect(screen.getByText('Ít')).toBeInTheDocument();
    expect(screen.getByText('Nhiều')).toBeInTheDocument();
  });

  it('renders legend color gradient divs', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    // Legend has bg-mid-dark, bg-warning/50, bg-warning, bg-negative bands
    expect(container.querySelector('.bg-mid-dark')).toBeInTheDocument();
    expect(container.querySelector('.bg-negative')).toBeInTheDocument();
  });

  it('peak segment has cursor-pointer class', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    const bar = screen.getByRole('img', { name: 'Heatmap bỏ qua theo giây' });
    const segments = bar.querySelectorAll('.flex-1');
    // Peak is at index 9 (count=90)
    expect(segments[9].className).toContain('cursor-pointer');
  });

  it('non-peak segments do not have cursor-pointer', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    const bar = screen.getByRole('img', { name: 'Heatmap bỏ qua theo giây' });
    const segments = bar.querySelectorAll('.flex-1');
    expect(segments[0].className).not.toContain('cursor-pointer');
  });

  it('segment titles include time and count', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    const bar = screen.getByRole('img', { name: 'Heatmap bỏ qua theo giây' });
    const segments = bar.querySelectorAll('.flex-1');
    const firstTitle = segments[0].getAttribute('title');
    expect(firstTitle).toContain('0:00');
    expect(firstTitle).toContain('8 lượt bỏ qua');
  });

  it('peak segment title includes peak count', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    const bar = screen.getByRole('img', { name: 'Heatmap bỏ qua theo giây' });
    const segments = bar.querySelectorAll('.flex-1');
    const peakTitle = segments[9].getAttribute('title');
    expect(peakTitle).toContain('90 lượt bỏ qua');
  });

  it('renders ⚠️ Đỉnh bỏ qua annotation near peak', () => {
    render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    expect(screen.getByText('⚠️ Đỉnh bỏ qua')).toBeInTheDocument();
  });

  it('has two marker lines inside the bar (peak + threshold)', () => {
    const { container } = render(<HeatmapChart data={SAMPLE_HEATMAP} />);
    const bar = screen.getByRole('img', { name: 'Heatmap bỏ qua theo giây' });
    const markers = bar.querySelectorAll('[class*="border-dashed"]');
    expect(markers.length).toBe(2);
  });
});
