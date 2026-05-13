import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NowPlayingOverlay from '../../../features/player/components/NowPlayingOverlay';

// ── Mock song ─────────────────────────────────────────────────────────────────

const MOCK_SONG = {
  songId:   'song-001',
  title:    'Chuyến Xe',
  artist:   'Ngọt',
  coverUrl: 'https://picsum.photos/seed/test/300/300',
};

// ── Default props ─────────────────────────────────────────────────────────────

function renderOverlay(overrides: Partial<Parameters<typeof NowPlayingOverlay>[0]> = {}) {
  const defaults = {
    currentSong:   MOCK_SONG,
    isPlaying:     false,
    currentTime:   84,      // 1:24
    duration:      245,     // 4:05
    loading:       false,
    onTogglePlay:  vi.fn(),
    onSeek:        vi.fn(),
    onClose:       vi.fn(),
  };
  return render(<NowPlayingOverlay {...defaults} {...overrides} />);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('NowPlayingOverlay — render', () => {
  it('renders with role=dialog and data-testid', () => {
    renderOverlay();
    expect(screen.getByTestId('now-playing-overlay')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /now playing/i })).toBeInTheDocument();
  });

  it('displays song title and artist', () => {
    renderOverlay();
    expect(screen.getByText('Chuyến Xe')).toBeInTheDocument();
    expect(screen.getByText('Ngọt')).toBeInTheDocument();
  });

  it('displays formatted time (1:24 / 4:05)', () => {
    renderOverlay();
    expect(screen.getByText('1:24')).toBeInTheDocument();
    expect(screen.getByText('4:05')).toBeInTheDocument();
  });

  it('shows album art when coverUrl provided', () => {
    renderOverlay();
    const img = screen.getByRole('img', { name: 'Chuyến Xe' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', MOCK_SONG.coverUrl);
  });

  it('shows music_note fallback when no coverUrl', () => {
    renderOverlay({ currentSong: { ...MOCK_SONG, coverUrl: undefined } });
    expect(screen.queryByRole('img', { name: 'Chuyến Xe' })).not.toBeInTheDocument();
  });

  it('shows play icon when not playing', () => {
    renderOverlay({ isPlaying: false });
    const btn = screen.getByTestId('overlay-play-btn');
    expect(btn).toHaveAttribute('aria-label', 'Phát');
  });

  it('shows pause icon when playing', () => {
    renderOverlay({ isPlaying: true });
    const btn = screen.getByTestId('overlay-play-btn');
    expect(btn).toHaveAttribute('aria-label', 'Dừng');
  });

  it('disables play button when loading', () => {
    renderOverlay({ loading: true });
    expect(screen.getByTestId('overlay-play-btn')).toBeDisabled();
  });
});

describe('NowPlayingOverlay — controls', () => {
  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderOverlay({ onClose });
    fireEvent.click(screen.getByTestId('overlay-close-btn'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onTogglePlay when play button is clicked', () => {
    const onTogglePlay = vi.fn();
    renderOverlay({ onTogglePlay });
    fireEvent.click(screen.getByTestId('overlay-play-btn'));
    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('calls onSeek when seek bar value changes', () => {
    const onSeek = vi.fn();
    renderOverlay({ onSeek });
    const seekBar = screen.getByTestId('overlay-seekbar');
    fireEvent.change(seekBar, { target: { value: '120' } });
    expect(onSeek).toHaveBeenCalledWith(120);
  });
});

describe('NowPlayingOverlay — tabs', () => {
  it('renders 3 tabs: Lời bài hát, Hàng chờ, Liên quan', () => {
    renderOverlay();
    expect(screen.getByTestId('tab-lyrics')).toBeInTheDocument();
    expect(screen.getByTestId('tab-queue')).toBeInTheDocument();
    expect(screen.getByTestId('tab-related')).toBeInTheDocument();
  });

  it('lyrics tab is active by default', () => {
    renderOverlay();
    expect(screen.getByTestId('tab-lyrics')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-content-lyrics')).toBeInTheDocument();
  });

  it('switches to queue tab on click', () => {
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-queue'));
    expect(screen.getByTestId('tab-queue')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-content-queue')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-content-lyrics')).not.toBeInTheDocument();
  });

  it('switches to related tab on click', () => {
    renderOverlay();
    fireEvent.click(screen.getByTestId('tab-related'));
    expect(screen.getByTestId('tab-related')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('tab-content-related')).toBeInTheDocument();
  });

  it('lyrics tab contains mock lyric lines', () => {
    renderOverlay();
    expect(screen.getByTestId('tab-content-lyrics')).toHaveTextContent('Tôi đã thấy những ngôi sao');
    expect(screen.getByTestId('tab-content-lyrics')).toHaveTextContent('chuyến xe này sẽ đi về đâu');
  });
});
