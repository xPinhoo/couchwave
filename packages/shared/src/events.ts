import type { GameUpdate, TriviaHostView, TriviaPlayerView } from './games.js';
import type { AnswerPayload, JoinRoomPayload, RejoinRoomPayload } from './schemas.js';

export type ErrorCode =
  | 'INVALID_PAYLOAD'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'GAME_IN_PROGRESS'
  | 'ALREADY_IN_ROOM'
  | 'INVALID_SESSION'
  | 'NOT_HOST'
  | 'NOT_A_PLAYER'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NO_GAME';

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorCode; message?: string };

export interface PublicPlayer {
  id: string;
  name: string;
  connected: boolean;
}

export type RoomStatus = 'lobby' | 'playing';

export interface LobbyState {
  roomCode: string;
  status: RoomStatus;
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
  /** Host only. */
  'game:start': (ack: (res: Result<null>) => void) => void;
  /** Player only. Answers after the first one, or after the deadline, are ignored. */
  'game:answer': (payload: AnswerPayload, ack: (res: Result<null>) => void) => void;
  /** Host only: stop the game and go back to the lobby. */
  'game:end': (ack: (res: Result<null>) => void) => void;
}

/** Events broadcast by the server. */
export interface ServerToClientEvents {
  'lobby:update': (lobby: LobbyState) => void;
  'room:closed': (reason: RoomClosedReason) => void;
  /** Sent to the host screen only. */
  'game:host': (update: GameUpdate<TriviaHostView>) => void;
  /** Sent to each player individually, with their private view. */
  'game:player': (update: GameUpdate<TriviaPlayerView>) => void;
}
