import type { JoinRoomPayload, RejoinRoomPayload } from './schemas.js';

export type ErrorCode =
  | 'INVALID_PAYLOAD'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'GAME_IN_PROGRESS'
  | 'ALREADY_IN_ROOM'
  | 'INVALID_SESSION';

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

export interface JoinedRoom {
  playerId: string;
  /** Secret proof of identity — keep it private and send it with `room:rejoin` after a drop. */
  sessionToken: string;
  lobby: LobbyState;
}

/** Events sent by the host screen or a phone controller to the server. */
export interface ClientToServerEvents {
  'room:create': (ack: (res: Result<LobbyState>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: Result<JoinedRoom>) => void) => void;
  /** Reclaims a seat after a dropped connection, within the server's grace period. */
  'room:rejoin': (payload: RejoinRoomPayload, ack: (res: Result<JoinedRoom>) => void) => void;
}

/** Events broadcast by the server. */
export interface ServerToClientEvents {
  'lobby:update': (lobby: LobbyState) => void;
  'room:closed': (reason: RoomClosedReason) => void;
}
