import type { JoinRoomPayload } from './schemas.js';

export type ErrorCode =
  | 'INVALID_PAYLOAD'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'GAME_IN_PROGRESS'
  | 'ALREADY_IN_ROOM';

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorCode; message?: string };

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
}

export interface LobbyState {
  roomCode: string;
  players: PublicPlayer[];
  maxPlayers: number;
}

export type RoomClosedReason = 'HOST_LEFT';

/** Events sent by the host screen or a phone controller to the server. */
export interface ClientToServerEvents {
  'room:create': (ack: (res: Result<LobbyState>) => void) => void;
  'room:join': (
    payload: JoinRoomPayload,
    ack: (res: Result<{ playerId: string; lobby: LobbyState }>) => void,
  ) => void;
}

/** Events broadcast by the server. */
export interface ServerToClientEvents {
  'lobby:update': (lobby: LobbyState) => void;
  'room:closed': (reason: RoomClosedReason) => void;
}
