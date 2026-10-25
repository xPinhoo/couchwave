import { beforeEach, describe, expect, it } from 'vitest';
import { RoomsService } from './rooms.service.js';

describe('RoomsService', () => {
  let service: RoomsService;

  beforeEach(() => {
    service = new RoomsService();
    service.clock = () => 1000;
  });

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
    expect(service.join('NOPE', { id: 'p1', name: 'Ana' })).toEqual({
      ok: false,
      error: 'ROOM_NOT_FOUND',
    });
  });

  it('persists joined players', () => {
    const { code } = service.create();
    service.join(code, { id: 'p1', name: 'Ana' });
    service.join(code, { id: 'p2', name: 'Rui' });

    expect(service.get(code)?.players.map((p) => p.name)).toEqual(['Ana', 'Rui']);
  });

  it('removes players who leave and deletes closed rooms', () => {
    const { code } = service.create();
    service.join(code, { id: 'p1', name: 'Ana' });

    expect(service.leave(code, 'p1')?.players).toEqual([]);
    service.close(code);
    expect(service.get(code)).toBeUndefined();
  });
});
