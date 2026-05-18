import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// ---------------------------------------------------------------------------
// Build mock connection and builder BEFORE importing the hook
// All builder methods must return the same builder object for fluent chaining
// ---------------------------------------------------------------------------

const mockOn = vi.fn();
const mockInvoke = vi.fn().mockResolvedValue(undefined);
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockStop = vi.fn().mockResolvedValue(undefined);
const mockOnreconnecting = vi.fn();
const mockOnreconnected = vi.fn();
const mockOnclose = vi.fn();

const mockConnection = {
  on: mockOn,
  invoke: mockInvoke,
  start: mockStart,
  stop: mockStop,
  onreconnecting: mockOnreconnecting,
  onreconnected: mockOnreconnected,
  onclose: mockOnclose,
  state: 1, // HubConnectionState.Connected = 1
};

// Builder: each method must return the builder itself, not the mock function
const mockBuild = vi.fn().mockReturnValue(mockConnection);

// The shared builder object — all chained methods return this exact object
const mockBuilder = {
  withUrl: vi.fn(),
  withAutomaticReconnect: vi.fn(),
  configureLogging: vi.fn(),
  build: mockBuild,
};
// Wire up return values AFTER mockBuilder is defined
mockBuilder.withUrl.mockReturnValue(mockBuilder);
mockBuilder.withAutomaticReconnect.mockReturnValue(mockBuilder);
mockBuilder.configureLogging.mockReturnValue(mockBuilder);

