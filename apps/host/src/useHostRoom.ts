import type { ClientToServerEvents, LobbyState, ServerToClientEvents } from '@couchwave/shared';
import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './config';

export type HostRoomState =
  | { status: 'connecting' }
  | { status: 'ready'; lobby: LobbyState }
  | { status: 'error'; message: string };

/** Connects to the API, creates a room and keeps its lobby in sync. */
export function useHostRoom(): HostRoomState {
  const [state, setState] = useState<HostRoomState>({ status: 'connecting' });

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', async () => {
      const res = await socket.emitWithAck('room:create');
      setState(
        res.ok ? { status: 'ready', lobby: res.data } : { status: 'error', message: res.error },
      );
    });
    socket.on('lobby:update', (lobby) => setState({ status: 'ready', lobby }));
    socket.on('connect_error', () =>
      setState({ status: 'error', message: `Can't reach the server at ${API_URL}` }),
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  return state;
}
