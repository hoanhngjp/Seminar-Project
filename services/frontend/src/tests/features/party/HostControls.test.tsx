import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HostControls from '../../../features/party/components/HostControls';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HostControls', () => {

  describe('Host view', () => {
    it('renders play button when not playing', () => {
      render(<HostControls isHost isPlaying={false} onPlay={vi.fn()} onPause={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />);
      expect(screen.getByRole('button', { name: /Phát/ })).toBeInTheDocument();
    });

    it('renders pause button when playing', () => {
      render(<HostControls isHost isPlaying={true} onPlay={vi.fn()} onPause={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />);
      expect(screen.getByRole('button', { name: /Tạm dừng/ })).toBeInTheDocument();
    });

    it('calls onPlay when play button clicked — AC7.2.1', () => {
      const onPlay = vi.fn();
      render(<HostControls isHost isPlaying={false} onPlay={onPlay} onPause={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /Phát/ }));
      expect(onPlay).toHaveBeenCalledOnce();
    });

    it('calls onPause when pause button clicked', () => {
      const onPause = vi.fn();
      render(<HostControls isHost isPlaying={true} onPlay={vi.fn()} onPause={onPause} onNext={vi.fn()} onPrev={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /Tạm dừng/ }));
      expect(onPause).toHaveBeenCalledOnce();
    });

    it('calls onNext when next button clicked', () => {
      const onNext = vi.fn();
      render(<HostControls isHost isPlaying={false} onPlay={vi.fn()} onPause={vi.fn()} onNext={onNext} onPrev={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /Bài tiếp theo/ }));
      expect(onNext).toHaveBeenCalledOnce();
    });

    it('calls onPrev when prev button clicked', () => {
      const onPrev = vi.fn();
      render(<HostControls isHost isPlaying={false} onPlay={vi.fn()} onPause={vi.fn()} onNext={vi.fn()} onPrev={onPrev} />);
      fireEvent.click(screen.getByRole('button', { name: /Bài trước/ }));
      expect(onPrev).toHaveBeenCalledOnce();
    });

    it('does NOT show member note for host', () => {
      render(<HostControls isHost isPlaying={false} onPlay={vi.fn()} onPause={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />);
      expect(screen.queryByText(/Chỉ Host mới điều khiển/)).not.toBeInTheDocument();
    });
  });

  describe('Member view — AC7.2.2', () => {
    it('renders disabled play button for member', () => {
      render(<HostControls isHost={false} isPlaying={false} onPlay={vi.fn()} onPause={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />);
      expect(screen.getByRole('button', { name: /Phát/ })).toBeDisabled();
    });

    it('does NOT call onPlay when member clicks play', () => {
      const onPlay = vi.fn();
      render(<HostControls isHost={false} isPlaying={false} onPlay={onPlay} onPause={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />);
      // Button is disabled so fireEvent.click should not trigger
      fireEvent.click(screen.getByRole('button', { name: /Phát/ }));
      expect(onPlay).not.toHaveBeenCalled();
    });

    it('shows "Chỉ Host mới điều khiển" note for member', () => {
      render(<HostControls isHost={false} isPlaying={false} onPlay={vi.fn()} onPause={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />);
      expect(screen.getByText(/Chỉ Host mới điều khiển phát nhạc/)).toBeInTheDocument();
    });
  });

  describe('Queue button', () => {
    it('renders Hàng chờ button', () => {
      render(<HostControls isHost isPlaying={false} onPlay={vi.fn()} onPause={vi.fn()} onNext={vi.fn()} onPrev={vi.fn()} />);
      expect(screen.getByText(/Hàng chờ/)).toBeInTheDocument();
    });
  });

});
