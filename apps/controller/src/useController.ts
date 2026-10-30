import type {
  Avatar,
  ClientToServerEvents,
  DrawOptions,
  ErrorCode,
  GameUpdate,
  JoinedRoom,
  LibraryDirection,
  LobbyState,
  PlayerView,
  Reaction,
  ServerToClientEvents,
  Stroke,
  TriviaOptions,
} from '@couchwave/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './config';
import { clearSession, loadSession, saveSession } from './session';
import { waitForConnection } from './waitForConnection';

type ControllerSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ControllerState =
  | { status: 'idle'; error?: string }
  | { status: 'joining' }
  /** Trying to get back into a room we were in (after a reload or a dropped connection). */
  | { status: 'rejoining' }
  | { status: 'lobby'; playerId: string; lobby: LobbyState; connected: boolean }
  | { status: 'closed' }
  /** The host removed us from the room. */
  | { status: 'kicked' };

export interface PlayerGame<View extends PlayerView = PlayerView> {
  update: GameUpdate<View>;
  /** Local time the update arrived, for lining up the countdown with the server clock. */
  receivedAt: number;
}

/** Narrows a game update to one game, e.g. `isGame(game, 'draw')`. */
export function isGame<Id extends PlayerView['game']>(
  game: PlayerGame,
  id: Id,
): game is PlayerGame<Extract<PlayerView, { game: Id }>> {
  return game.update.view.game === id;
}

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NOT_LEADER: 'Only the host can do that.',
  PLAYER_NOT_FOUND: 'That player already left.',
  NOT_A_PLAYER: 'Join the room first.',
  NOT_ENOUGH_PLAYERS: 'Not enough players to start.',
  NO_GAME: 'No game is running.',
  INVALID_PAYLOAD: 'Check the room code and your name.',
  ROOM_NOT_FOUND: "That room doesn't exist.",
  ROOM_FULL: 'That room is full.',
  NAME_TAKEN: 'Someone already has that name.',
  GAME_IN_PROGRESS: 'A game is already in progress.',
  ALREADY_IN_ROOM: 'You are already in a room.',
  INVALID_SESSION: 'You were away for too long. Join again.',
  WRONG_PHASE: "You can't do that right now.",
  GAME_UNAVAILABLE: "That game isn't ready yet. Pick another one!",
  TOO_FAST: 'Slow down a little!',
};

const inLobby = ({ playerId, lobby }: JoinedRoom): ControllerState => ({
  status: 'lobby',
  playerId,
  lobby,
  connected: true,
});

