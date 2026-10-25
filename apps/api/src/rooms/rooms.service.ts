import { randomBytes } from 'node:crypto';
import {
  addPlayer,
  createRoom,
  generateRoomCode,
  removePlayer,
  setPlayerConnected,
  setRoomStatus,
  type Player,
  type Room,
} from '@couchwave/engine';
import type { ErrorCode, RoomStatus } from '@couchwave/shared';
import { Injectable } from '@nestjs/common';

interface PlayerSession {
  token: string;
  roomCode: string;
  playerId: string;
  /** The socket that currently owns this seat. */
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

/**
 * Owns room state and player sessions. In-memory for now — moving this to Redis is
 * what will let the API run as more than one instance.
 */
@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();
  private readonly sessionsByToken = new Map<string, PlayerSession>();
  private readonly sessionsByPlayer = new Map<string, PlayerSession>();

  /** Overridable in tests for deterministic room codes and timestamps. */
  random: () => number = Math.random;
  clock: () => number = Date.now;

  create(): Room {
    let code: string;
    do {
      code = generateRoomCode(this.random);
    } while (this.rooms.has(code));

    const room = createRoom(code, this.clock());
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  setStatus(code: string, status: RoomStatus): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    const updated = setRoomStatus(room, status);
    this.rooms.set(code, updated);
    return updated;
  }

  join(code: string, player: { id: string; name: string }, connectionId: string): JoinOutcome {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    const result = addPlayer(room, { ...player, now: this.clock() });
    if (!result.ok) return result;

    this.rooms.set(code, result.room);
    const session: PlayerSession = {
      token: randomBytes(24).toString('base64url'),
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

    const room = this.rooms.get(session.roomCode);
    if (!room) return undefined;

    const updated = setPlayerConnected(room, playerId, false);
    this.rooms.set(session.roomCode, updated);
    return updated;
  }

  /** Frees the seat once the grace period is over, if the player still hasn't come back. */
  expire(playerId: string): Room | undefined {
    const session = this.sessionsByPlayer.get(playerId);
    const room = session && this.rooms.get(session.roomCode);
    if (!session || !room) return undefined;
    if (room.players.find((p) => p.id === playerId)?.connected) return undefined;

    this.deleteSession(session);
    const updated = removePlayer(room, playerId);
    this.rooms.set(session.roomCode, updated);
    return updated;
  }

  /** Deletes the room and its sessions; returns the ids of the players who were in it. */
  close(code: string): string[] {
    const room = this.rooms.get(code);
    this.rooms.delete(code);
    if (!room) return [];

    for (const { id } of room.players) {
      const session = this.sessionsByPlayer.get(id);
      if (session) this.deleteSession(session);
    }
    return room.players.map((p) => p.id);
  }

  private deleteSession(session: PlayerSession): void {
    this.sessionsByToken.delete(session.token);
    this.sessionsByPlayer.delete(session.playerId);
  }
}
