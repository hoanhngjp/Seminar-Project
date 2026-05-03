export type PlayerAction = 'PLAY' | 'PAUSE' | 'SEEK' | 'CHANGE_SONG';

export interface PartyMember {
  userId: string;
  displayName: string;
  isHost: boolean;
  joinedAt: string;
}

export interface PlayerState {
  songId: string;
  positionMs: number;
  isPlaying: boolean;
  updatedAt: string;
}

export interface PartyRoom {
  roomId: string;
  joinCode: string;
  hostUserId: string;
  currentSongId: string | null;
  playerState: PlayerState | null;
  members: PartyMember[];
  createdAt: string;
}

// WebSocket message types (SignalR — Week 7)
export interface PlayerActionMessage {
  type: 'PLAYER_ACTION';
  action: PlayerAction;
  songId?: string;
  positionMs?: number;
}

export interface SyncStateMessage {
  type: 'SYNC_STATE';
  playerState: PlayerState;
  members: PartyMember[];
}

export type PartyMessage = PlayerActionMessage | SyncStateMessage;
