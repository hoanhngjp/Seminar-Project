import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimeRangeSelector from '../../../features/creator/components/TimeRangeSelector';

describe('TimeRangeSelector', () => {
  it('renders both 7-day and 30-day buttons', () => {
    render(<TimeRangeSelector value="7d" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '7 ngày' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30 ngày' })).toBeInTheDocument();
  });

  it('active button has aria-pressed="true"', () => {
    render(<TimeRangeSelector value="7d" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '7 ngày' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30 ngày' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('inactive button has aria-pressed="false"', () => {
    render(<TimeRangeSelector value="30d" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '30 ngày' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '7 ngày' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('active button has bg-spotify-green and text-near-black', () => {
    render(<TimeRangeSelector value="7d" onChange={vi.fn()} />);
    const btn = screen.getByRole('button', { name: '7 ngày' });
    expect(btn.className).toContain('bg-spotify-green');
    expect(btn.className).toContain('text-near-black');
  });

  it('inactive button does not have bg-spotify-green', () => {
    render(<TimeRangeSelector value="7d" onChange={vi.fn()} />);
    const btn = screen.getByRole('button', { name: '30 ngày' });
    expect(btn.className).not.toContain('bg-spotify-green');
  });

  it('clicking 7d button calls onChange with "7d"', () => {
    const onChange = vi.fn();
    render(<TimeRangeSelector value="30d" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '7 ngày' }));
    expect(onChange).toHaveBeenCalledWith('7d');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('clicking 30d button calls onChange with "30d"', () => {
    const onChange = vi.fn();
    render(<TimeRangeSelector value="7d" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '30 ngày' }));
    expect(onChange).toHaveBeenCalledWith('30d');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('clicking already-active button still calls onChange', () => {
    const onChange = vi.fn();
    render(<TimeRangeSelector value="7d" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '7 ngày' }));
    expect(onChange).toHaveBeenCalledWith('7d');
  });

  it('wrapper has rounded-full styling', () => {
    const { container } = render(<TimeRangeSelector value="7d" onChange={vi.fn()} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('rounded-full');
  });

  it('buttons have rounded-full and font-bold', () => {
    render(<TimeRangeSelector value="7d" onChange={vi.fn()} />);
    const btn = screen.getByRole('button', { name: '7 ngày' });
    expect(btn.className).toContain('rounded-full');
    expect(btn.className).toContain('font-bold');
  });
});
