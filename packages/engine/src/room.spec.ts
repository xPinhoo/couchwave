import { GAMES, MAX_PLAYERS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@couchwave/shared';
import { describe, expect, it } from 'vitest';
import {
  addPlayer,
  createRoom,
  generateRoomCode,
  isLeader,
  moveGameSelection,
  removePlayer,
  setPlayerConnected,
  toLobbyState,
  type Room,
} from './room.js';

const join = (room: Room, id: string, name = id) => addPlayer(room, { id, name, now: 1 });

function roomWith(...names: string[]): Room {
  let room = createRoom('ABCD', 0);
  for (const name of names) {
    const result = join(room, name);
    if (!result.ok) throw new Error(result.error);
    room = result.room;
  }
  return room;
}

describe('generateRoomCode', () => {
  it('uses only allowed characters and the right length', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    for (const char of code) expect(ROOM_CODE_ALPHABET).toContain(char);
  });

  it('is deterministic for a given random source', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAA');
    expect(generateRoomCode(() => 0.9999)).toBe('ZZZZ');
  });
});

describe('addPlayer', () => {
  it('adds a connected player without mutating the original room', () => {
    const room = createRoom('ABCD', 0);
    const result = join(room, 'p1', 'Ana');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.room.players).toEqual([
      {
        id: 'p1',
        name: 'Ana',
        avatar: { kind: 'preset', id: 'fox' },
        connected: true,
        joinedAt: 1,
      },
    ]);
    expect(room.players).toHaveLength(0);
  });

  it('keeps the avatar the player picked', () => {
    const avatar = { kind: 'photo', dataUrl: 'data:image/jpeg;base64,AAAA' } as const;
    const result = addPlayer(createRoom('ABCD', 0), { id: 'p1', name: 'Ana', avatar, now: 1 });
    expect(result.ok && result.player.avatar).toEqual(avatar);
  });

  it('gives players without an avatar a preset nobody else is using', () => {
    const room = roomWith('a', 'b');
    expect(room.players.map((p) => p.avatar)).toEqual([
      { kind: 'preset', id: 'fox' },
      { kind: 'preset', id: 'frog' },
    ]);
  });

  it('lets players join while the host is picking a game', () => {
    const room: Room = { ...roomWith('Ana'), status: 'library' };
    expect(join(room, 'p2', 'Rui').ok).toBe(true);
  });

  it('rejects duplicate names case-insensitively', () => {
    const room = roomWith('Ana');
    expect(join(room, 'p2', 'ANA')).toEqual({ ok: false, error: 'NAME_TAKEN' });
  });

  it('rejects players once the room is full', () => {
    const room = roomWith(...Array.from({ length: MAX_PLAYERS }, (_, i) => `p${i}`));
    expect(join(room, 'late')).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('rejects players while a game is in progress', () => {
    const room: Room = { ...createRoom('ABCD', 0), status: 'playing' };
    expect(join(room, 'p1')).toEqual({ ok: false, error: 'GAME_IN_PROGRESS' });
  });
});

describe('removePlayer', () => {
  it('removes only the given player', () => {
    const room = removePlayer(roomWith('a', 'b', 'c'), 'b');
    expect(room.players.map((p) => p.id)).toEqual(['a', 'c']);
  });
});

describe('leader', () => {
  it('is the first player to join', () => {
    expect(createRoom('ABCD', 0).leaderId).toBeNull();
    expect(roomWith('ana', 'rui').leaderId).toBe('ana');
  });

  it('passes to the next player in join order when the leader is removed', () => {
    const room = removePlayer(roomWith('ana', 'rui', 'eva'), 'ana');
    expect(room.leaderId).toBe('rui');
    expect(isLeader(room, 'rui')).toBe(true);
    expect(isLeader(room, 'ana')).toBe(false);
  });

  it('stays the same when someone else is removed, and is cleared when the room empties', () => {
    expect(removePlayer(roomWith('ana', 'rui'), 'rui').leaderId).toBe('ana');
    expect(removePlayer(roomWith('ana'), 'ana').leaderId).toBeNull();
  });

  it('goes to the next player who joins an empty room', () => {
    const emptied = removePlayer(roomWith('ana'), 'ana');
    const result = join(emptied, 'rui');
    expect(result.ok && result.room.leaderId).toBe('rui');
  });
});

describe('moveGameSelection', () => {
  it('moves the highlight and wraps around at both ends', () => {
    const room = createRoom('ABCD', 0);
    expect(moveGameSelection(room, 1).selectedGame).toBe(1);
    expect(moveGameSelection(room, -1).selectedGame).toBe(GAMES.length - 1);

    const last = { ...room, selectedGame: GAMES.length - 1 };
    expect(moveGameSelection(last, 1).selectedGame).toBe(0);
  });
});

describe('setPlayerConnected', () => {
  it('flags only the given player', () => {
    const room = setPlayerConnected(roomWith('a', 'b'), 'a', false);
    expect(room.players.map((p) => p.connected)).toEqual([false, true]);
  });

  it('keeps a disconnected player in their seat so the name stays reserved', () => {
    const room = setPlayerConnected(roomWith('Ana'), 'Ana', false);
    expect(join(room, 'p2', 'Ana')).toEqual({ ok: false, error: 'NAME_TAKEN' });
  });
});

describe('toLobbyState', () => {
  it('exposes only public player fields', () => {
    expect(toLobbyState(roomWith('Ana'))).toEqual({
      roomCode: 'ABCD',
      status: 'lobby',
      players: [{ id: 'Ana', name: 'Ana', avatar: { kind: 'preset', id: 'fox' }, connected: true }],
      leaderId: 'Ana',
      maxPlayers: MAX_PLAYERS,
      screenConnected: true,
      selectedGame: 0,
    });
  });
});
