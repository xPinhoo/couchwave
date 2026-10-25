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
    const { code } = service.create('screen').room;
    const joined = service.join(code, { id: 'ana', name: 'Ana' }, 's1');
    if (!joined.ok) throw new Error(joined.error);
    return { code, token: joined.sessionToken };
  }

  const connectedOf = (code: string) => service.get(code)?.players.map((p) => p.connected);

  it('creates a room in the lobby', () => {
    const room = service.create('screen').room;
    expect(room).toMatchObject({ status: 'lobby', players: [], createdAt: 1000 });
    expect(service.get(room.code)).toBe(room);
  });

  it('never reuses a code that is already taken', () => {
    // The first two attempts both draw AAAA, so the second room must retry and get ZZZZ
    const draws = [0, 0, 0, 0, 0, 0, 0, 0, 0.99, 0.99, 0.99, 0.99];
    service.random = () => draws.shift() ?? 0.99;

    expect(service.create('screen').room.code).toBe('AAAA');
    expect(service.create('screen').room.code).toBe('ZZZZ');
  });

  it('returns ROOM_NOT_FOUND for an unknown code', () => {
    expect(service.join('NOPE', { id: 'p1', name: 'Ana' }, 's1')).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
  });

  it('persists joined players and gives each one a distinct session token', () => {
    const { code } = service.create('screen').room;
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

  describe('TV screen', () => {
    it('can take its room back on a new connection after a refresh', () => {
      const { room, screenToken } = service.create('tv1');

      expect(service.screenDisconnected(room.code, 'tv1')?.screenConnected).toBe(false);
      expect(service.resumeScreen(screenToken, 'tv2')).toMatchObject({
        ok: true,
        previousConnectionId: 'tv1',
        room: { code: room.code, screenConnected: true },
      });
    });

    it('ignores a late disconnect from a screen that was already replaced', () => {
      const { room, screenToken } = service.create('tv1');
      service.resumeScreen(screenToken, 'tv2');

      expect(service.screenDisconnected(room.code, 'tv1')).toBeUndefined();
      expect(service.get(room.code)?.screenConnected).toBe(true);
    });

    it('rejects unknown screen tokens', () => {
      expect(service.resumeScreen('nope', 'tv2')).toEqual({
        ok: false,
        error: 'INVALID_SESSION',
      });
    });
  });

  it('closing a room deletes it and invalidates every session in it', () => {
    const { room, screenToken } = service.create('tv1');
    const ana = service.join(room.code, { id: 'ana', name: 'Ana' }, 's1');

    expect(service.close(room.code)).toEqual(['ana']);
    expect(service.get(room.code)).toBeUndefined();
    expect(ana.ok && service.rejoin(ana.sessionToken, 's2')).toEqual({
      ok: false,
      error: 'INVALID_SESSION',
    });
    expect(service.resumeScreen(screenToken, 'tv2')).toEqual({
      ok: false,
      error: 'INVALID_SESSION',
    });
  });
});
