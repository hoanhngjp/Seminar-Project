import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import CreateRoomModal from '../../../features/party/components/CreateRoomModal';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const CREATE_URL = 'http://localhost:5000/api/v1/parties';

const successHandler = http.post(CREATE_URL, () =>
  HttpResponse.json(
    {
      success: true,
      data: {
        roomId: 'room-test-001',
        joinCode: 'XK29F1',
        hostId: 'user-001',
        name: 'Test Room',
        currentSongId: null,
        playbackPositionSec: 0,
        members: [],
      },
      meta: { apiVersion: 'v1', requestId: 'r1', timestamp: new Date().toISOString() },
      error: null,
    },
    { status: 201 },
  ),
);

const errorHandler = http.post(CREATE_URL, () =>
  HttpResponse.json(
    { success: false, data: null, meta: { apiVersion: 'v1', requestId: 'r1', timestamp: new Date().toISOString() }, error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
    { status: 500 },
  ),
);

const server = setupServer(successHandler);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModal(onClose = vi.fn(), onCreated = vi.fn()) {
  return render(
    <MemoryRouter>
      <CreateRoomModal onClose={onClose} onCreated={onCreated} />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CreateRoomModal', () => {

  describe('Rendering', () => {
    it('renders modal with title', () => {
      renderModal();
      expect(screen.getByText(/Tạo phòng nghe nhạc/)).toBeInTheDocument();
    });

    it('renders room name input', () => {
      renderModal();
      expect(screen.getByRole('textbox', { name: /Tên phòng/ })).toBeInTheDocument();
    });

    it('renders song search input', () => {
      renderModal();
      expect(screen.getByRole('textbox', { name: /Tìm bài hát/ })).toBeInTheDocument();
    });

    it('renders create button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /TẠO PHÒNG/i })).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Hủy/ })).toBeInTheDocument();
    });

    it('renders close (X) button', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Đóng/ })).toBeInTheDocument();
    });

    it('shows default song list on render', () => {
      renderModal();
      // At least 1 song result visible initially
      expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
    });
  });

  describe('Room name input', () => {
    it('updates room name as user types', () => {
      renderModal();
      const input = screen.getByRole('textbox', { name: /Tên phòng/ });
      fireEvent.change(input, { target: { value: 'Phòng nhạc của tôi' } });
      expect(input).toHaveValue('Phòng nhạc của tôi');
    });
  });

  describe('Song search', () => {
    it('filters song results as user types', () => {
      renderModal();
      const searchInput = screen.getByRole('textbox', { name: /Tìm bài hát/ });
      fireEvent.change(searchInput, { target: { value: 'Vũ' } });
      // Songs with Vũ in artist should appear
      expect(screen.getByText('Từ Hôm Nay')).toBeInTheDocument();
    });

    it('selects a song when result is clicked', () => {
      renderModal();
      const btn = screen.getByText('Lạc Trôi').closest('button')!;
      fireEvent.click(btn);
      // After selection, search input shows selected song
      const searchInput = screen.getByRole('textbox', { name: /Tìm bài hát/ });
      expect((searchInput as HTMLInputElement).value).toContain('Lạc Trôi');
    });
  });

  describe('Validation', () => {
    it('shows error when room name is empty on submit', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /TẠO PHÒNG/i }));
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Vui lòng nhập tên phòng/);
      });
    });
  });

  describe('Submit', () => {
    it('calls onCreated with party data on success', async () => {
      const onCreated = vi.fn();
      renderModal(vi.fn(), onCreated);

      fireEvent.change(screen.getByRole('textbox', { name: /Tên phòng/ }), {
        target: { value: 'Phòng test' },
      });
      fireEvent.click(screen.getByRole('button', { name: /TẠO PHÒNG/i }));

      await waitFor(() => {
        expect(onCreated).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-test-001', joinCode: 'XK29F1' }),
        );
      });
    });

    it('shows error message when API fails', async () => {
      server.use(errorHandler);
      renderModal();

      fireEvent.change(screen.getByRole('textbox', { name: /Tên phòng/ }), {
        target: { value: 'Phòng test' },
      });
      fireEvent.click(screen.getByRole('button', { name: /TẠO PHÒNG/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Không thể tạo phòng/);
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

    it('calls onClose when Hủy button is clicked', () => {
      const onClose = vi.fn();
      renderModal(onClose);
      fireEvent.click(screen.getByRole('button', { name: /Hủy/ }));
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

});