vi.mock('@microsoft/signalr', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@microsoft/signalr');

  // Constructor must be a regular function (not arrow) so `new` works
  function MockHubConnectionBuilder(this: unknown) {
    return mockBuilder;
  }

  return {
    ...actual,
    HubConnectionBuilder: MockHubConnectionBuilder,
    // Keep HubConnectionState values from actual
    HubConnectionState: { Connecting: 0, Connected: 1, Reconnecting: 2, Disconnected: 4 },
    LogLevel: { Warning: 2 },
  };
});

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ---------------------------------------------------------------------------
// Import hook AFTER mocks are wired
// ---------------------------------------------------------------------------
import { usePartyWebSocket } from '../../hooks/usePartyWebSocket';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPartyHook(options: Parameters<typeof usePartyWebSocket>[0]) {
  return renderHook(() => usePartyWebSocket(options), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(MemoryRouter, null, children),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePartyWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStart.mockResolvedValue(undefined);
    mockConnection.state = 1; // Connected
    // Re-wire builder return values after clearAllMocks
    mockBuilder.withUrl.mockReturnValue(mockBuilder);
    mockBuilder.withAutomaticReconnect.mockReturnValue(mockBuilder);
    mockBuilder.configureLogging.mockReturnValue(mockBuilder);
    mockBuild.mockReturnValue(mockConnection);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Connection setup', () => {
    it('builds connection with correct roomId in URL', async () => {
      renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});
      expect(mockBuilder.withUrl).toHaveBeenCalledWith(
        '/hubs/party?roomId=room-123',
        expect.objectContaining({ accessTokenFactory: expect.any(Function) }),
      );
    });

    it('registers reconnect delays [1000, 2000, 4000, 8000, 16000, 30000] — AC7.3.2', async () => {
      renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});
      expect(mockBuilder.withAutomaticReconnect).toHaveBeenCalledWith(
        [1000, 2000, 4000, 8000, 16000, 30000],
      );
    });

    it('calls connection.start() on mount', async () => {
      renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});
      expect(mockStart).toHaveBeenCalledOnce();
    });

    it('calls connection.stop() on unmount', async () => {
      const { unmount } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});
      unmount();
      expect(mockStop).toHaveBeenCalledOnce();
    });

    it('registers event handlers for SYNC_STATE, MEMBER_JOIN, MEMBER_LEAVE, ROOM_CLOSED', async () => {
      renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});
      const registeredEvents = mockOn.mock.calls.map((c) => c[0]);
      expect(registeredEvents).toContain('SYNC_STATE');
      expect(registeredEvents).toContain('MEMBER_JOIN');
      expect(registeredEvents).toContain('MEMBER_LEAVE');
      expect(registeredEvents).toContain('ROOM_CLOSED');
    });
  });

  describe('ROOM_CLOSED navigation — AC7.3.3', () => {
    it('navigates to / when ROOM_CLOSED received', async () => {
      renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      const roomClosedHandler = mockOn.mock.calls.find((c) => c[0] === 'ROOM_CLOSED')![1];
      act(() => { roomClosedHandler(); });
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('SYNC_STATE callback', () => {
    it('calls onSyncState callback when SYNC_STATE received', async () => {
      const onSyncState = vi.fn();
      renderPartyHook({ roomId: 'room-123', isHost: false, onSyncState });
      await act(async () => {});

      const syncStateHandler = mockOn.mock.calls.find((c) => c[0] === 'SYNC_STATE')![1];
      const syncData = {
        type: 'SYNC_STATE' as const,
        songId: 'song-1',
        isPlaying: true,
        positionSec: 42,
        hostId: 'host-x',
        timestamp: new Date().toISOString(),
      };

      act(() => { syncStateHandler(syncData); });
      expect(onSyncState).toHaveBeenCalledWith(syncData);
    });
  });

  describe('sendPlayerAction', () => {
    it('Host can send PLAYER_ACTION via invoke — AC7.2.1 client side', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: true });
      await act(async () => {});

      await act(async () => {
        await result.current.sendPlayerAction({ action: 'PLAY' });
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        'PlayerAction',
        expect.objectContaining({
          type: 'PLAYER_ACTION',
          action: 'PLAY',
          eventId: expect.any(String),
          timestamp: expect.any(String),
        }),
      );
    });

    it('Member cannot send PLAYER_ACTION — AC7.2.2 client side', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      await act(async () => {
        await result.current.sendPlayerAction({ action: 'PLAY' });
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('does not invoke when connection is not Connected', async () => {
      mockConnection.state = 2; // Reconnecting
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: true });
      await act(async () => {});

      await act(async () => {
        await result.current.sendPlayerAction({ action: 'PAUSE' });
      });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('generates unique eventId per invocation', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: true });
      await act(async () => {});

      await act(async () => {
        await result.current.sendPlayerAction({ action: 'PLAY' });
        await result.current.sendPlayerAction({ action: 'PAUSE' });
      });

      const calls = mockInvoke.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0][1].eventId).not.toBe(calls[1][1].eventId);
    });
  });

  describe('Queue — QUEUE_UPDATED event', () => {
    it('registers QUEUE_UPDATED handler on connection', async () => {
      renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});
      const registeredEvents = mockOn.mock.calls.map((c) => c[0]);
      expect(registeredEvents).toContain('QUEUE_UPDATED');
    });

    it('updates queueItems state when QUEUE_UPDATED received', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      const handler = mockOn.mock.calls.find((c) => c[0] === 'QUEUE_UPDATED')![1];
      act(() => {
        handler({ queue: [{ songId: 'song-a', addedByUserId: 'user-1' }] });
      });

      expect(result.current.queueItems).toHaveLength(1);
      expect(result.current.queueItems[0].songId).toBe('song-a');
    });

    it('calls onQueueUpdated callback when QUEUE_UPDATED received', async () => {
      const onQueueUpdated = vi.fn();
      renderPartyHook({ roomId: 'room-123', isHost: false, onQueueUpdated });
      await act(async () => {});

      const handler = mockOn.mock.calls.find((c) => c[0] === 'QUEUE_UPDATED')![1];
      const payload = { queue: [{ songId: 'song-b', addedByUserId: 'user-2' }] };
      act(() => { handler(payload); });

      expect(onQueueUpdated).toHaveBeenCalledWith(payload);
    });

    it('replaces entire queueItems on each QUEUE_UPDATED', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      const handler = mockOn.mock.calls.find((c) => c[0] === 'QUEUE_UPDATED')![1];
      act(() => { handler({ queue: [{ songId: 'song-a', addedByUserId: 'u1' }, { songId: 'song-b', addedByUserId: 'u2' }] }); });
      act(() => { handler({ queue: [{ songId: 'song-c', addedByUserId: 'u3' }] }); });

      expect(result.current.queueItems).toHaveLength(1);
      expect(result.current.queueItems[0].songId).toBe('song-c');
    });

    it('handles null/missing queue field gracefully', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      const handler = mockOn.mock.calls.find((c) => c[0] === 'QUEUE_UPDATED')![1];
      act(() => { handler({ queue: null }); });

      expect(result.current.queueItems).toEqual([]);
    });
  });

  describe('Queue — sendQueueAdd', () => {
    it('invokes QueueAdd with songId and eventId', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      await act(async () => { await result.current.sendQueueAdd('song-xyz'); });

      expect(mockInvoke).toHaveBeenCalledWith(
        'QueueAdd',
        expect.objectContaining({ songId: 'song-xyz', eventId: expect.any(String) }),
      );
    });

    it('does not invoke QueueAdd when disconnected', async () => {
      mockConnection.state = 4; // Disconnected
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      await act(async () => { await result.current.sendQueueAdd('song-xyz'); });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('any member (non-host) can sendQueueAdd', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      await act(async () => { await result.current.sendQueueAdd('song-a'); });

      expect(mockInvoke).toHaveBeenCalledWith('QueueAdd', expect.any(Object));
    });
  });

  describe('Queue — sendQueueRemove', () => {
    it('invokes QueueRemove with songId and eventId', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      await act(async () => { await result.current.sendQueueRemove('song-xyz'); });

      expect(mockInvoke).toHaveBeenCalledWith(
        'QueueRemove',
        expect.objectContaining({ songId: 'song-xyz', eventId: expect.any(String) }),
      );
    });

    it('does not invoke QueueRemove when disconnected', async () => {
      mockConnection.state = 4;
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      await act(async () => { await result.current.sendQueueRemove('song-xyz'); });

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('Queue — sendQueueNext', () => {
    it('Host can invoke QueueNext', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: true });
      await act(async () => {});

      await act(async () => { await result.current.sendQueueNext(); });

      expect(mockInvoke).toHaveBeenCalledWith(
        'QueueNext',
        expect.objectContaining({ eventId: expect.any(String) }),
      );
    });

    it('Member cannot invoke QueueNext', async () => {
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => {});

      await act(async () => { await result.current.sendQueueNext(); });

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('does not invoke QueueNext when disconnected', async () => {
      mockConnection.state = 4;
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: true });
      await act(async () => {});

      await act(async () => { await result.current.sendQueueNext(); });

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('Connection status', () => {
    it('starts as "connecting" before start() resolves', () => {
      mockStart.mockImplementation(() => new Promise(() => {})); // never resolves
      const { result } = renderHook(() => usePartyWebSocket({ roomId: 'room-123', isHost: false }), {
        wrapper: ({ children }: { children: React.ReactNode }) =>
          React.createElement(MemoryRouter, null, children),
      });
      expect(result.current.status).toBe('connecting');
    });

    it('becomes "connected" after start() resolves', async () => {
      mockStart.mockResolvedValue(undefined);
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.status).toBe('connected');
    });

    it('becomes "disconnected" after start() fails', async () => {
      mockStart.mockRejectedValue(new Error('Connection refused'));
      const { result } = renderPartyHook({ roomId: 'room-123', isHost: false });
      await act(async () => { try { await mockStart(); } catch { /* expected */ } });
      expect(result.current.status).toBe('disconnected');
    });
  });
});