export function useController() {
  const socketRef = useRef<ControllerSocket | null>(null);
  const [state, setState] = useState<ControllerState>(() =>
    loadSession() ? { status: 'rejoining' } : { status: 'idle' },
  );
  const [game, setGame] = useState<PlayerGame | null>(null);
  /** Error from the last host action (start, kick, end), shown in the lobby. */
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const socket: ControllerSocket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    // Runs on the first connection and after every automatic reconnection.
    socket.on('connect', async () => {
      const session = loadSession();
      if (!session) {
        // Nothing to rejoin (the session was cleared meanwhile): don't stay on "Reconnecting…"
        setState((prev) => (prev.status === 'rejoining' ? { status: 'idle' } : prev));
        return;
      }

      const res = await socket.emitWithAck('room:rejoin', session);
      if (res.ok) {
        setState(inLobby(res.data));
      } else {
        clearSession();
        setState({ status: 'idle', error: ERROR_MESSAGES[res.error] });
      }
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // The server kicked us: either the room closed (handled by `room:closed`)
        // or this seat was taken over by a newer connection of the same player
        // (e.g. a duplicated tab). Either way, stop trying to reclaim it.
        clearSession();
        setState((prev) =>
          prev.status === 'lobby'
            ? { status: 'idle', error: 'You joined from another tab or device.' }
            : prev,
        );
        return;
      }
      // Network trouble: Socket.IO reconnects on its own and `connect` rejoins.
      setState((prev) => (prev.status === 'lobby' ? { ...prev, connected: false } : prev));
    });

    socket.on('lobby:update', (lobby) => {
      setState((prev) => (prev.status === 'lobby' ? { ...prev, lobby } : prev));
      if (lobby.status !== 'playing') setGame(null);
    });
    socket.on('game:player', (update) => setGame({ update, receivedAt: Date.now() }));
    socket.on('room:closed', () => {
      clearSession();
      setGame(null);
      setState({ status: 'closed' });
    });
    // Arrives just before the server disconnects us, so the disconnect handler sees 'kicked'
    socket.on('room:kicked', () => {
      clearSession();
      setGame(null);
      setState({ status: 'kicked' });
    });

    // Phones suspend apps in the background; reconnect right away when we come back
    // instead of waiting for the next automatic retry.
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active' && !socket.connected) socket.connect();
    });

    return () => {
      appState.remove();
      socket.disconnect();
    };
  }, []);

  const join = useCallback(async (roomCode: string, name: string, avatar: Avatar) => {
    const socket = socketRef.current;
    if (!socket) return;

    // Show "Joining…" while the socket may still be connecting (e.g. right after the page loads)
    setState({ status: 'joining' });
    if (!(await waitForConnection(socket))) {
      setState({ status: 'idle', error: `Can't reach the server at ${API_URL}` });
      return;
    }

    const res = await socket.emitWithAck('room:join', { roomCode, name, avatar });
    if (res.ok) {
      saveSession({ sessionToken: res.data.sessionToken });
      setState(inLobby(res.data));
    } else {
      setState({ status: 'idle', error: res.message ?? ERROR_MESSAGES[res.error] });
    }
  }, []);

  const answer = useCallback((choice: number) => {
    // Show the choice straight away; the server's next update confirms it
    setGame((prev) =>
      prev && isGame(prev, 'trivia')
        ? { ...prev, update: { ...prev.update, view: { ...prev.update.view, myChoice: choice } } }
        : prev,
    );
    void socketRef.current?.emitWithAck('game:answer', { choice });
  }, []);

  /** Draw & Guess. Drawing is fire and forget: strokes stream many times a second. */
  const drawing = useMemo(
    () => ({
      choose: (index: number) => void socketRef.current?.emitWithAck('draw:choose', { index }),
      guess: (text: string) => void socketRef.current?.emitWithAck('draw:guess', { text }),
      stroke: (stroke: Stroke) => socketRef.current?.emit('draw:stroke', stroke),
      undo: () => socketRef.current?.emit('draw:undo'),
      clear: () => socketRef.current?.emit('draw:clear'),
    }),
    [],
  );

  /** Runs a host-only action and surfaces its error, if any. */
  const leaderAction = useCallback(
    async (send: (socket: ControllerSocket) => Promise<{ ok: boolean; error?: ErrorCode }>) => {
      const socket = socketRef.current;
      if (!socket) return;
      setActionError(null);
      const res = await send(socket);
      if (!res.ok && res.error) setActionError(ERROR_MESSAGES[res.error]);
    },
    [],
  );

  const leader = useMemo(
    () => ({
      openLibrary: () => leaderAction((socket) => socket.emitWithAck('library:open')),
      closeLibrary: () => leaderAction((socket) => socket.emitWithAck('library:close')),
      moveLibrary: (direction: LibraryDirection) =>
        leaderAction((socket) => socket.emitWithAck('library:move', { direction })),
      selectGame: () => leaderAction((socket) => socket.emitWithAck('library:select')),
      setOptions: (options: TriviaOptions | DrawOptions) =>
        leaderAction((socket) => socket.emitWithAck('setup:options', options)),
      cancelSetup: () => leaderAction((socket) => socket.emitWithAck('setup:cancel')),
      endGame: () => leaderAction((socket) => socket.emitWithAck('game:end')),
      /** Back to the setup screen of the same game; the server keeps the last settings. */
      playAgain: () =>
        leaderAction(async (socket) => {
          const ended = await socket.emitWithAck('game:end');
          return ended.ok ? socket.emitWithAck('library:select') : ended;
        }),
      kick: (playerId: string) =>
        leaderAction((socket) => socket.emitWithAck('room:kick', { playerId })),
    }),
    [leaderAction],
  );

  /** Any player during setup; for the host, ready means "settings confirmed". */
  const setReady = useCallback(async (ready: boolean) => {
    const res = await socketRef.current?.emitWithAck('setup:ready', { ready });
    setActionError(res && !res.ok ? ERROR_MESSAGES[res.error] : null);
  }, []);

  /** Fire and forget: a reaction that's rate-limited away isn't worth an error message. */
  const react = useCallback((emoji: Reaction) => {
    void socketRef.current?.emitWithAck('room:react', { emoji });
  }, []);

  const reset = useCallback(() => {
    // The server disconnects everyone when a room closes, so start a fresh connection
    socketRef.current?.connect();
    setState({ status: 'idle' });
  }, []);

  return { state, game, actionError, join, answer, drawing, react, setReady, leader, reset };
}
