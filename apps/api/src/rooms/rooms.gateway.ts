import { randomUUID } from 'node:crypto';
import { isLeader, toLobbyState, trivia, type Room } from '@couchwave/engine';
import {
  GAMES,
  REACTION_COOLDOWN_MS,
  answerSchema,
  joinRoomSchema,
  kickPlayerSchema,
  libraryMoveSchema,
  reactSchema,
  rejoinRoomSchema,
  resumeScreenSchema,
  type ClientToServerEvents,
  type CreatedRoom,
  type JoinedRoom,
  type Result,
  type RoomClosedReason,
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
import { GAME_TICK_MS, RECONNECT_GRACE_MS, SCREEN_GRACE_MS } from './rooms.constants.js';
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

const ok: Result<null> = { ok: true, data: null };

@WebSocketGateway({
  cors: { origin: corsOrigins() },
  // Detect a phone that silently dropped off (sleep, lost Wi-Fi) within ~15s
  // instead of Socket.IO's default ~45s, so the grace period starts sooner.
  pingInterval: 10_000,
  pingTimeout: 5_000,
  // Selfie avatars are sent as data URLs; the schema caps them well below this
  maxHttpBufferSize: 200_000,
})
export class RoomsGateway implements OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(RoomsGateway.name);
  /** Per player: frees their seat if they don't come back in time. */
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();
  /** Per room: closes it if its TV screen doesn't come back in time. */
  private readonly screenTimers = new Map<string, NodeJS.Timeout>();
  private readonly gameLoops = new Map<string, NodeJS.Timeout>();
  private readonly lastReactionAt = new Map<string, number>();

  @WebSocketServer()
  server: GameServer;

  constructor(
    private readonly rooms: RoomsService,
    private readonly games: GamesService,
    @Inject(RECONNECT_GRACE_MS) private readonly graceMs: number,
    @Inject(SCREEN_GRACE_MS) private readonly screenGraceMs: number,
  ) {}

  // ── TV screen ──────────────────────────────────────────────────────────────

  /** The returned value is sent back to the client as the ack. */
  @SubscribeMessage('room:create')
  handleCreate(@ConnectedSocket() socket: GameSocket): Result<CreatedRoom> {
    if (socket.data.roomCode) return { ok: false, error: 'ALREADY_IN_ROOM' };

    const { room, screenToken } = this.rooms.create(socket.id);
    this.attachScreen(socket, room.code);

    this.logger.log(`Room ${room.code} created`);
    return { ok: true, data: { lobby: toLobbyState(room), screenToken } };
  }

  @SubscribeMessage('room:resume')
  handleResume(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: unknown,
  ): Result<CreatedRoom> {
    if (socket.data.roomCode) return { ok: false, error: 'ALREADY_IN_ROOM' };

    const parsed = resumeScreenSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'INVALID_PAYLOAD' };

    const result = this.rooms.resumeScreen(parsed.data.screenToken, socket.id);
    if (!result.ok) return { ok: false, error: result.error };

    const { room } = result;
    this.cancelTimer(this.screenTimers, room.code);
    if (result.previousConnectionId !== socket.id) {
      this.server.sockets.sockets.get(result.previousConnectionId)?.disconnect(true);
    }
    this.attachScreen(socket, room.code);
    this.server.to(room.code).emit('lobby:update', toLobbyState(room));

    const game = this.games.get(room.code);
    if (game) socket.emit('game:host', { serverTime: Date.now(), view: trivia.hostView(game) });

    this.logger.log(`Screen resumed room ${room.code}`);
    return { ok: true, data: { lobby: toLobbyState(room), screenToken: result.screenToken } };
  }

  // ── Players joining and leaving ────────────────────────────────────────────

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

    const { roomCode, name, avatar } = parsed.data;
    const playerId = randomUUID();
    const result = this.rooms.join(roomCode, { id: playerId, name, avatar }, socket.id);
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

    this.cancelTimer(this.graceTimers, result.playerId);
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

    this.cancelTimer(this.graceTimers, playerId);
    this.lastReactionAt.delete(playerId);
    this.server.to(playerChannel(playerId)).emit('room:kicked');
    this.server.in(playerChannel(playerId)).disconnectSockets(true);
    this.server.to(room.code).emit('lobby:update', toLobbyState(kicked.room));

    this.logger.log(`Player ${playerId} kicked from ${room.code}`);
    return ok;
  }

  @SubscribeMessage('room:react')
  handleReact(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Result<null> {
    const { roomCode, role, playerId } = socket.data;
    if (!roomCode || role !== 'player' || !playerId) return { ok: false, error: 'NOT_A_PLAYER' };

    const parsed = reactSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'INVALID_PAYLOAD' };
    if (this.rooms.get(roomCode)?.status === 'playing') return { ok: false, error: 'WRONG_PHASE' };

    // A light rate limit so one player can't flood the TV
    const now = Date.now();
    if (now - (this.lastReactionAt.get(playerId) ?? 0) < REACTION_COOLDOWN_MS) {
      return { ok: false, error: 'TOO_FAST' };
    }
    this.lastReactionAt.set(playerId, now);

    this.server.to(hostChannel(roomCode)).emit('room:reaction', {
      playerId,
      emoji: parsed.data.emoji,
    });
    return ok;
  }

  // ── Games library (leader only) ────────────────────────────────────────────

  @SubscribeMessage('library:open')
  handleLibraryOpen(@ConnectedSocket() socket: GameSocket): Result<null> {
    const room = this.leaderRoom(socket);
    if (!room) return { ok: false, error: 'NOT_LEADER' };
    if (room.status !== 'lobby') return { ok: false, error: 'WRONG_PHASE' };

    this.broadcastLobby(this.rooms.setStatus(room.code, 'library'));
    return ok;
  }

  @SubscribeMessage('library:close')
  handleLibraryClose(@ConnectedSocket() socket: GameSocket): Result<null> {
    const room = this.leaderRoom(socket);
    if (!room) return { ok: false, error: 'NOT_LEADER' };
    if (room.status !== 'library') return { ok: false, error: 'WRONG_PHASE' };

    this.broadcastLobby(this.rooms.setStatus(room.code, 'lobby'));
    return ok;
  }

  @SubscribeMessage('library:move')
  handleLibraryMove(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: unknown,
  ): Result<null> {
    const room = this.leaderRoom(socket);
    if (!room) return { ok: false, error: 'NOT_LEADER' };
    if (room.status !== 'library') return { ok: false, error: 'WRONG_PHASE' };

    const parsed = libraryMoveSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: 'INVALID_PAYLOAD' };

    this.broadcastLobby(this.rooms.moveGameSelection(room.code, parsed.data.delta));
    return ok;
  }

  @SubscribeMessage('library:select')
  handleLibrarySelect(@ConnectedSocket() socket: GameSocket): Result<null> {
    const room = this.leaderRoom(socket);
    if (!room) return { ok: false, error: 'NOT_LEADER' };
    if (room.status !== 'library') return { ok: false, error: 'WRONG_PHASE' };
    if (!GAMES[room.selectedGame]?.available) return { ok: false, error: 'GAME_UNAVAILABLE' };
    if (room.players.length < trivia.minPlayers) return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };

    this.broadcastLobby(this.rooms.setStatus(room.code, 'playing'));
    this.games.start(
      room.code,
      room.players.map((p) => p.id),
      Date.now(),
    );
    this.broadcastGame(room.code);
    this.startGameLoop(room.code);

    this.logger.log(`Trivia started in ${room.code} with ${room.players.length} player(s)`);
    return ok;
  }

  // ── In-game ────────────────────────────────────────────────────────────────

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
    return ok;
  }

  /** Ends the game (early or after the final scores) and goes back to the games library. */
  @SubscribeMessage('game:end')
  handleEnd(@ConnectedSocket() socket: GameSocket): Result<null> {
    const room = this.leaderRoom(socket);
    if (!room) return { ok: false, error: 'NOT_LEADER' };
    if (!this.games.get(room.code)) return { ok: false, error: 'NO_GAME' };

    this.stopGame(room.code);
    this.broadcastLobby(this.rooms.setStatus(room.code, 'library'));
    return ok;
  }

  // ── Disconnects ────────────────────────────────────────────────────────────

  handleDisconnect(socket: GameSocket): void {
    const { roomCode, role, playerId } = socket.data;
    if (!roomCode) return;

    if (role === 'host') {
      // The TV may just be refreshing: keep the room and wait for it to resume
      const room = this.rooms.screenDisconnected(roomCode, socket.id);
      if (!room) return;
      this.broadcastLobby(room);
      this.startTimer(this.screenTimers, roomCode, this.screenGraceMs, () =>
        this.closeRoom(roomCode, 'SCREEN_LEFT'),
      );
      return;
    }

    if (!playerId) return;
    const room = this.rooms.disconnect(playerId, socket.id);
    if (!room) return;

    this.broadcastLobby(room);
    this.startTimer(this.graceTimers, playerId, this.graceMs, () => {
      this.lastReactionAt.delete(playerId);
      this.broadcastLobby(this.rooms.expire(playerId));
    });
  }

  onModuleDestroy(): void {
    for (const timer of [...this.graceTimers.values(), ...this.screenTimers.values()]) {
      clearTimeout(timer);
    }
    for (const loop of this.gameLoops.values()) clearInterval(loop);
    this.graceTimers.clear();
    this.screenTimers.clear();
    this.gameLoops.clear();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** The socket's room, if the socket belongs to that room's leader. */
  private leaderRoom(socket: GameSocket): Room | undefined {
    const { roomCode, role, playerId } = socket.data;
    const room = roomCode ? this.rooms.get(roomCode) : undefined;
    return room && role === 'player' && isLeader(room, playerId) ? room : undefined;
  }

  private broadcastLobby(room: Room | undefined): void {
    if (room) this.server.to(room.code).emit('lobby:update', toLobbyState(room));
  }

  private closeRoom(roomCode: string, reason: RoomClosedReason): void {
    this.stopGame(roomCode);
    this.cancelTimer(this.screenTimers, roomCode);
    for (const id of this.rooms.close(roomCode)) {
      this.cancelTimer(this.graceTimers, id);
      this.lastReactionAt.delete(id);
    }
    this.server.to(roomCode).emit('room:closed', reason);
    this.server.in(roomCode).disconnectSockets(true);
    this.logger.log(`Room ${roomCode} closed (${reason})`);
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

  private attachScreen(socket: GameSocket, roomCode: string): void {
    socket.data = { roomCode, role: 'host' };
    void socket.join([roomCode, hostChannel(roomCode)]);
  }

  /** Attaches the socket to the player's seat and tells everyone else in the room. */
  private seatPlayer(socket: GameSocket, roomCode: string, playerId: string, room: Room) {
    socket.data = { roomCode, role: 'player', playerId };
    void socket.join([roomCode, playerChannel(playerId)]);

    const lobby = toLobbyState(room);
    socket.to(roomCode).emit('lobby:update', lobby);
    return lobby;
  }

  private startTimer(
    timers: Map<string, NodeJS.Timeout>,
    key: string,
    ms: number,
    onExpire: () => void,
  ): void {
    this.cancelTimer(timers, key);
    const timer = setTimeout(() => {
      timers.delete(key);
      onExpire();
    }, ms);
    timer.unref();
    timers.set(key, timer);
  }

  private cancelTimer(timers: Map<string, NodeJS.Timeout>, key: string): void {
    clearTimeout(timers.get(key));
    timers.delete(key);
  }
}
