import { randomBytes } from 'node:crypto';
import {
  addPlayer,
  createRoom,
  generateRoomCode,
  moveGameSelection,
  openSetup,
  removePlayer,
  setPlayerConnected,
  setRoomStatus,
  setReady,
  setScreenConnected,
  setSetupOptions,
  type Player,
  type Room,
} from '@couchwave/engine';
import type { Avatar, ErrorCode, RoomStatus, TriviaOptions } from '@couchwave/shared';
import { Injectable } from '@nestjs/common';

interface PlayerSession {
  token: string;
  roomCode: string;
  playerId: string;
  /** The socket that currently owns this seat. */
  connectionId: string;
}

interface ScreenSession {
  token: string;
  roomCode: string;
  /** The socket currently showing this room on the TV. */
  connectionId: string;
}

export type JoinOutcome =
  | { ok: true; room: Room; player: Player; sessionToken: string }
  | {
      ok: false;
      error: Extract<ErrorCode, 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'NAME_TAKEN' | 'GAME_IN_PROGRESS'>;
    };

export type RejoinOutcome =
  | { ok: true; room: Room; playerId: string; roomCode: string; previousConnectionId: string }
  | { ok: false; error: Extract<ErrorCode, 'INVALID_SESSION'> };

export type ResumeOutcome =
  | { ok: true; room: Room; screenToken: string; previousConnectionId: string }
  | { ok: false; error: Extract<ErrorCode, 'INVALID_SESSION'> };

const newToken = () => randomBytes(24).toString('base64url');

/**
 * Owns room state and the sessions of players and TV screens. In-memory for now —
 * moving this to Redis is what will let the API run as more than one instance.
 */
