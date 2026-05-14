import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContextSelector from '../../../features/recommendation/components/ContextSelector';

describe('ContextSelector', () => {
  // ── Rendering ──────────────────────────────────────────────────────────

  it('renders all 5 chips', () => {
    render(<ContextSelector value="none" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '🎵 Tất cả' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🌅 Sáng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '☀️ Chiều' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🌙 Tối' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '🌃 Khuya' })).toBeInTheDocument();
  });

  it('wraps chips in a group with accessible label', () => {
    render(<ContextSelector value="none" onChange={vi.fn()} />);
    expect(screen.getByRole('group', { name: 'Lọc theo thời điểm' })).toBeInTheDocument();
  });

  // ── Active / aria-pressed ─────────────────────────────────────────────

  it('active chip has aria-pressed="true"', () => {
    render(<ContextSelector value="none" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '🎵 Tất cả' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('inactive chips have aria-pressed="false"', () => {
    render(<ContextSelector value="none" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '🌅 Sáng' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '☀️ Chiều' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '🌙 Tối' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '🌃 Khuya' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('morning active — morning chip aria-pressed="true", others false', () => {
    render(<ContextSelector value="morning" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '🌅 Sáng' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '🎵 Tất cả' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('evening active — evening chip is active', () => {
    render(<ContextSelector value="evening" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '🌙 Tối' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('night active — night chip is active', () => {
    render(<ContextSelector value="night" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '🌃 Khuya' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('afternoon active — afternoon chip is active', () => {
    render(<ContextSelector value="afternoon" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '☀️ Chiều' })).toHaveAttribute('aria-pressed', 'true');
  });

  // ── Styling ───────────────────────────────────────────────────────────

  it('active chip has bg-spotify-green and text-near-black', () => {
    render(<ContextSelector value="morning" onChange={vi.fn()} />);
    const btn = screen.getByRole('button', { name: '🌅 Sáng' });
    expect(btn.className).toContain('bg-spotify-green');
    expect(btn.className).toContain('text-near-black');
    expect(btn.className).toContain('font-bold');
  });

  it('inactive chip has bg-mid-dark and text-text-secondary', () => {
    render(<ContextSelector value="none" onChange={vi.fn()} />);
    const btn = screen.getByRole('button', { name: '🌅 Sáng' });
    expect(btn.className).toContain('bg-mid-dark');
    expect(btn.className).toContain('text-text-secondary');
  });

  it('inactive chip does NOT have bg-spotify-green', () => {
    render(<ContextSelector value="none" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '🌅 Sáng' }).className).not.toContain('bg-spotify-green');
  });

  it('all chips have rounded-full', () => {
    render(<ContextSelector value="none" onChange={vi.fn()} />);
    screen.getAllByRole('button').forEach((btn) => {
      expect(btn.className).toContain('rounded-full');
    });
  });

  // ── Interactions ──────────────────────────────────────────────────────

  it('clicking "Sáng" calls onChange with "morning"', () => {
    const onChange = vi.fn();
    render(<ContextSelector value="none" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '🌅 Sáng' }));
    expect(onChange).toHaveBeenCalledWith('morning');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('clicking "Chiều" calls onChange with "afternoon"', () => {
    const onChange = vi.fn();
    render(<ContextSelector value="none" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '☀️ Chiều' }));
    expect(onChange).toHaveBeenCalledWith('afternoon');
  });

  it('clicking "Tối" calls onChange with "evening"', () => {
    const onChange = vi.fn();
    render(<ContextSelector value="none" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '🌙 Tối' }));
    expect(onChange).toHaveBeenCalledWith('evening');
  });

  it('clicking "Khuya" calls onChange with "night"', () => {
    const onChange = vi.fn();
    render(<ContextSelector value="none" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '🌃 Khuya' }));
    expect(onChange).toHaveBeenCalledWith('night');
  });

  it('clicking "Tất cả" calls onChange with "none"', () => {
    const onChange = vi.fn();
    render(<ContextSelector value="morning" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '🎵 Tất cả' }));
    expect(onChange).toHaveBeenCalledWith('none');
  });

  it('clicking already-active chip still calls onChange', () => {
    const onChange = vi.fn();
    render(<ContextSelector value="morning" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '🌅 Sáng' }));
    expect(onChange).toHaveBeenCalledWith('morning');
  });

  it('onChange called exactly once per click', () => {
    const onChange = vi.fn();
    render(<ContextSelector value="none" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '🌅 Sáng' }));
    fireEvent.click(screen.getByRole('button', { name: '☀️ Chiều' }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
