import type { GameUpdate, TriviaHostView, TriviaPlayerView } from './games.js';
import type {
  AnswerPayload,
  JoinRoomPayload,
  KickPlayerPayload,
  RejoinRoomPayload,
} from './schemas.js';

export type ErrorCode =
  | 'INVALID_PAYLOAD'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'NAME_TAKEN'
  | 'GAME_IN_PROGRESS'
  | 'ALREADY_IN_ROOM'
  | 'INVALID_SESSION'
  | 'NOT_LEADER'
  | 'NOT_A_PLAYER'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NO_GAME'
  | 'PLAYER_NOT_FOUND';

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
  /** The player who controls the room from their phone. */
  leaderId: string | null;
  maxPlayers: number;
}

/** The TV screen that created the room went away. */
export type RoomClosedReason = 'HOST_LEFT';

export interface JoinedRoom {
  playerId: string;
  /** Secret proof of identity — keep it private and send it with `room:rejoin` after a drop. */
  sessionToken: string;
  lobby: LobbyState;
}

/** Events sent by the TV screen or a phone controller to the server. */
export interface ClientToServerEvents {
  /** TV screen only: creates the room it will display. */
  'room:create': (ack: (res: Result<LobbyState>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: Result<JoinedRoom>) => void) => void;
  /** Reclaims a seat after a dropped connection, within the server's grace period. */
  'room:rejoin': (payload: RejoinRoomPayload, ack: (res: Result<JoinedRoom>) => void) => void;
  /** Leader only, in the lobby: removes a player and cancels their session. */
  'room:kick': (payload: KickPlayerPayload, ack: (res: Result<null>) => void) => void;
  /** Leader only. */
  'game:start': (ack: (res: Result<null>) => void) => void;
  /** Player only. Answers after the first one, or after the deadline, are ignored. */
  'game:answer': (payload: AnswerPayload, ack: (res: Result<null>) => void) => void;
  /** Leader only: stop the game and go back to the lobby. */
  'game:end': (ack: (res: Result<null>) => void) => void;
}

/** Events broadcast by the server. */
export interface ServerToClientEvents {
  'lobby:update': (lobby: LobbyState) => void;
  'room:closed': (reason: RoomClosedReason) => void;
  /** Sent to a player the leader removed, right before they are disconnected. */
  'room:kicked': () => void;
  /** Sent to the TV screen only. */
  'game:host': (update: GameUpdate<TriviaHostView>) => void;
  /** Sent to each player individually, with their private view. */
  'game:player': (update: GameUpdate<TriviaPlayerView>) => void;
}
