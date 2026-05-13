import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoomPlayer from '../../../features/party/components/RoomPlayer';
import type { Song } from '../../../types/domain';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_SONG: Song = {
  id:         'song-001',
  title:      'Lạc Trôi',
  artist:     'Sơn Tùng M-TP',
  album:      'M-TP Collection',
  duration:   245,
  coverUrl:   'https://picsum.photos/seed/lactroi/300/300',
  isExplicit: false,
};

const DEFAULT_PROPS = {
  song:        MOCK_SONG,
  isPlaying:   false,
  positionSec: 84,
  onPlay:      vi.fn(),
  onPause:     vi.fn(),
  onNext:      vi.fn(),
  onPrev:      vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RoomPlayer', () => {

  describe('Song info', () => {
    it('renders song title', () => {
      render(<RoomPlayer {...DEFAULT_PROPS} isHost={true} />);
      expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    });

    it('renders artist name', () => {
      render(<RoomPlayer {...DEFAULT_PROPS} isHost={true} />);
      expect(screen.getByText('Sơn Tùng M-TP')).toBeInTheDocument();
    });

    it('renders album art with correct alt text', () => {
      render(<RoomPlayer {...DEFAULT_PROPS} isHost={true} />);
      expect(screen.getByAltText(/Ảnh bìa Lạc Trôi/)).toBeInTheDocument();
    });
  });

  describe('Progress bar', () => {
    it('renders time labels', () => {
      render(<RoomPlayer {...DEFAULT_PROPS} isHost={true} />);
      expect(screen.getByText('1:24')).toBeInTheDocument();
      expect(screen.getByText('4:05')).toBeInTheDocument();
    });

    it('renders LIVE badge', () => {
      render(<RoomPlayer {...DEFAULT_PROPS} isHost={true} />);
      expect(screen.getByText('LIVE')).toBeInTheDocument();
    });
  });

  describe('Sync indicator — Host', () => {
    it('shows "Đang phát trực tiếp" for host', () => {
      render(<RoomPlayer {...DEFAULT_PROPS} isHost={true} />);
      expect(screen.getByText(/Đang phát trực tiếp/)).toBeInTheDocument();
    });
  });

  describe('Sync indicator — Member', () => {
    it('shows "Đồng bộ với Host" for member', () => {
      render(<RoomPlayer {...DEFAULT_PROPS} isHost={false} />);
      expect(screen.getByText(/Đồng bộ với Host/)).toBeInTheDocument();
    });
  });

  describe('HostControls integration', () => {
    it('renders active play button for host', () => {
      render(<RoomPlayer {...DEFAULT_PROPS} isHost={true} isPlaying={false} />);
      expect(screen.getByRole('button', { name: /Phát/ })).not.toBeDisabled();
    });

    it('renders disabled play button for member', () => {
      render(<RoomPlayer {...DEFAULT_PROPS} isHost={false} isPlaying={false} />);
      expect(screen.getByRole('button', { name: /Phát/ })).toBeDisabled();
    });
  });

});
