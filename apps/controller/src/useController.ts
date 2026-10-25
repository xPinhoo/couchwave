import type {
  ClientToServerEvents,
  ErrorCode,
  LobbyState,
  ServerToClientEvents,
} from '@couchwave/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './config';

type ControllerSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ControllerState =
  | { status: 'idle'; error?: string }
  | { status: 'joining' }
  | { status: 'lobby'; playerId: string; lobby: LobbyState }
  | { status: 'closed' };

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  INVALID_PAYLOAD: 'Check the room code and your name.',
  ROOM_NOT_FOUND: "That room doesn't exist.",
  ROOM_FULL: 'That room is full.',
  NAME_TAKEN: 'Someone already has that name.',
  GAME_IN_PROGRESS: 'A game is already in progress.',
  ALREADY_IN_ROOM: 'You are already in a room.',
};

export function useController() {
  const socketRef = useRef<ControllerSocket | null>(null);
  const [state, setState] = useState<ControllerState>({ status: 'idle' });

  useEffect(() => {
    const socket: ControllerSocket = io(API_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('lobby:update', (lobby) =>
      setState((prev) => (prev.status === 'lobby' ? { ...prev, lobby } : prev)),
    );
    socket.on('room:closed', () => setState({ status: 'closed' }));

    return () => {
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
    setState(
      res.ok
        ? { status: 'lobby', playerId: res.data.playerId, lobby: res.data.lobby }
        : { status: 'idle', error: res.message ?? ERROR_MESSAGES[res.error] },
    );
  }, []);

  const reset = useCallback(() => {
    // The server disconnects everyone when a room closes, so start a fresh connection
    socketRef.current?.connect();
    setState({ status: 'idle' });
  }, []);

  return { state, join, reset };
}
