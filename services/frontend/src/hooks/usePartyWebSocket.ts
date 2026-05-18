import { useEffect, useRef, useCallback, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '../services/api';
import { useAuthStore } from '../store/authStore';
import type {
  SyncState,
  MemberJoin,
  MemberLeave,
  PlayerAction,
  QueueItem,
  QueueUpdated,
} from '../types/listening-party';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface UsePartyWebSocketOptions {
  roomId: string;
  isHost: boolean;
  onSyncState?: (state: SyncState) => void;
  onMemberJoin?: (data: MemberJoin) => void;
  onMemberLeave?: (data: MemberLeave) => void;
  onQueueUpdated?: (data: QueueUpdated) => void;
}

export interface UsePartyWebSocketResult {
  status: ConnectionStatus;
  queueItems: QueueItem[];
  sendPlayerAction: (action: Omit<PlayerAction, 'type' | 'eventId' | 'timestamp'>) => Promise<void>;
  sendQueueAdd:    (songId: string) => Promise<void>;
  sendQueueRemove: (songId: string) => Promise<void>;
  /** Host only — dequeue next song and advance playback */
  sendQueueNext:   () => Promise<void>;
}

// Reconnect delays: 1s, 2s, 4s, 8s, 16s, 30s (capped) — AC7.3.2
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export function usePartyWebSocket({
  roomId,
  isHost,
  onSyncState,
  onMemberJoin,
  onMemberLeave,
  onQueueUpdated,
}: UsePartyWebSocketOptions): UsePartyWebSocketResult {
  const navigate     = useNavigate();
  const displayName  = useAuthStore((s) => s.displayName);
  const avatarUrl    = useAuthStore((s) => s.avatarUrl);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [status, setStatus]         = useState<ConnectionStatus>('connecting');
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);

  useEffect(() => {
    const params = new URLSearchParams({ roomId });
    if (displayName?.trim()) params.set('displayName', displayName.trim());
    if (avatarUrl?.trim())   params.set('avatarUrl', avatarUrl.trim());
    const hubUrl = `/hubs/party?${params.toString()}`;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getAccessToken() ?? '',
      })
      .withAutomaticReconnect(RECONNECT_DELAYS_MS)
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Mirror server-side values: ping every 15s, timeout after 60s.
    // Prevents spurious "Server timeout elapsed" through YARP proxy (Bug 10).
    connection.serverTimeoutInMilliseconds = 60_000;
    connection.keepAliveIntervalInMilliseconds = 15_000;

    connectionRef.current = connection;

    // ─── Server → Client handlers ─────────────────────────────────────────
    connection.on('SYNC_STATE', (data: SyncState) => {
      onSyncState?.(data);
    });

    connection.on('MEMBER_JOIN', (data: MemberJoin) => {
      onMemberJoin?.(data);
    });

    connection.on('MEMBER_LEAVE', (data: MemberLeave) => {
      onMemberLeave?.(data);
    });

    connection.on('ROOM_CLOSED', () => {
      // AC7.3.3: Room closed → navigate away
      navigate('/');
    });

    connection.on('QUEUE_UPDATED', (data: QueueUpdated) => {
      setQueueItems(data.queue ?? []);
      onQueueUpdated?.(data);
    });

    // ─── Lifecycle ────────────────────────────────────────────────────────
    connection.onreconnecting(() => setStatus('reconnecting'));
    connection.onreconnected(() => setStatus('connected'));
    connection.onclose(() => setStatus('disconnected'));

    connection.start()
      .then(() => setStatus('connected'))
      .catch(() => setStatus('disconnected'));

    return () => {
      connection.stop();
    };
    // onSyncState/onMemberJoin/onMemberLeave intentionally omitted from deps
    // — callers should use stable refs (useCallback) to avoid reconnect loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, navigate]);

  const sendPlayerAction = useCallback(
    async (action: Omit<PlayerAction, 'type' | 'eventId' | 'timestamp'>) => {
      if (!isHost) return; // only Host sends actions

      const conn = connectionRef.current;
      if (!conn || conn.state !== signalR.HubConnectionState.Connected) return;

      const payload: PlayerAction = {
        type: 'PLAYER_ACTION',
        eventId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        ...action,
      };

      await conn.invoke('PlayerAction', payload);
    },
    [isHost],
  );

  const sendQueueAdd = useCallback(async (songId: string) => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) return;
    await conn.invoke('QueueAdd', { songId, eventId: crypto.randomUUID() });
  }, []);

  const sendQueueRemove = useCallback(async (songId: string) => {
    const conn = connectionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) return;
    await conn.invoke('QueueRemove', { songId, eventId: crypto.randomUUID() });
  }, []);

  const sendQueueNext = useCallback(async () => {
    if (!isHost) return; // only Host advances queue
    const conn = connectionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected) return;
    await conn.invoke('QueueNext', { eventId: crypto.randomUUID() });
  }, [isHost]);

  return { status, queueItems, sendPlayerAction, sendQueueAdd, sendQueueRemove, sendQueueNext };
}