@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();
  private readonly sessionsByToken = new Map<string, PlayerSession>();
  private readonly sessionsByPlayer = new Map<string, PlayerSession>();
  private readonly screensByToken = new Map<string, ScreenSession>();
  private readonly screensByRoom = new Map<string, ScreenSession>();

  /** Overridable in tests for deterministic room codes and timestamps. */
  random: () => number = Math.random;
  clock: () => number = Date.now;

  /** Creates a room for the TV screen on `connectionId`. */
  create(connectionId: string): { room: Room; screenToken: string } {
    let code: string;
    do {
      code = generateRoomCode(this.random);
    } while (this.rooms.has(code));

    const room = createRoom(code, this.clock());
    this.rooms.set(code, room);

    const screen: ScreenSession = { token: newToken(), roomCode: code, connectionId };
    this.screensByToken.set(screen.token, screen);
    this.screensByRoom.set(code, screen);
    return { room, screenToken: screen.token };
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  setStatus(code: string, status: RoomStatus): Room | undefined {
    return this.update(code, (room) => setRoomStatus(room, status));
  }

  moveGameSelection(code: string, delta: number): Room | undefined {
    return this.update(code, (room) => moveGameSelection(room, delta));
  }

  openSetup(code: string): Room | undefined {
    return this.update(code, openSetup);
  }

  setSetupOptions(code: string, options: TriviaOptions): Room | undefined {
    return this.update(code, (room) => setSetupOptions(room, options));
  }

  setReady(code: string, playerId: string, ready: boolean): Room | undefined {
    return this.update(code, (room) => setReady(room, playerId, ready));
  }

  /** Hands the room behind `token` to a new TV connection (after a refresh, say). */
  resumeScreen(token: string, connectionId: string): ResumeOutcome {
    const screen = this.screensByToken.get(token);
    const room = screen && this.rooms.get(screen.roomCode);
    if (!screen || !room) return { ok: false, error: 'INVALID_SESSION' };

    const previousConnectionId = screen.connectionId;
    screen.connectionId = connectionId;
    const updated = setScreenConnected(room, true);
    this.rooms.set(room.code, updated);
    return { ok: true, room: updated, screenToken: token, previousConnectionId };
  }

  /** Marks the TV as gone, unless `connectionId` is an old socket that was already replaced. */
  screenDisconnected(code: string, connectionId: string): Room | undefined {
    if (this.screensByRoom.get(code)?.connectionId !== connectionId) return undefined;
    return this.update(code, (room) => setScreenConnected(room, false));
  }

  join(
    code: string,
    player: { id: string; name: string; avatar?: Avatar },
    connectionId: string,
  ): JoinOutcome {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    const result = addPlayer(room, { ...player, now: this.clock() });
    if (!result.ok) return result;

    this.rooms.set(code, result.room);
    const session: PlayerSession = {
      token: newToken(),
      roomCode: code,
      playerId: player.id,
      connectionId,
    };
    this.sessionsByToken.set(session.token, session);
    this.sessionsByPlayer.set(player.id, session);

    return { ...result, sessionToken: session.token };
  }

  /** Hands the seat behind `token` to a new connection and marks the player as back. */
  rejoin(token: string, connectionId: string): RejoinOutcome {
    const session = this.sessionsByToken.get(token);
    const room = session && this.rooms.get(session.roomCode);
    if (!session || !room?.players.some((p) => p.id === session.playerId)) {
      return { ok: false, error: 'INVALID_SESSION' };
    }

    const previousConnectionId = session.connectionId;
    session.connectionId = connectionId;

    const updated = setPlayerConnected(room, session.playerId, true);
    this.rooms.set(session.roomCode, updated);
    return {
      ok: true,
      room: updated,
      playerId: session.playerId,
      roomCode: session.roomCode,
      previousConnectionId,
    };
  }

  /**
   * Marks the player as disconnected, unless `connectionId` is an old socket that
   * already lost the seat to a newer one. Returns the updated room, if anything changed.
   */
  disconnect(playerId: string, connectionId: string): Room | undefined {
    const session = this.sessionsByPlayer.get(playerId);
    if (!session || session.connectionId !== connectionId) return undefined;
    return this.update(session.roomCode, (room) => setPlayerConnected(room, playerId, false));
  }

  /** Frees the seat once the grace period is over, if the player still hasn't come back. */
  expire(playerId: string): Room | undefined {
    const session = this.sessionsByPlayer.get(playerId);
    const room = session && this.rooms.get(session.roomCode);
    if (!session || !room) return undefined;
    if (room.players.find((p) => p.id === playerId)?.connected) return undefined;

    this.deleteSession(session);
    return this.update(room.code, (r) => removePlayer(r, playerId));
  }

  /**
   * Removes a player straight away and cancels their session so they can't rejoin with it.
   * Returns the socket that held the seat, so the caller can disconnect it.
   */
  kick(code: string, playerId: string): { room: Room; connectionId?: string } | undefined {
    const room = this.rooms.get(code);
    if (!room?.players.some((p) => p.id === playerId)) return undefined;

    const session = this.sessionsByPlayer.get(playerId);
    if (session) this.deleteSession(session);
    const updated = removePlayer(room, playerId);
    this.rooms.set(code, updated);
    return { room: updated, connectionId: session?.connectionId };
  }

  /** Deletes the room and every session in it; returns the ids of the players who were in it. */
  close(code: string): string[] {
    const room = this.rooms.get(code);
    this.rooms.delete(code);

    const screen = this.screensByRoom.get(code);
    if (screen) {
      this.screensByToken.delete(screen.token);
      this.screensByRoom.delete(code);
    }
    if (!room) return [];

    for (const { id } of room.players) {
      const session = this.sessionsByPlayer.get(id);
      if (session) this.deleteSession(session);
    }
    return room.players.map((p) => p.id);
  }

  private update(code: string, change: (room: Room) => Room): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    const updated = change(room);
    this.rooms.set(code, updated);
    return updated;
  }

  private deleteSession(session: PlayerSession): void {
    this.sessionsByToken.delete(session.token);
    this.sessionsByPlayer.delete(session.playerId);
  }
}
