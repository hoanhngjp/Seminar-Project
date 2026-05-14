import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SongStatsCard from '../../../features/creator/components/SongStatsCard';

describe('SongStatsCard', () => {
  it('renders the label text', () => {
    render(<SongStatsCard icon="headphones" label="Lượt nghe" value="1,234" />);
    expect(screen.getByText('Lượt nghe')).toBeInTheDocument();
  });

  it('renders the value text', () => {
    render(<SongStatsCard icon="headphones" label="Lượt nghe" value="8.420" />);
    expect(screen.getByText('8.420')).toBeInTheDocument();
  });

  it('renders the Material Symbol icon', () => {
    render(<SongStatsCard icon="headphones" label="Lượt nghe" value="100" />);
    expect(screen.getByText('headphones')).toBeInTheDocument();
  });

  it('renders different icons correctly', () => {
    const { rerender } = render(<SongStatsCard icon="person" label="Người nghe" value="500" />);
    expect(screen.getByText('person')).toBeInTheDocument();
    rerender(<SongStatsCard icon="task_alt" label="Hoàn thành" value="72%" />);
    expect(screen.getByText('task_alt')).toBeInTheDocument();
  });

  it('renders positive trend badge with spotify-green', () => {
    render(
      <SongStatsCard
        icon="headphones"
        label="Lượt nghe"
        value="100"
        trend={{ label: '↑ 8%', positive: true }}
      />,
    );
    const badge = screen.getByText('↑ 8%');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-spotify-green');
    expect(badge.className).toContain('bg-spotify-green/15');
  });

  it('renders negative trend badge with warning color', () => {
    render(
      <SongStatsCard
        icon="task_alt"
        label="Hoàn thành"
        value="72%"
        trend={{ label: '- 2%', positive: false }}
      />,
    );
    const badge = screen.getByText('- 2%');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-warning');
    expect(badge.className).toContain('bg-warning/15');
  });

  it('does not render trend badge when trend is omitted', () => {
    render(<SongStatsCard icon="headphones" label="Lượt nghe" value="100" />);
    expect(screen.queryByText(/↑|↓|-/)).not.toBeInTheDocument();
  });

  it('applies custom valueClass to the value element', () => {
    const { container } = render(
      <SongStatsCard
        icon="task_alt"
        label="Hoàn thành"
        value="72%"
        valueClass="text-spotify-green"
      />,
    );
    const valueEl = container.querySelector('.text-spotify-green.text-\\[24px\\]');
    expect(valueEl).toBeInTheDocument();
    expect(valueEl?.textContent).toBe('72%');
  });

  it('uses default text-text-base when valueClass is not provided', () => {
    const { container } = render(
      <SongStatsCard icon="headphones" label="Lượt nghe" value="100" />,
    );
    const valueEl = container.querySelector('.text-text-base.text-\\[24px\\]');
    expect(valueEl).toBeInTheDocument();
  });

  it('has rounded-[8px] card wrapper', () => {
    const { container } = render(
      <SongStatsCard icon="headphones" label="Lượt nghe" value="100" />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('rounded-[8px]');
    expect(card.className).toContain('bg-dark-surface');
  });

  it('label text is uppercase', () => {
    render(<SongStatsCard icon="headphones" label="Lượt nghe" value="100" />);
    const labelEl = screen.getByText('Lượt nghe');
    expect(labelEl.className).toContain('uppercase');
  });
});
