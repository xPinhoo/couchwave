import { randomUUID } from 'node:crypto';
import { toLobbyState, type Room } from '@couchwave/engine';
import {
  joinRoomSchema,
  rejoinRoomSchema,
  type ClientToServerEvents,
  type JoinedRoom,
  type LobbyState,
  type Result,
  type ServerToClientEvents,
} from '@couchwave/shared';
import { Inject, Logger, type OnModuleDestroy } from '@nestjs/common';
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
import { RECONNECT_GRACE_MS } from './rooms.constants.js';
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

@WebSocketGateway({
  cors: { origin: corsOrigins() },
  // Detect a phone that silently dropped off (sleep, lost Wi-Fi) within ~15s
  // instead of Socket.IO's default ~45s, so the grace period starts sooner.
  pingInterval: 10_000,
  pingTimeout: 5_000,
})
export class RoomsGateway implements OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(RoomsGateway.name);
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();

  @WebSocketServer()
  server: GameServer;

  constructor(
    private readonly rooms: RoomsService,
    @Inject(RECONNECT_GRACE_MS) private readonly graceMs: number,
  ) {}

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
  ): Result<JoinedRoom> {
    if (socket.data.roomCode) return { ok: false, error: 'ALREADY_IN_ROOM' };

    const parsed = joinRoomSchema.safeParse(body);
    if (!parsed.success) {
      return { ok: false, error: 'INVALID_PAYLOAD', message: parsed.error.issues[0]?.message };
    }

    const { roomCode, name } = parsed.data;
    const playerId = randomUUID();
    const result = this.rooms.join(roomCode, { id: playerId, name }, socket.id);
    if (!result.ok) return { ok: false, error: result.error };

    const lobby = this.seatPlayer(socket, roomCode, playerId, result.room);
    return { ok: true, data: { playerId, sessionToken: result.sessionToken, lobby } };
  }

  @SubscribeMessage('room:rejoin')
  handleRejoin(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: unknown,
  ): Result<JoinedRoom> {
    if (socket.data.roomCode) return { ok: false, error: 'ALREADY_IN_ROOM' };

    const parsed = rejoinRoomSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'INVALID_PAYLOAD' };

    const { sessionToken } = parsed.data;
    const result = this.rooms.rejoin(sessionToken, socket.id);
    if (!result.ok) return { ok: false, error: result.error };

    this.cancelGraceTimer(result.playerId);
    // The old socket may not have timed out yet (e.g. the phone switched from Wi-Fi
    // to 4G). Kick it so it can't act as this player anymore.
    if (result.previousConnectionId !== socket.id) {
      this.server.sockets.sockets.get(result.previousConnectionId)?.disconnect(true);
    }

    const lobby = this.seatPlayer(socket, result.roomCode, result.playerId, result.room);
    this.logger.log(`Player ${result.playerId} rejoined ${result.roomCode}`);
    return { ok: true, data: { playerId: result.playerId, sessionToken, lobby } };
  }

  handleDisconnect(socket: GameSocket): void {
    const { roomCode, role, playerId } = socket.data;
    if (!roomCode) return;

    if (role === 'host') {
      for (const id of this.rooms.close(roomCode)) this.cancelGraceTimer(id);
      this.server.to(roomCode).emit('room:closed', 'HOST_LEFT');
      this.server.in(roomCode).disconnectSockets(true);
      this.logger.log(`Room ${roomCode} closed`);
      return;
    }

    if (!playerId) return;
    const room = this.rooms.disconnect(playerId, socket.id);
    if (!room) return;

    this.server.to(roomCode).emit('lobby:update', toLobbyState(room));
    this.startGraceTimer(roomCode, playerId);
  }

  onModuleDestroy(): void {
    for (const timer of this.graceTimers.values()) clearTimeout(timer);
    this.graceTimers.clear();
  }

  /** Attaches the socket to the player's seat and tells everyone else in the room. */
  private seatPlayer(socket: GameSocket, roomCode: string, playerId: string, room: Room) {
    socket.data = { roomCode, role: 'player', playerId };
    void socket.join(roomCode);

    const lobby = toLobbyState(room);
    socket.to(roomCode).emit('lobby:update', lobby);
    return lobby;
  }

  private startGraceTimer(roomCode: string, playerId: string): void {
    this.cancelGraceTimer(playerId);
    const timer = setTimeout(() => {
      this.graceTimers.delete(playerId);
      const room = this.rooms.expire(playerId);
      if (room) this.server.to(roomCode).emit('lobby:update', toLobbyState(room));
    }, this.graceMs);
    timer.unref();
    this.graceTimers.set(playerId, timer);
  }

  private cancelGraceTimer(playerId: string): void {
    clearTimeout(this.graceTimers.get(playerId));
    this.graceTimers.delete(playerId);
  }
}
