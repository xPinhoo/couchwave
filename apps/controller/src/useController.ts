import type {
  ClientToServerEvents,
  ErrorCode,
  JoinedRoom,
  LobbyState,
  ServerToClientEvents,
} from '@couchwave/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './config';
import { clearSession, loadSession, saveSession } from './session';

type ControllerSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ControllerState =
  | { status: 'idle'; error?: string }
  | { status: 'joining' }
  /** Trying to get back into a room we were in (after a reload or a dropped connection). */
  | { status: 'rejoining' }
  | { status: 'lobby'; playerId: string; lobby: LobbyState; connected: boolean }
  | { status: 'closed' };

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_PAYLOAD: 'Check the room code and your name.',
  ROOM_NOT_FOUND: "That room doesn't exist.",
  ROOM_FULL: 'That room is full.',
  NAME_TAKEN: 'Someone already has that name.',
  GAME_IN_PROGRESS: 'A game is already in progress.',
  ALREADY_IN_ROOM: 'You are already in a room.',
  INVALID_SESSION: 'You were away for too long. Join again.',
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

  useEffect(() => {
    const socket: ControllerSocket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    // Runs on the first connection and after every automatic reconnection.
    socket.on('connect', async () => {
      const session = loadSession();
      if (!session) return;

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

    socket.on('lobby:update', (lobby) =>
      setState((prev) => (prev.status === 'lobby' ? { ...prev, lobby } : prev)),
    );
    socket.on('room:closed', () => {
      clearSession();
      setState({ status: 'closed' });
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

  const join = useCallback(async (roomCode: string, name: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    if (!socket.connected) {
      setState({ status: 'idle', error: `Can't reach the server at ${API_URL}` });
      return;
    }

    setState({ status: 'joining' });
    const res = await socket.emitWithAck('room:join', { roomCode, name });
    if (res.ok) {
      saveSession({ sessionToken: res.data.sessionToken });
      setState(inLobby(res.data));
    } else {
      setState({ status: 'idle', error: res.message ?? ERROR_MESSAGES[res.error] });
    }
  }, []);

  const reset = useCallback(() => {
    // The server disconnects everyone when a room closes, so start a fresh connection
    socketRef.current?.connect();
    setState({ status: 'idle' });
  }, []);

  return { state, join, reset };
}
