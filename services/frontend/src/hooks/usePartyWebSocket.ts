import { useEffect, useRef, useCallback, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useNavigate } from 'react-router-dom';
import { getAccessToken } from '../services/api';
import type {
  SyncState,
  MemberJoin,
  MemberLeave,
  PlayerAction,
} from '../types/listening-party';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface UsePartyWebSocketOptions {
  roomId: string;
  isHost: boolean;
  onSyncState?: (state: SyncState) => void;
  onMemberJoin?: (data: MemberJoin) => void;
  onMemberLeave?: (data: MemberLeave) => void;
}

export interface UsePartyWebSocketResult {
  status: ConnectionStatus;
  sendPlayerAction: (action: Omit<PlayerAction, 'type' | 'eventId' | 'timestamp'>) => Promise<void>;
}

// Reconnect delays: 1s, 2s, 4s, 8s, 16s, 30s (capped) — AC7.3.2
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export function usePartyWebSocket({
  roomId,
  isHost,
  onSyncState,
  onMemberJoin,
  onMemberLeave,
}: UsePartyWebSocketOptions): UsePartyWebSocketResult {
  const navigate = useNavigate();
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const hubUrl = `/ws/v1/parties/${roomId}`;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getAccessToken() ?? '',
      })
      .withAutomaticReconnect(RECONNECT_DELAYS_MS)
      .configureLogging(signalR.LogLevel.Warning)
      .build();

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

  return { status, sendPlayerAction };
}
