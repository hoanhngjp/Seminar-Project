import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';


// ---------------------------------------------------------------------------
// Mock @microsoft/signalr BEFORE importing the page
// Must use regular function (not arrow) so `new` works — AC7.3.x convention
// ---------------------------------------------------------------------------

const mockOn         = vi.fn();
const mockStart      = vi.fn().mockResolvedValue(undefined);
const mockStop       = vi.fn().mockResolvedValue(undefined);
const mockInvoke     = vi.fn().mockResolvedValue(undefined);
const mockOnreconnecting = vi.fn();
const mockOnreconnected  = vi.fn();
const mockOnclose        = vi.fn();

const mockConnection = {
  on: mockOn, invoke: mockInvoke, start: mockStart, stop: mockStop,
  onreconnecting: mockOnreconnecting, onreconnected: mockOnreconnected, onclose: mockOnclose,
  state: 1, // HubConnectionState.Connected
};

const mockBuild   = vi.fn().mockReturnValue(mockConnection);
const mockBuilder = {
  withUrl: vi.fn(), withAutomaticReconnect: vi.fn(),
  configureLogging: vi.fn(), build: mockBuild,
};
mockBuilder.withUrl.mockReturnValue(mockBuilder);
mockBuilder.withAutomaticReconnect.mockReturnValue(mockBuilder);
mockBuilder.configureLogging.mockReturnValue(mockBuilder);

vi.mock('@microsoft/signalr', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@microsoft/signalr');
  function MockHubConnectionBuilder(this: unknown) { return mockBuilder; }
  return {
    ...actual,
    HubConnectionBuilder: MockHubConnectionBuilder,
    HubConnectionState: { Connecting: 0, Connected: 1, Reconnecting: 2, Disconnected: 4 },
    LogLevel: { Warning: 2 },
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---------------------------------------------------------------------------
// Import page AFTER mocks
// ---------------------------------------------------------------------------

import PartyRoomPage from '../../pages/party/PartyRoomPage';

// ---------------------------------------------------------------------------
// MSW — mock Sidebar dependencies + music API
// ---------------------------------------------------------------------------

const USERS_URL         = 'http://localhost:5000/api/v1/users/me';
const NOTIFICATIONS_URL = 'http://localhost:5000/api/v1/notifications/unread';
const SONG_URL          = 'http://localhost:5000/api/v1/music/songs/song-001';

const server = setupServer(
  http.get(USERS_URL, () => HttpResponse.json({
    success: true, data: { userId: 'user-listener-001', displayName: 'Nghiệp', role: 'Listener', hasCompletedOnboarding: true },
    meta: { apiVersion: 'v1', requestId: 'r1', timestamp: new Date().toISOString() }, error: null,
  })),
  http.get(NOTIFICATIONS_URL, () => HttpResponse.json({
    success: true, data: { items: [], hasMore: false },
    meta: { apiVersion: 'v1', requestId: 'r2', timestamp: new Date().toISOString() }, error: null,
  })),
  http.get(SONG_URL, () => HttpResponse.json({
    success: true,
    data: { id: 'song-001', title: 'Lạc Trôi', artist: 'Sơn Tùng M-TP', album: 'M-TP Collection', duration: 245, coverUrl: 'https://example.com/lactroi.jpg', isExplicit: false },
    meta: { apiVersion: 'v1', requestId: 'r3', timestamp: new Date().toISOString() }, error: null,
  })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => { server.resetHandlers(); vi.clearAllMocks(); });
afterAll(() => server.close());

beforeEach(() => {
  mockStart.mockResolvedValue(undefined);
  mockConnection.state = 1;
  mockBuilder.withUrl.mockReturnValue(mockBuilder);
  mockBuilder.withAutomaticReconnect.mockReturnValue(mockBuilder);
  mockBuilder.configureLogging.mockReturnValue(mockBuilder);
  mockBuild.mockReturnValue(mockConnection);
});

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

const mockAuthState = { accessToken: 'mock-token', userId: 'user-listener-001', role: 'Listener', hasCompletedOnboarding: true, setAuth: vi.fn(), clearAuth: vi.fn() };
vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn((sel?: (s: typeof mockAuthState) => unknown) =>
    sel ? sel(mockAuthState) : mockAuthState
  ),
}));

