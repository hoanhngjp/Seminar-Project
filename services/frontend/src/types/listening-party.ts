// Listening Party WebSocket Event Contracts
// Generated from API_DESIGN_V2.md — DO NOT modify without updating backend

export type PartyEventType =
  | 'PLAYER_ACTION'
  | 'SYNC_STATE'
  | 'MEMBER_JOIN'
  | 'MEMBER_LEAVE'
  | 'HOST_CHANGED'
  | 'ROOM_CLOSED';

// Client → Server (chỉ Host được gửi PLAYER_ACTION)
export interface PlayerAction {
  type: 'PLAYER_ACTION';
  eventId: string;           // UUID v4 — dedup
  action: 'PLAY' | 'PAUSE' | 'SEEK';
  songId?: string;           // required khi action = PLAY
  positionSec?: number;      // required khi action = SEEK
  timestamp: string;         // ISO 8601
}

// Server → All Clients (broadcast khi Host thay đổi state)
export interface SyncState {
  type: 'SYNC_STATE';
  songId: string;
  isPlaying: boolean;
  positionSec: number;
  hostId: string;
  timestamp: string;         // ISO 8601 — dùng để tính drift
}

// Server → All Clients (khi có người join)
export interface MemberJoin {
  type: 'MEMBER_JOIN';
  userId: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: string;          // ISO 8601
}

// Server → All Clients (khi có người leave hoặc disconnect)
export interface MemberLeave {
  type: 'MEMBER_LEAVE';
  userId: string;
  reason: 'voluntary' | 'timeout' | 'error';
}

// Server → All Clients (khi Host disconnect và có member mới lên Host — Phase 2)
export interface HostChanged {
  type: 'HOST_CHANGED';
  newHostId: string;
  newHostDisplayName: string;
}

// Server → All Clients (khi room đóng)
export interface RoomClosed {
  type: 'ROOM_CLOSED';
  reason: 'host_disconnected' | 'manual';
}

// ── Queue types ───────────────────────────────────────────────────────────────

// One item in the party queue — mirrors backend QueueItemDto
export interface QueueItem {
  songId: string;
  addedByUserId: string;
}

// Server → All Clients (broadcast whenever queue changes: add / remove / next)
export interface QueueUpdated {
  queue: QueueItem[];
}
