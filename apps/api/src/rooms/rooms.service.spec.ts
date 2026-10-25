import { beforeEach, describe, expect, it } from 'vitest';
import { RoomsService } from './rooms.service.js';

describe('RoomsService', () => {
  let service: RoomsService;

  beforeEach(() => {
    service = new RoomsService();
    service.clock = () => 1000;
  });

  /** Creates a room with Ana in it, connected through socket `s1`. */
  function roomWithAna() {
    const { code } = service.create();
    const joined = service.join(code, { id: 'ana', name: 'Ana' }, 's1');
    if (!joined.ok) throw new Error(joined.error);
    return { code, token: joined.sessionToken };
  }

  const connectedOf = (code: string) => service.get(code)?.players.map((p) => p.connected);

  it('creates a room in the lobby', () => {
    const room = service.create();
    expect(room).toMatchObject({ status: 'lobby', players: [], createdAt: 1000 });
    expect(service.get(room.code)).toBe(room);
  });

  it('never reuses a code that is already taken', () => {
    // The first two attempts both draw AAAA, so the second room must retry and get ZZZZ
    const draws = [0, 0, 0, 0, 0, 0, 0, 0, 0.99, 0.99, 0.99, 0.99];
    service.random = () => draws.shift() ?? 0.99;

    expect(service.create().code).toBe('AAAA');
    expect(service.create().code).toBe('ZZZZ');
  });

  it('returns ROOM_NOT_FOUND for an unknown code', () => {
    expect(service.join('NOPE', { id: 'p1', name: 'Ana' }, 's1')).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
  });

  it('persists joined players and gives each one a distinct session token', () => {
    const { code } = service.create();
    const ana = service.join(code, { id: 'p1', name: 'Ana' }, 's1');
    const rui = service.join(code, { id: 'p2', name: 'Rui' }, 's2');

    expect(service.get(code)?.players.map((p) => p.name)).toEqual(['Ana', 'Rui']);
    expect(ana.ok && rui.ok && ana.sessionToken !== rui.sessionToken).toBe(true);
  });

  describe('reconnection', () => {
    it('keeps the seat of a disconnected player', () => {
      const { code } = roomWithAna();
      service.disconnect('ana', 's1');
      expect(connectedOf(code)).toEqual([false]);
    });

    it('lets the player rejoin from a new connection with their token', () => {
      const { code, token } = roomWithAna();
      service.disconnect('ana', 's1');

      expect(service.rejoin(token, 's2')).toMatchObject({
        ok: true,
        playerId: 'ana',
        roomCode: code,
        previousConnectionId: 's1',
      });
      expect(connectedOf(code)).toEqual([true]);
    });

    it('ignores a late disconnect from a socket that already lost the seat', () => {
      const { code, token } = roomWithAna();
      service.rejoin(token, 's2');

      expect(service.disconnect('ana', 's1')).toBeUndefined();
      expect(connectedOf(code)).toEqual([true]);
    });

    it('rejects unknown tokens', () => {
      roomWithAna();
      expect(service.rejoin('not-a-token', 's2')).toEqual({ ok: false, error: 'INVALID_SESSION' });
    });

    it('frees the seat and invalidates the token when the grace period expires', () => {
      const { code, token } = roomWithAna();
      service.disconnect('ana', 's1');

      expect(service.expire('ana')?.players).toEqual([]);
      expect(service.get(code)?.players).toEqual([]);
      expect(service.rejoin(token, 's2')).toEqual({ ok: false, error: 'INVALID_SESSION' });
    });

    it('does not expire a player who came back in time', () => {
      const { code, token } = roomWithAna();
      service.disconnect('ana', 's1');
      service.rejoin(token, 's2');

      expect(service.expire('ana')).toBeUndefined();
      expect(connectedOf(code)).toEqual([true]);
    });
  });

  it('closing a room deletes it and invalidates its sessions', () => {
    const { code, token } = roomWithAna();

    expect(service.close(code)).toEqual(['ana']);
    expect(service.get(code)).toBeUndefined();
    expect(service.rejoin(token, 's2')).toEqual({ ok: false, error: 'INVALID_SESSION' });
  });
});
