import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import PartyLandingPage from '../../pages/party/PartyLandingPage';

// ---------------------------------------------------------------------------
// MSW
// ---------------------------------------------------------------------------

const server = setupServer(
  http.get('*/api/v1/users/me', () => HttpResponse.json({
    success: true, data: { userId: 'u-001', displayName: 'Test', role: 'Listener', hasCompletedOnboarding: true },
    meta: { apiVersion: 'v1', requestId: 'r', timestamp: new Date().toISOString() }, error: null,
  })),
  http.get('*/api/v1/notifications/unread', () => HttpResponse.json({
    success: true, data: { items: [], hasMore: false },
    meta: { apiVersion: 'v1', requestId: 'r', timestamp: new Date().toISOString() }, error: null,
  })),
  http.post('*/api/v1/parties', () => HttpResponse.json(
    { success: true, data: { roomId: 'room-new', joinCode: 'XYZABC', hostId: 'u-001', name: 'T', currentSongId: null, playbackPositionSec: 0, members: [] },
      meta: { apiVersion: 'v1', requestId: 'r', timestamp: new Date().toISOString() }, error: null },
    { status: 201 },
  )),
  http.post('*/api/v1/parties/:code/join', () => HttpResponse.json({
    success: true, data: { roomId: 'room-join', joinCode: 'ABC123', hostId: 'u-host', name: 'T', currentSongId: null, playbackPositionSec: 0, members: [] },
    meta: { apiVersion: 'v1', requestId: 'r', timestamp: new Date().toISOString() }, error: null,
  })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ accessToken: 'tok', userId: 'u-001', role: 'Listener', setTokens: vi.fn(), clearAuth: vi.fn() })),
}));
vi.mock('../../store/playerStore', () => ({
  usePlayerStore: vi.fn(() => ({ currentSong: null, isPlaying: false, queue: [], play: vi.fn(), pause: vi.fn(), setQueue: vi.fn() })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/party']}>
      <Routes>
        <Route path="/party" element={<PartyLandingPage />} />
        <Route path="/party/:roomId" element={<div>Party Room</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PartyLandingPage', () => {

  it('renders Listening Party heading', () => {
    renderLanding();
    expect(screen.getByRole('heading', { name: /Listening Party/ })).toBeInTheDocument();
  });

  it('renders Tạo phòng mới button', () => {
    renderLanding();
    expect(screen.getByRole('button', { name: /Tạo phòng mới/ })).toBeInTheDocument();
  });

  it('renders Tham gia phòng button', () => {
    renderLanding();
    expect(screen.getByRole('button', { name: /Tham gia phòng/ })).toBeInTheDocument();
  });

  it('opens CreateRoomModal when Tạo phòng mới clicked', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /Tạo phòng mới/ }));
    expect(screen.getByRole('dialog', { name: /Tạo phòng nghe nhạc/ })).toBeInTheDocument();
  });

  it('opens JoinRoomModal when Tham gia phòng clicked', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /Tham gia phòng/ }));
    expect(screen.getByRole('dialog', { name: /Tham gia phòng/ })).toBeInTheDocument();
  });

  it('closes CreateRoomModal when close button clicked', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /Tạo phòng mới/ }));
    // Multiple Đóng buttons may exist (e.g. sidebar) — target the one inside the dialog
    const dialog = screen.getByRole('dialog', { name: /Tạo phòng nghe nhạc/ });
    const closeBtn = dialog.querySelector('button[aria-label="Đóng"]')!;
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('navigates to party room after successful create', async () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /Tạo phòng mới/ }));
    const dialog = screen.getByRole('dialog', { name: /Tạo phòng nghe nhạc/ });
    fireEvent.change(screen.getByRole('textbox', { name: /Tên phòng/ }), { target: { value: 'Test' } });
    // Target submit button inside the dialog to avoid ambiguity with landing card
    fireEvent.click(within(dialog).getByRole('button', { name: /TẠO PHÒNG/i }));
    await waitFor(() => {
      expect(screen.getByText('Party Room')).toBeInTheDocument();
    });
  });

});
