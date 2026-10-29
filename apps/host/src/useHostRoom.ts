import {
  addStrokeChunk,
  type ClientToServerEvents,
  type CreatedRoom,
  type GameUpdate,
  type HostView,
  type LobbyState,
  type ReactionEvent,
  type Result,
  type ServerToClientEvents,
  type Stroke,
} from '@couchwave/shared';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './config';
import { clearScreenToken, loadScreenToken, saveScreenToken } from './screenSession';

type HostSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type HostRoomState =
  /** `waking`: the first attempts failed, probably because the free server is starting up. */
  | { status: 'connecting'; waking?: boolean }
  | { status: 'ready'; lobby: LobbyState }
  | { status: 'closed' }
  | { status: 'error'; message: string };

export interface HostGame<View extends HostView = HostView> {
  update: GameUpdate<View>;
  /** Local time the update arrived, for lining up the countdown with the server clock. */
  receivedAt: number;
}

/** Narrows a game update to one game, e.g. `isGame(game, 'draw')`. */
export function isGame<Id extends HostView['game']>(
  game: HostGame,
  id: Id,
): game is HostGame<Extract<HostView, { game: Id }>> {
  return game.update.view.game === id;
}

export interface FloatingReaction extends ReactionEvent {
  /** Unique per reaction, for React keys and removal. */
  key: number;
}

/** How long a reaction floats on screen. Matches the CSS animation. */
export const REACTION_LIFETIME_MS = 2_500;
const MAX_REACTIONS_ON_SCREEN = 30;
/** A sleeping free-plan server takes up to about a minute to wake; only then show an error. */
const WAKE_UP_MS = 90_000;

/**
 * Connects to the API, creates (or, after a refresh, resumes) a room and keeps its lobby,
 * game and reactions in sync. The TV only listens: commands come from the leader's phone.
 */
export function useHostRoom() {
  const [room, setRoom] = useState<HostRoomState>({ status: 'connecting' });
  const [game, setGame] = useState<HostGame | null>(null);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  /** Draw & Guess: the current turn's drawing. */
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  useEffect(() => {
    const socket: HostSocket = io(API_URL, { transports: ['websocket'] });
    let nextKey = 0;
    let drawTurn: number | null = null;

    const enterRoom = (res: Result<CreatedRoom>) => {
      if (!res.ok) return false;
      saveScreenToken(res.data.screenToken);
      setRoom({ status: 'ready', lobby: res.data.lobby });
      return true;
    };

    // Runs on the first connection and after every reconnection
    socket.on('connect', async () => {
      const token = loadScreenToken();
      if (token && enterRoom(await socket.emitWithAck('room:resume', { screenToken: token }))) {
        return;
      }
      clearScreenToken();
      const res = await socket.emitWithAck('room:create');
      if (!enterRoom(res) && !res.ok) setRoom({ status: 'error', message: res.error });
    });

    socket.on('lobby:update', (lobby) => {
      setRoom({ status: 'ready', lobby });
      if (lobby.status !== 'playing') {
        setGame(null);
        drawTurn = null;
      }
    });
    socket.on('game:host', (update) => {
      setGame({ update, receivedAt: Date.now() });
      // Every Draw & Guess turn starts on a blank canvas
      const turn = update.view.game === 'draw' ? update.view.turn : null;
      if (turn !== drawTurn) setStrokes([]);
      drawTurn = turn;
    });
    socket.on('draw:stroke', (chunk) => setStrokes((prev) => addStrokeChunk(prev, chunk)));
    socket.on('draw:undo', () => setStrokes((prev) => prev.slice(0, -1)));
    socket.on('draw:clear', () => setStrokes([]));
    socket.on('draw:sync', setStrokes);
    socket.on('room:reaction', (reaction) => {
      const key = nextKey++;
      setReactions((prev) => [...prev, { ...reaction, key }].slice(-MAX_REACTIONS_ON_SCREEN));
      setTimeout(
        () => setReactions((prev) => prev.filter((r) => r.key !== key)),
        REACTION_LIFETIME_MS,
      );
    });
    socket.on('room:closed', () => {
      clearScreenToken();
      setRoom({ status: 'closed' });
    });
    // Socket.IO keeps retrying on its own, so stay on "waking up" for a while first
    const startedAt = Date.now();
    socket.on('connect_error', () =>
      setRoom((prev) =>
        prev.status === 'connecting' && Date.now() - startedAt < WAKE_UP_MS
          ? { status: 'connecting', waking: true }
          : { status: 'error', message: `Can't reach the server at ${API_URL}` },
      ),
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  return { room, game, reactions, strokes };
}
