import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import JoinRoomModal from '../../../features/party/components/JoinRoomModal';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const JOIN_URL = 'http://localhost:5000/api/v1/parties/:joinCode/join';

const successHandler = http.post(JOIN_URL, () =>
  HttpResponse.json({
    success: true,
    data: {
      roomId:              'room-test-001',
      joinCode:            'ABC123',
      hostId:              'user-host-001',
      name:                'Phòng test',
      currentSongId:       'song-001',
      playbackPositionSec: 42,
      members:             [],
    },
    meta: { apiVersion: 'v1', requestId: 'r1', timestamp: new Date().toISOString() },
    error: null,
  }),
);

const errorHandler = http.post(JOIN_URL, () =>
  HttpResponse.json(
    { success: false, data: null, meta: { apiVersion: 'v1', requestId: 'r1', timestamp: new Date().toISOString() }, error: { code: 'ROOM_NOT_FOUND', message: 'Not found' } },
    { status: 404 },
  ),
);

const server = setupServer(successHandler);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModal(onClose = vi.fn(), onJoined = vi.fn()) {
  return render(
    <MemoryRouter>
      <JoinRoomModal onClose={onClose} onJoined={onJoined} />
    </MemoryRouter>,
  );
}

function getBoxes() {
  return screen.getAllByRole('textbox');
}

function fillCode(code: string) {
  const boxes = getBoxes();
  code.split('').forEach((char, i) => {
    fireEvent.change(boxes[i], { target: { value: char } });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JoinRoomModal', () => {

  describe('Rendering', () => {
    it('renders modal with title', () => {
      renderModal();
      expect(screen.getByText('Tham gia phòng')).toBeInTheDocument();
    });

    it('renders 6 character input boxes', () => {
      renderModal();
      const boxes = getBoxes();
      expect(boxes).toHaveLength(6);
    });

    it('renders join button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /THAM GIA/i })).toBeInTheDocument();
    });

    it('renders close button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Đóng/ })).toBeInTheDocument();
    });

    it('renders helper text', () => {
      renderModal();
      expect(screen.getByText(/Nhờ Host gửi mã/)).toBeInTheDocument();
    });
  });

  describe('Code input', () => {
    it('accept characters and updates value', () => {
      renderModal();
      const boxes = getBoxes();
      fireEvent.change(boxes[0], { target: { value: 'A' } });
      expect(boxes[0]).toHaveValue('A');
    });

    it('join button disabled when code is incomplete', () => {
      renderModal();
      const joinBtn = screen.getByRole('button', { name: /THAM GIA/i });
      expect(joinBtn).toBeDisabled();
    });

    it('join button enabled when 6 chars filled', () => {
      renderModal();
      fillCode('ABC123');
      const joinBtn = screen.getByRole('button', { name: /THAM GIA/i });
      expect(joinBtn).not.toBeDisabled();
    });

    it('shows preview card when 6 chars are filled', () => {
      renderModal();
      fillCode('ABC123');
      expect(screen.getByLabelText('Thông tin phòng')).toBeInTheDocument();
    });
  });

  describe('Submit', () => {
    it('calls onJoined with party data on success', async () => {
      const onJoined = vi.fn();
      renderModal(vi.fn(), onJoined);
      fillCode('ABC123');
      fireEvent.click(screen.getByRole('button', { name: /THAM GIA/i }));

      await waitFor(() => {
        expect(onJoined).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-test-001' }),
        );
      });
    });

    it('shows error when API returns 404', async () => {
      server.use(errorHandler);
      renderModal();
      fillCode('XXXXXX');
      fireEvent.click(screen.getByRole('button', { name: /THAM GIA/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Mã phòng không hợp lệ/);
      });
    });
  });

  describe('Close', () => {
    it('calls onClose when X button is clicked', () => {
      const onClose = vi.fn();
      renderModal(onClose);
      fireEvent.click(screen.getByRole('button', { name: /Đóng/ }));
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

});
