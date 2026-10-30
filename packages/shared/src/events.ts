import type { DrawHostView, DrawOptions, DrawPlayerView, Stroke } from './draw.js';
import type { GameUpdate, TriviaHostView, TriviaOptions, TriviaPlayerView } from './games.js';
import type { LibraryCursor } from './library.js';
import type { PhoneHostView, PhoneOptions, PhonePlayerView, SketchOp } from './phone.js';
import type { Avatar, Reaction } from './lobby.js';
import type {
  AnswerPayload,
  ChooseWordPayload,
  GuessPayload,
  JoinRoomPayload,
  KickPlayerPayload,
  LibraryMovePayload,
  PhoneDonePayload,
  PhoneTextPayload,
  ReactPayload,
  ReadyPayload,
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

/**
 * lobby: waiting for players · library: the host is picking a game ·
 * setup: settings and ready-up for the chosen game · playing: in a game
 */
export type RoomStatus = 'lobby' | 'library' | 'setup' | 'playing';

/** The pre-game screen: the host's settings for the chosen game and who has pressed Ready. */
export type GameSetup =
  | { gameId: 'trivia'; options: TriviaOptions; readyIds: string[] }
  | { gameId: 'draw'; options: DrawOptions; readyIds: string[] }
  | { gameId: 'phone'; options: PhoneOptions; readyIds: string[] };

/** What the TV shows during a game. */
export type HostView = TriviaHostView | DrawHostView | PhoneHostView;

/** What one phone shows during a game. */
export type PlayerView = TriviaPlayerView | DrawPlayerView | PhonePlayerView;

export interface LobbyState {
  roomCode: string;
  status: RoomStatus;
  players: PublicPlayer[];
  /** The player who controls the room from their phone. */
  leaderId: string | null;
  maxPlayers: number;
  /** False while the TV screen is disconnected (e.g. it was refreshed). */
  screenConnected: boolean;
  /** Where the leader is in the games library: the tab shown and the focused tab or game. */
  library: LibraryCursor;
  /** Set while status is 'setup' or 'playing'; the last settings are kept for the next round. */
  setup: GameSetup | null;
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
  /** Leader only: move the focus to the neighbouring tab or game, like a TV remote. */
  'library:move': (payload: LibraryMovePayload, ack: (res: Result<null>) => void) => void;
  /** Leader only, OK: show the focused tab's games, or open the focused game's setup. */
  'library:select': (ack: (res: Result<null>) => void) => void;
  /** Leader only: games library → lobby (e.g. to wait for more players). */
  'library:close': (ack: (res: Result<null>) => void) => void;
  /** Leader only, during setup: change the settings (this un-readies the leader). */
  'setup:options': (payload: GameSetup['options'], ack: (res: Result<null>) => void) => void;
  /**
   * Any player, during setup. For the leader, ready means "settings confirmed". The game
   * starts as soon as every connected player is ready.
   */
  'setup:ready': (payload: ReadyPayload, ack: (res: Result<null>) => void) => void;
  /** Leader only: setup → games library. */
  'setup:cancel': (ack: (res: Result<null>) => void) => void;
  /** Player only. Answers after the first one, or after the deadline, are ignored. */
  'game:answer': (payload: AnswerPayload, ack: (res: Result<null>) => void) => void;
  /** Leader only: stop the game and go back to the games library. */
  'game:end': (ack: (res: Result<null>) => void) => void;
  /** Draw & Guess, the artist while choosing: picks one of their word choices. */
  'draw:choose': (payload: ChooseWordPayload, ack: (res: Result<null>) => void) => void;
  /**
   * Draw & Guess, the artist while drawing: a new stroke or more points for one in progress.
   * Fire and forget: these arrive many times a second.
   */
  'draw:stroke': (stroke: Stroke) => void;
  /** The artist: removes their last stroke. */
  'draw:undo': () => void;
  /** The artist: wipes the canvas. */
  'draw:clear': () => void;
  /** Draw & Guess, everyone but the artist while drawing. Feedback arrives in the player view. */
  'draw:guess': (payload: GuessPayload, ack: (res: Result<null>) => void) => void;
  /**
   * Drawing Phone, while writing or guessing: the text so far. Fire and forget, sent as the
   * player types, so whatever is there when time runs out counts.
   */
  'phone:text': (payload: PhoneTextPayload) => void;
  /** Drawing Phone, while writing: a random phrase, which also becomes the draft. */
  'phone:random': (ack: (res: Result<{ text: string }>) => void) => void;
  /** Drawing Phone, while drawing: one finished action on the canvas. Fire and forget. */
  'phone:op': (op: SketchOp) => void;
  'phone:undo': () => void;
  'phone:redo': () => void;
  /** Drawing Phone: finished this step (or not, to change it). Everyone done skips ahead. */
  'phone:done': (payload: PhoneDonePayload, ack: (res: Result<null>) => void) => void;
  /** Drawing Phone, leader only, during the reveal: show the next link now. */
  'phone:next': (ack: (res: Result<null>) => void) => void;
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
  'game:host': (update: GameUpdate<HostView>) => void;
  /** Sent to each player individually, with their private view. */
  'game:player': (update: GameUpdate<PlayerView>) => void;
  /** Sent to the TV screen only: the artist's strokes, as they draw. */
  'draw:stroke': (stroke: Stroke) => void;
  'draw:undo': () => void;
  'draw:clear': () => void;
  /** Sent to the TV screen only: the whole drawing so far, e.g. after a refresh. */
  'draw:sync': (strokes: Stroke[]) => void;
}
