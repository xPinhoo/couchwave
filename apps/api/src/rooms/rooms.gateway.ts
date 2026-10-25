import { randomUUID } from 'node:crypto';
import { toLobbyState } from '@couchwave/engine';
import {
  joinRoomSchema,
  type ClientToServerEvents,
  type LobbyState,
  type Result,
  type ServerToClientEvents,
} from '@couchwave/shared';
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { corsOrigins } from '../config.js';
import { RoomsService } from './rooms.service.js';

interface SocketData {
  roomCode?: string;
  role?: 'host' | 'player';
  playerId?: string;
}

type GameServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

@WebSocketGateway({ cors: { origin: corsOrigins() } })
export class RoomsGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(RoomsGateway.name);

  @WebSocketServer()
  server: GameServer;

  constructor(private readonly rooms: RoomsService) {}

  /** The returned value is sent back to the client as the ack. */
  @SubscribeMessage('room:create')
  handleCreate(@ConnectedSocket() socket: GameSocket): Result<LobbyState> {
    if (socket.data.roomCode) return { ok: false, error: 'ALREADY_IN_ROOM' };

    const room = this.rooms.create();
    socket.data = { roomCode: room.code, role: 'host' };
    void socket.join(room.code);

    this.logger.log(`Room ${room.code} created`);
    return { ok: true, data: toLobbyState(room) };
  }

  @SubscribeMessage('room:join')
  handleJoin(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: unknown,
  ): Result<{ playerId: string; lobby: LobbyState }> {
    if (socket.data.roomCode) return { ok: false, error: 'ALREADY_IN_ROOM' };

    const parsed = joinRoomSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message };
    }

    const { roomCode, name } = parsed.data;
    const playerId = randomUUID();
    const result = this.rooms.join(roomCode, { id: playerId, name });
    if (!result.ok) return { ok: false, error: result.error };

    socket.data = { roomCode, role: 'player', playerId };
    void socket.join(roomCode);

    const lobby = toLobbyState(result.room);
    socket.to(roomCode).emit('lobby:update', lobby);
    return { ok: true, data: { playerId, lobby } };
  }

  handleDisconnect(socket: GameSocket): void {
    const { roomCode, role, playerId } = socket.data;
    if (!roomCode) return;

    if (role === 'host') {
      this.rooms.close(roomCode);
      this.server.to(roomCode).emit('room:closed', 'HOST_LEFT');
      this.server.in(roomCode).disconnectSockets(true);
      this.logger.log(`Room ${roomCode} closed`);
      return;
    }

    // TODO(M1): keep the player's seat for a grace period so they can reconnect.
    if (playerId) {
      const room = this.rooms.leave(roomCode, playerId);
      if (room) this.server.to(roomCode).emit('lobby:update', toLobbyState(room));
    }
  }
}
