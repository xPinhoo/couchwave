import type { GameUpdate, TriviaHostView, TriviaPlayerView } from './games.js';
import type { Avatar, Reaction } from './lobby.js';
import type {
  AnswerPayload,
  JoinRoomPayload,
  KickPlayerPayload,
  LibraryMovePayload,
  ReactPayload,
  RejoinRoomPayload,
  ResumeScreenPayload,
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
  | 'PLAYER_NOT_FOUND'
  | 'WRONG_PHASE'
  | 'GAME_UNAVAILABLE'
  | 'TOO_FAST';

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorCode; message?: string };

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: Avatar;
  connected: boolean;
}

/** lobby: waiting for players · library: the host is picking a game · playing: in a game */
export type RoomStatus = 'lobby' | 'library' | 'playing';

export interface LobbyState {
  roomCode: string;
  status: RoomStatus;
  players: PublicPlayer[];
  /** The player who controls the room from their phone. */
  leaderId: string | null;
  maxPlayers: number;
  /** False while the TV screen is disconnected (e.g. it was refreshed). */
  screenConnected: boolean;
  /** Index into `GAMES` of the highlighted game in the library. */
  selectedGame: number;
}

/** The TV screen was gone for too long, so the room shut down. */
export type RoomClosedReason = 'SCREEN_LEFT';

export interface CreatedRoom {
  lobby: LobbyState;
  /** Secret the TV keeps to take its room back after a refresh. */
  screenToken: string;
}

export interface JoinedRoom {
  playerId: string;
  /** Secret proof of identity — keep it private and send it with `room:rejoin` after a drop. */
  sessionToken: string;
  lobby: LobbyState;
}

export interface ReactionEvent {
  playerId: string;
  emoji: Reaction;
}

/** Events sent by the TV screen or a phone controller to the server. */
export interface ClientToServerEvents {
  /** TV screen only: creates the room it will display. */
  'room:create': (ack: (res: Result<CreatedRoom>) => void) => void;
  /** TV screen only: takes its room back after a refresh or a dropped connection. */
  'room:resume': (payload: ResumeScreenPayload, ack: (res: Result<CreatedRoom>) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (res: Result<JoinedRoom>) => void) => void;
  /** Reclaims a seat after a dropped connection, within the server's grace period. */
  'room:rejoin': (payload: RejoinRoomPayload, ack: (res: Result<JoinedRoom>) => void) => void;
  /** Leader only, outside games: removes a player and cancels their session. */
  'room:kick': (payload: KickPlayerPayload, ack: (res: Result<null>) => void) => void;
  /** Any player, outside games: a reaction that floats up on the TV. */
  'room:react': (payload: ReactPayload, ack: (res: Result<null>) => void) => void;
  /** Leader only: lobby → games library. */
  'library:open': (ack: (res: Result<null>) => void) => void;
  /** Leader only: move the highlight left or right. */
  'library:move': (payload: LibraryMovePayload, ack: (res: Result<null>) => void) => void;
  /** Leader only: start the highlighted game. */
  'library:select': (ack: (res: Result<null>) => void) => void;
  /** Leader only: games library → lobby (e.g. to wait for more players). */
  'library:close': (ack: (res: Result<null>) => void) => void;
  /** Player only. Answers after the first one, or after the deadline, are ignored. */
  'game:answer': (payload: AnswerPayload, ack: (res: Result<null>) => void) => void;
  /** Leader only: stop the game and go back to the games library. */
  'game:end': (ack: (res: Result<null>) => void) => void;
}

/** Events broadcast by the server. */
export interface ServerToClientEvents {
  'lobby:update': (lobby: LobbyState) => void;
  'room:closed': (reason: RoomClosedReason) => void;
  /** Sent to a player the leader removed, right before they are disconnected. */
  'room:kicked': () => void;
  /** Sent to the TV screen only. */
  'room:reaction': (reaction: ReactionEvent) => void;
  /** Sent to the TV screen only. */
  'game:host': (update: GameUpdate<TriviaHostView>) => void;
  /** Sent to each player individually, with their private view. */
  'game:player': (update: GameUpdate<TriviaPlayerView>) => void;
}
