import {
  addPlayer,
  createRoom,
  generateRoomCode,
  removePlayer,
  type JoinResult,
  type Room,
} from '@couchwave/engine';
import type { ErrorCode } from '@couchwave/shared';
import { Injectable } from '@nestjs/common';

/**
 * Owns room state. In-memory for now — moving this to Redis is what will let the
 * API run as more than one instance.
 */
@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();

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

  join(
    code: string,
    player: { id: string; name: string },
  ): JoinResult | { ok: false; error: Extract<ErrorCode, 'ROOM_NOT_FOUND'> } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'ROOM_NOT_FOUND' };

    const result = addPlayer(room, { ...player, now: this.clock() });
    if (result.ok) this.rooms.set(code, result.room);
    return result;
  }

  leave(code: string, playerId: string): Room | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    const updated = removePlayer(room, playerId);
    this.rooms.set(code, updated);
    return updated;
  }

  close(code: string): void {
    this.rooms.delete(code);
  }
}