const _playerState = { currentSong: null as null | { songId: string }, isPlaying: false, queue: [], pauseSignal: 0, resumeSignal: 0, play: vi.fn(), pause: vi.fn(), setQueue: vi.fn(), clearSong: vi.fn(), setSong: vi.fn(), playSong: vi.fn(), pauseSong: vi.fn(), resumeSong: vi.fn(), seekSong: vi.fn() };
vi.mock('../../store/playerStore', () => {
  const hook = vi.fn((sel: (s: typeof _playerState) => unknown) => sel(_playerState));
  (hook as unknown as { getState: () => typeof _playerState }).getState = () => _playerState;
  return { usePlayerStore: hook };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_PARTY_STATE = {
  party: {
    roomId: 'room-test-001', joinCode: 'XK29F1', hostId: 'user-listener-001',
    name: 'Phòng của Nghiệp', currentSongId: 'song-001', playbackPositionSec: 84,
    members: [
      { userId: 'user-listener-001', name: 'Nghiệp', isHost: true,  avatarUrl: 'https://picsum.photos/seed/u001/100/100' },
      { userId: 'user-creator-001',  name: 'Linh',   isHost: false, avatarUrl: 'https://picsum.photos/seed/u002/100/100' },
    ],
  },
  isHost: true,
  currentUserId: 'user-listener-001',
};

function renderPage(
  roomId = 'room-test-001',
  locationState: object = MOCK_PARTY_STATE,
) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: `/party/${roomId}`, state: locationState }]}
    >
      <Routes>
        <Route path="/party/:roomId" element={<PartyRoomPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PartyRoomPage', () => {

  describe('Room header', () => {
    it('renders room name', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Phòng của Nghiệp/)).toBeInTheDocument();
      });
    });

    it('renders join code', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('XK29F1')).toBeInTheDocument();
      });
    });

    it('renders member count', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/2 thành viên/)).toBeInTheDocument();
      });
    });

    it('renders leave button', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Rời phòng/ })).toBeInTheDocument();
      });
    });

    it('navigates to / when leave button is clicked', async () => {
      renderPage();
      await waitFor(() => screen.getByRole('button', { name: /Rời phòng/ }));
      fireEvent.click(screen.getByRole('button', { name: /Rời phòng/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Player section', () => {
    it('renders song title', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Lạc Trôi')).toBeInTheDocument();
      });
    });

    it('renders LIVE badge', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('LIVE')).toBeInTheDocument();
      });
    });

    it('shows "Đang phát trực tiếp" for host', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Đang phát trực tiếp/)).toBeInTheDocument();
      });
    });

    it('shows "Đồng bộ với Host" for member', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      const memberState = { ...mockAuthState, userId: 'user-creator-001' };
      vi.mocked(useAuthStore).mockImplementation((sel?: (s: typeof mockAuthState) => unknown) =>
        sel ? sel(memberState) : memberState
      );
      renderPage('room-test-001', MOCK_PARTY_STATE);
      await waitFor(() => {
        expect(screen.getByText(/Đồng bộ với Host/)).toBeInTheDocument();
      });
    });
  });

  describe('Members section', () => {
    it('renders member list', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Thành viên (2)')).toBeInTheDocument();
      });
    });

    it('shows host badge for host member', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('Chủ phòng')).toBeInTheDocument();
      });
    });
  });

  describe('SignalR connection', () => {
    it('starts SignalR connection on mount', async () => {
      renderPage();
      await waitFor(() => {
        expect(mockStart).toHaveBeenCalledOnce();
      });
    });

    it('uses correct roomId in connection URL', async () => {
      renderPage('room-test-001');
      await waitFor(() => {
        expect(mockBuilder.withUrl).toHaveBeenCalledWith(
          '/hubs/party?roomId=room-test-001',
          expect.anything(),
        );
      });
    });
  });

  describe('No location state', () => {
    it('renders room structure without crashing when no location state provided', async () => {
      renderPage('room-test-001', {});
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Rời phòng/ })).toBeInTheDocument();
      });
    });
  });

});
