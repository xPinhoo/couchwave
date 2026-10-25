import { randomUUID } from 'node:crypto';
import { isLeader, toLobbyState, trivia, type Room } from '@couchwave/engine';
import {
  answerSchema,
  joinRoomSchema,
  kickPlayerSchema,
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
import { GamesService } from './games.service.js';
import { GAME_TICK_MS, RECONNECT_GRACE_MS } from './rooms.constants.js';
import { RoomsService } from './rooms.service.js';

/** Socket.IO room names for targeting one recipient. */
const hostChannel = (roomCode: string) => `host:${roomCode}`;
const playerChannel = (playerId: string) => `player:${playerId}`;

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
  private readonly gameLoops = new Map<string, NodeJS.Timeout>();

  @WebSocketServer()
  server: GameServer;

  constructor(
    private readonly rooms: RoomsService,
    private readonly games: GamesService,
    @Inject(RECONNECT_GRACE_MS) private readonly graceMs: number,
  ) {}

  /** The returned value is sent back to the client as the ack. */
  @SubscribeMessage('room:create')
  handleCreate(@ConnectedSocket() socket: GameSocket): Result<LobbyState> {
    if (socket.data.roomCode) return { ok: false, error: 'ALREADY_IN_ROOM' };

    const room = this.rooms.create();
    socket.data = { roomCode: room.code, role: 'host' };
    void socket.join([room.code, hostChannel(room.code)]);

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
    // Back mid-game: send the current screen straight away instead of waiting for the next change
    const game = this.games.get(result.roomCode);
    if (game?.playerIds.includes(result.playerId)) {
      socket.emit('game:player', {
        serverTime: Date.now(),
        view: trivia.playerView(game, result.playerId),
      });
    }

    this.logger.log(`Player ${result.playerId} rejoined ${result.roomCode}`);
    return { ok: true, data: { playerId: result.playerId, sessionToken, lobby } };
  }

  @SubscribeMessage('room:kick')
  handleKick(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Result<null> {
    const room = this.leaderRoom(socket);
    if (!room) return { ok: false, error: 'NOT_LEADER' };

    const parsed = kickPlayerSchema.safeParse(body);
    if (!parsed.success || parsed.data.playerId === socket.data.playerId) {
      return { ok: false, error: 'INVALID_PAYLOAD' };
    }
    // Removing someone mid-game would leave the game waiting for their answers
    if (room.status === 'playing') return { ok: false, error: 'GAME_IN_PROGRESS' };

    const { playerId } = parsed.data;
    const kicked = this.rooms.kick(room.code, playerId);
    if (!kicked) return { ok: false, error: 'PLAYER_NOT_FOUND' };

    this.cancelGraceTimer(playerId);
    this.server.to(playerChannel(playerId)).emit('room:kicked');
    this.server.in(playerChannel(playerId)).disconnectSockets(true);
    this.server.to(room.code).emit('lobby:update', toLobbyState(kicked.room));

    this.logger.log(`Player ${playerId} kicked from ${room.code}`);
    return { ok: true, data: null };
  }

  @SubscribeMessage('game:start')
  handleStart(@ConnectedSocket() socket: GameSocket): Result<null> {
    const room = this.leaderRoom(socket);
    if (!room) return { ok: false, error: 'NOT_LEADER' };
    const roomCode = room.code;
    if (room.status === 'playing') return { ok: false, error: 'GAME_IN_PROGRESS' };
    if (room.players.length < trivia.minPlayers) return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };

    const playing = this.rooms.setStatus(roomCode, 'playing');
    if (playing) this.server.to(roomCode).emit('lobby:update', toLobbyState(playing));

    this.games.start(
      roomCode,
      room.players.map((p) => p.id),
      Date.now(),
    );
    this.broadcastGame(roomCode);
    this.startGameLoop(roomCode);

    this.logger.log(`Trivia started in ${roomCode} with ${room.players.length} player(s)`);
    return { ok: true, data: null };
  }

  @SubscribeMessage('game:answer')
  handleAnswer(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Result<null> {
    const { roomCode, role, playerId } = socket.data;
    if (!roomCode || role !== 'player' || !playerId) return { ok: false, error: 'NOT_A_PLAYER' };

    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'INVALID_PAYLOAD' };
    if (!this.games.get(roomCode)) return { ok: false, error: 'NO_GAME' };

    // A late or repeated answer is simply ignored; the player's view already shows their choice
    if (this.games.answer(roomCode, playerId, parsed.data.choice, Date.now())) {
      this.broadcastGame(roomCode);
    }
    return { ok: true, data: null };
  }

  @SubscribeMessage('game:end')
  handleEnd(@ConnectedSocket() socket: GameSocket): Result<null> {
    const leaderRoom = this.leaderRoom(socket);
    if (!leaderRoom) return { ok: false, error: 'NOT_LEADER' };
    const roomCode = leaderRoom.code;
    if (!this.games.get(roomCode)) return { ok: false, error: 'NO_GAME' };

    this.stopGame(roomCode);
    const room = this.rooms.setStatus(roomCode, 'lobby');
    if (room) this.server.to(roomCode).emit('lobby:update', toLobbyState(room));
    return { ok: true, data: null };
  }

  handleDisconnect(socket: GameSocket): void {
    const { roomCode, role, playerId } = socket.data;
    if (!roomCode) return;

    if (role === 'host') {
      this.stopGame(roomCode);
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
    for (const loop of this.gameLoops.values()) clearInterval(loop);
    this.graceTimers.clear();
    this.gameLoops.clear();
  }

  /** The socket's room, if the socket belongs to that room's leader. */
  private leaderRoom(socket: GameSocket): Room | undefined {
    const { roomCode, role, playerId } = socket.data;
    const room = roomCode ? this.rooms.get(roomCode) : undefined;
    return room && role === 'player' && isLeader(room, playerId) ? room : undefined;
  }

  /** Sends the TV screen its view and every player their own private view. */
  private broadcastGame(roomCode: string): void {
    const game = this.games.get(roomCode);
    if (!game) return;

    const serverTime = Date.now();
    this.server
      .to(hostChannel(roomCode))
      .emit('game:host', { serverTime, view: trivia.hostView(game) });
    for (const playerId of game.playerIds) {
      this.server
        .to(playerChannel(playerId))
        .emit('game:player', { serverTime, view: trivia.playerView(game, playerId) });
    }
  }

  /** Advances phase timers; stops by itself once the game is finished. */
  private startGameLoop(roomCode: string): void {
    const loop = setInterval(() => {
      const game = this.games.tick(roomCode, Date.now());
      if (!game) return;

      this.broadcastGame(roomCode);
      if (trivia.isOver(game)) {
        clearInterval(loop);
        this.gameLoops.delete(roomCode);
      }
    }, GAME_TICK_MS);
    loop.unref();
    this.gameLoops.set(roomCode, loop);
  }

  private stopGame(roomCode: string): void {
    clearInterval(this.gameLoops.get(roomCode));
    this.gameLoops.delete(roomCode);
    this.games.stop(roomCode);
  }

  /** Attaches the socket to the player's seat and tells everyone else in the room. */
  private seatPlayer(socket: GameSocket, roomCode: string, playerId: string, room: Room) {
    socket.data = { roomCode, role: 'player', playerId };
    void socket.join([roomCode, playerChannel(playerId)]);

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
