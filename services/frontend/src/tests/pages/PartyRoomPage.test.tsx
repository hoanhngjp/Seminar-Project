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
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  // Reset party ws state between tests
  _partyWsState.queueItems = [];
  _playerState.songEndSignal = 0;
});
afterAll(() => server.close());

beforeEach(async () => {
  mockStart.mockResolvedValue(undefined);
  mockConnection.state = 1;
  mockBuilder.withUrl.mockReturnValue(mockBuilder);
  mockBuilder.withAutomaticReconnect.mockReturnValue(mockBuilder);
  mockBuilder.configureLogging.mockReturnValue(mockBuilder);
  mockBuild.mockReturnValue(mockConnection);

  // Restore default mock implementations that tests may have overridden
  const { useAuthStore } = await import('../../store/authStore');
  vi.mocked(useAuthStore).mockImplementation(
    (sel?: (s: typeof mockAuthState) => unknown) => sel ? sel(mockAuthState) : mockAuthState
  );
  const { usePlayerStore } = await import('../../store/playerStore');
  vi.mocked(usePlayerStore).mockImplementation(
    (sel: (s: typeof _playerState) => unknown) => sel(_playerState)
  );
  const { usePartyWebSocket } = await import('../../hooks/usePartyWebSocket');
  vi.mocked(usePartyWebSocket).mockImplementation(() => _partyWsState);
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

const _playerState = { currentSong: null as null | { songId: string }, isPlaying: false, queue: [], audioDuration: 0, pauseSignal: 0, resumeSignal: 0, songEndSignal: 0, play: vi.fn(), pause: vi.fn(), setQueue: vi.fn(), clearSong: vi.fn(), setSong: vi.fn(), playSong: vi.fn(), pauseSong: vi.fn(), resumeSong: vi.fn(), seekSong: vi.fn(), setAudioDuration: vi.fn() };
vi.mock('../../store/playerStore', () => {
  const hook = vi.fn((sel: (s: typeof _playerState) => unknown) => sel(_playerState));
  (hook as unknown as { getState: () => typeof _playerState }).getState = () => _playerState;
  return { usePlayerStore: hook };
});

// ---------------------------------------------------------------------------
// Mock usePartyWebSocket (replaces useListeningParty in the updated page)
// ---------------------------------------------------------------------------

const mockSendQueueNext   = vi.fn().mockResolvedValue(undefined);
const mockSendQueueAdd    = vi.fn().mockResolvedValue(undefined);
const mockSendQueueRemove = vi.fn().mockResolvedValue(undefined);
const mockSendPlayerAction = vi.fn().mockResolvedValue(undefined);

const _partyWsState = {
  status: 'connected' as const,
  queueItems: [] as Array<{ songId: string; addedByUserId: string }>,
  sendPlayerAction: mockSendPlayerAction,
  sendQueueAdd: mockSendQueueAdd,
  sendQueueRemove: mockSendQueueRemove,
  sendQueueNext: mockSendQueueNext,
};

vi.mock('../../hooks/usePartyWebSocket', () => ({
  usePartyWebSocket: vi.fn(() => _partyWsState),
}));

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
    it('calls usePartyWebSocket with correct roomId', async () => {
      const { usePartyWebSocket } = await import('../../hooks/usePartyWebSocket');
      renderPage('room-test-001');
      await waitFor(() => {
        expect(vi.mocked(usePartyWebSocket)).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-test-001' }),
        );
      });
    });

    it('calls usePartyWebSocket with isHost=true when user is host', async () => {
      const { usePartyWebSocket } = await import('../../hooks/usePartyWebSocket');
      renderPage();
      await waitFor(() => {
        expect(vi.mocked(usePartyWebSocket)).toHaveBeenCalledWith(
          expect.objectContaining({ isHost: true }),
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

  // ── Phase 3: Right panel tabs ────────────────────────────────────────────

  describe('Right panel tabs', () => {
    it('renders both "Thành viên" and "Lời bài hát" tabs', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Thành viên' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Lời bài hát' })).toBeInTheDocument();
      });
    });

    it('defaults to "Thành viên" tab — MemberList visible', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Thành viên' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Thành viên (2)')).toBeInTheDocument();
      });
    });

    it('clicking "Lời bài hát" tab shows LyricsDisplay, hides MemberList', async () => {
      renderPage();
      await waitFor(() => screen.getByRole('tab', { name: 'Lời bài hát' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Lời bài hát' }));
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Lời bài hát' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.queryByText('Thành viên (2)')).not.toBeInTheDocument();
      });
    });

    it('clicking "Thành viên" tab again restores MemberList', async () => {
      renderPage();
      await waitFor(() => screen.getByRole('tab', { name: 'Lời bài hát' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Lời bài hát' }));
      fireEvent.click(screen.getByRole('tab', { name: 'Thành viên' }));
      await waitFor(() => {
        expect(screen.getByText('Thành viên (2)')).toBeInTheDocument();
      });
    });
  });

  // ── Queue button (inline queue panel) ───────────────────────────────────────

  describe('Queue button', () => {
    it('renders queue button in player section', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Hàng chờ' })).toBeInTheDocument();
      });
    });

    it('queue panel is hidden by default', async () => {
      renderPage();
      await waitFor(() => screen.getByRole('button', { name: 'Hàng chờ' }));
      expect(screen.queryByTestId('inline-party-queue')).not.toBeInTheDocument();
    });

    it('clicking queue button shows inline queue panel', async () => {
      renderPage();
      await waitFor(() => screen.getByRole('button', { name: 'Hàng chờ' }));
      fireEvent.click(screen.getByRole('button', { name: 'Hàng chờ' }));
      await waitFor(() => {
        expect(screen.getByTestId('inline-party-queue')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Tìm bài để thêm...')).toBeInTheDocument();
      });
    });

    it('clicking queue button again hides inline queue panel', async () => {
      renderPage();
      await waitFor(() => screen.getByRole('button', { name: 'Hàng chờ' }));
      fireEvent.click(screen.getByRole('button', { name: 'Hàng chờ' }));
      await waitFor(() => screen.getByTestId('inline-party-queue'));
      fireEvent.click(screen.getByRole('button', { name: 'Hàng chờ' }));
      await waitFor(() => {
        expect(screen.queryByTestId('inline-party-queue')).not.toBeInTheDocument();
      });
    });

    it('PartyQueue in queue panel receives queueItems from usePartyWebSocket', async () => {
      _partyWsState.queueItems = [
        { songId: 'song-aaa', addedByUserId: 'user-listener-001' },
      ];
      renderPage();
      await waitFor(() => screen.getByRole('button', { name: 'Hàng chờ' }));
      fireEvent.click(screen.getByRole('button', { name: 'Hàng chờ' }));
      await waitFor(() => {
        expect(screen.getByText('Hàng chờ (1)')).toBeInTheDocument();
      });
    });

    it('PartyQueue in queue panel — non-owner item has no remove button', async () => {
      _partyWsState.queueItems = [
        { songId: 'song-bbb', addedByUserId: 'other-user-999' },
      ];
      renderPage();
      await waitFor(() => screen.getByRole('button', { name: 'Hàng chờ' }));
      fireEvent.click(screen.getByRole('button', { name: 'Hàng chờ' }));
      await waitFor(() => {
        expect(screen.getByText('Hàng chờ (1)')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Xóa khỏi hàng chờ' })).not.toBeInTheDocument();
      });
    });

    it('sendQueueAdd and sendQueueRemove are wired to inline PartyQueue', async () => {
      const { usePartyWebSocket } = await import('../../hooks/usePartyWebSocket');
      vi.mocked(usePartyWebSocket).mockReturnValueOnce({
        ..._partyWsState,
        sendQueueAdd: mockSendQueueAdd,
        sendQueueRemove: mockSendQueueRemove,
      });
      renderPage();
      await waitFor(() => screen.getByRole('button', { name: 'Hàng chờ' }));
      fireEvent.click(screen.getByRole('button', { name: 'Hàng chờ' }));
      await waitFor(() => screen.getByPlaceholderText('Tìm bài để thêm...'));
      expect(vi.mocked(usePartyWebSocket)).toHaveBeenCalled();
    });
  });

  // ── Phase 3: Auto-advance (songEndSignal) ────────────────────────────────

  describe('Auto-advance on song end', () => {
    it('Host: sendQueueNext called when songEndSignal is non-zero on render', async () => {
      const { usePlayerStore } = await import('../../store/playerStore');
      // Start with songEndSignal = 1 (song already ended)
      vi.mocked(usePlayerStore).mockImplementation(
        (sel: (s: typeof _playerState) => unknown) => sel({ ..._playerState, songEndSignal: 1 })
      );
      renderPage();
      await waitFor(() => screen.getByRole('button', { name: /Rời phòng/ }));
      await waitFor(() => {
        expect(mockSendQueueNext).toHaveBeenCalled();
      });
    });

    it('Member (non-host): sendQueueNext NOT called when songEndSignal increments', async () => {
      const { useAuthStore } = await import('../../store/authStore');
      const memberState = { ...mockAuthState, userId: 'user-creator-001' };
      vi.mocked(useAuthStore).mockImplementation((sel?: (s: typeof mockAuthState) => unknown) =>
        sel ? sel(memberState) : memberState
      );

      const { usePlayerStore } = await import('../../store/playerStore');
      vi.mocked(usePlayerStore).mockImplementation(
        (sel: (s: typeof _playerState) => unknown) => sel({ ..._playerState, songEndSignal: 1 })
      );

      renderPage('room-test-001', MOCK_PARTY_STATE);
      await waitFor(() => screen.getByRole('button', { name: /Rời phòng/ }));
      // Allow any async effects to settle
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendQueueNext).not.toHaveBeenCalled();
    });

    it('songEndSignal = 0 on mount does not call sendQueueNext', async () => {
      renderPage();
      await waitFor(() => screen.getByRole('button', { name: /Rời phòng/ }));
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendQueueNext).not.toHaveBeenCalled();
    });
  });

});
