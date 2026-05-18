import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LyricsDisplay from '../../../features/player/components/LyricsDisplay';

const SAMPLE_LRC = [
  '[00:05.00]Tôi đã thấy những ngôi sao',
  '[00:10.00]Sáng lên trong mắt em',
  '[00:15.00]Và chuyến xe này sẽ đi về đâu',
  '[00:20.00]Khi mà hai ta không còn chung lối',
].join('\n');

describe('LyricsDisplay — empty state', () => {
  it('renders "..." when lyrics is undefined', () => {
    render(<LyricsDisplay positionSec={0} />);
    expect(screen.getByTestId('lyrics-empty')).toBeInTheDocument();
    expect(screen.getByTestId('lyrics-empty')).toHaveTextContent('...');
  });

  it('renders "..." when lyrics is empty string', () => {
    render(<LyricsDisplay lyrics="" positionSec={0} />);
    expect(screen.getByTestId('lyrics-empty')).toBeInTheDocument();
  });

  it('renders "..." for lyrics with no parseable LRC lines', () => {
    render(<LyricsDisplay lyrics="Not an LRC file" positionSec={0} />);
    expect(screen.getByTestId('lyrics-empty')).toBeInTheDocument();
  });
});

describe('LyricsDisplay — parsed LRC', () => {
  it('renders all lyric lines', () => {
    render(<LyricsDisplay lyrics={SAMPLE_LRC} positionSec={0} />);
    expect(screen.getByTestId('lyrics-lines')).toBeInTheDocument();
    expect(screen.getByText('Tôi đã thấy những ngôi sao')).toBeInTheDocument();
    expect(screen.getByText('Sáng lên trong mắt em')).toBeInTheDocument();
    expect(screen.getByText('Và chuyến xe này sẽ đi về đâu')).toBeInTheDocument();
    expect(screen.getByText('Khi mà hai ta không còn chung lối')).toBeInTheDocument();
  });

  it('no active line before first timestamp', () => {
    render(<LyricsDisplay lyrics={SAMPLE_LRC} positionSec={3} />);
    expect(screen.queryByTestId('lyrics-active-line')).not.toBeInTheDocument();
  });

  it('first line active at exactly its timestamp', () => {
    render(<LyricsDisplay lyrics={SAMPLE_LRC} positionSec={5} />);
    expect(screen.getByTestId('lyrics-active-line')).toHaveTextContent('Tôi đã thấy những ngôi sao');
  });

  it('second line active between first and third timestamps', () => {
    render(<LyricsDisplay lyrics={SAMPLE_LRC} positionSec={12} />);
    expect(screen.getByTestId('lyrics-active-line')).toHaveTextContent('Sáng lên trong mắt em');
  });

  it('last line active past final timestamp', () => {
    render(<LyricsDisplay lyrics={SAMPLE_LRC} positionSec={999} />);
    expect(screen.getByTestId('lyrics-active-line')).toHaveTextContent('Khi mà hai ta không còn chung lối');
  });

  it('active line has emphasis styling', () => {
    render(<LyricsDisplay lyrics={SAMPLE_LRC} positionSec={5} />);
    const active = screen.getByTestId('lyrics-active-line');
    expect(active.className).toContain('text-text-emphasis');
  });

  it('inactive lines have muted styling', () => {
    render(<LyricsDisplay lyrics={SAMPLE_LRC} positionSec={5} />);
    const lines = screen.getAllByText(/Sáng lên trong mắt em/);
    expect(lines[0].className).toContain('text-text-secondary');
  });

  it('supports [mm:ss] format without centiseconds', () => {
    const lrc = '[01:30]Dòng không có centiseconds';
    render(<LyricsDisplay lyrics={lrc} positionSec={90} />);
    expect(screen.getByTestId('lyrics-active-line')).toHaveTextContent('Dòng không có centiseconds');
  });

  it('ignores LRC metadata lines (no timestamp text)', () => {
    const lrc = '[ti:Title]\n[ar:Artist]\n[00:05.00]Câu đầu tiên';
    render(<LyricsDisplay lyrics={lrc} positionSec={5} />);
    expect(screen.queryByText('[ti:Title]')).not.toBeInTheDocument();
    expect(screen.getByText('Câu đầu tiên')).toBeInTheDocument();
  });
});
