import type {
  ClientToServerEvents,
  GameUpdate,
  LobbyState,
  ServerToClientEvents,
  TriviaHostView,
} from '@couchwave/shared';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './config';

type HostSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type HostRoomState =
  | { status: 'connecting' }
  | { status: 'ready'; lobby: LobbyState }
  | { status: 'error'; message: string };

export interface HostGame {
  update: GameUpdate<TriviaHostView>;
  /** Local time the update arrived, for lining up the countdown with the server clock. */
  receivedAt: number;
}

/**
 * Connects to the API, creates a room and keeps its lobby and game in sync. The TV only
 * listens: all commands come from the leader's phone.
 */
export function useHostRoom() {
  const [room, setRoom] = useState<HostRoomState>({ status: 'connecting' });
  const [game, setGame] = useState<HostGame | null>(null);

  useEffect(() => {
    const socket: HostSocket = io(API_URL, { transports: ['websocket'] });

    socket.on('connect', async () => {
      const res = await socket.emitWithAck('room:create');
      setRoom(
        res.ok ? { status: 'ready', lobby: res.data } : { status: 'error', message: res.error },
      );
    });
    socket.on('lobby:update', (lobby) => {
      setRoom({ status: 'ready', lobby });
      if (lobby.status === 'lobby') setGame(null);
    });
    socket.on('game:host', (update) => setGame({ update, receivedAt: Date.now() }));
    socket.on('connect_error', () =>
      setRoom({ status: 'error', message: `Can't reach the server at ${API_URL}` }),
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  return { room, game };
}
