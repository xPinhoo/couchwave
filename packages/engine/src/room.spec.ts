import {
  AUTO_LIBRARY_PLAYERS,
  INITIAL_LIBRARY_CURSOR,
  DEFAULT_DRAW_OPTIONS,
  DEFAULT_TRIVIA_OPTIONS,
  MAX_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type TriviaOptions,
} from '@couchwave/shared';
import { describe, expect, it } from 'vitest';
import {
  addPlayer,
  createRoom,
  everyoneReady,
  generateRoomCode,
  isLeader,
  moveLibrary,
  openLibrary,
  openSetup,
  removePlayer,
  setPlayerConnected,
  setReady,
  setRoomStatus,
  setSetupOptions,
  shouldAutoOpenLibrary,
  startingPlayerIds,
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
        avatar: { kind: 'preset', id: 'happy-bot' },
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
      { kind: 'preset', id: 'happy-bot' },
      { kind: 'preset', id: 'dino' },
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

describe('game setup', () => {
  const music: TriviaOptions = { topic: 'music', secondsPerQuestion: 30, questionCount: 20 };
  const setupRoom = () => openSetup(roomWith('ana', 'rui'), 'trivia');
  const readyIds = (room: Room) => room.setup?.readyIds;

  it('opens with the default settings and nobody ready', () => {
    expect(setupRoom()).toMatchObject({
      status: 'setup',
      setup: { gameId: 'trivia', options: DEFAULT_TRIVIA_OPTIONS, readyIds: [] },
    });
  });

  it('remembers the settings of the previous game', () => {
    const played = { ...setSetupOptions(setupRoom(), music), status: 'library' as const };
    expect(openSetup(played, 'trivia').setup?.options).toEqual(music);
  });

  it('starts another game from its own defaults', () => {
    const played = { ...setSetupOptions(setupRoom(), music), status: 'library' as const };
    expect(openSetup(played, 'draw').setup).toEqual({
      gameId: 'draw',
      options: DEFAULT_DRAW_OPTIONS,
      readyIds: [],
    });
  });

  it('keeps the ready list in join order and lets players change their mind', () => {
    let room = setReady(setupRoom(), 'rui', true);
    room = setReady(room, 'ana', true);
    expect(readyIds(room)).toEqual(['ana', 'rui']);
    expect(readyIds(setReady(room, 'rui', false))).toEqual(['ana']);
  });

  it('un-readies only the leader when the settings change', () => {
    let room = setReady(setReady(setupRoom(), 'ana', true), 'rui', true);
    room = setSetupOptions(room, music);
    expect(room.setup?.options).toEqual(music);
    expect(readyIds(room)).toEqual(['rui']);
  });

  it('is ready to start once every connected player is ready', () => {
    let room = setReady(setupRoom(), 'ana', true);
    expect(everyoneReady(room)).toBe(false);
    room = setReady(room, 'rui', true);
    expect(everyoneReady(room)).toBe(true);
  });

  it('does not wait for disconnected players, and leaves them out of the game', () => {
    let room = setPlayerConnected(setupRoom(), 'rui', false);
    room = setReady(room, 'ana', true);
    expect(everyoneReady(room)).toBe(true);
    expect(startingPlayerIds(room)).toEqual(['ana']);
  });

  it('forgets the ready state of players who leave', () => {
    const room = removePlayer(setReady(setupRoom(), 'rui', true), 'rui');
    expect(readyIds(room)).toEqual([]);
  });

  it('ignores ready from players who are not in the room', () => {
    const room = setupRoom();
    expect(setReady(room, 'stranger', true)).toBe(room);
  });
});

describe('moveLibrary', () => {
  it('starts on the first game of the first tab and moves like a TV remote', () => {
    const room = createRoom('ABCD', 0);
    expect(room.library).toEqual(INITIAL_LIBRARY_CURSOR);
    expect(moveLibrary(room, 'up').library.focus).toEqual({ area: 'tabs', index: 0 });
    // Nothing to the left of the first game: the focus stays put
    expect(moveLibrary(room, 'left').library).toBe(room.library);
  });
});

describe('opening the library', () => {
  it(`opens by itself once ${AUTO_LIBRARY_PLAYERS} players are in the lobby`, () => {
    expect(shouldAutoOpenLibrary(roomWith('a', 'b'))).toBe(false);
    expect(shouldAutoOpenLibrary(roomWith('a', 'b', 'c'))).toBe(true);
  });

  it('only does it the first time, so a leader waiting for more players stays put', () => {
    const backInLobby = setRoomStatus(openLibrary(roomWith('a')), 'lobby');
    expect(backInLobby.libraryOpened).toBe(true);
    expect(
      shouldAutoOpenLibrary({ ...backInLobby, players: roomWith('a', 'b', 'c').players }),
    ).toBe(false);
  });

  it('never interrupts a game being set up or played', () => {
    expect(shouldAutoOpenLibrary(setRoomStatus(roomWith('a', 'b', 'c'), 'setup'))).toBe(false);
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
      players: [
        { id: 'Ana', name: 'Ana', avatar: { kind: 'preset', id: 'happy-bot' }, connected: true },
      ],
      leaderId: 'Ana',
      maxPlayers: MAX_PLAYERS,
      screenConnected: true,
      library: INITIAL_LIBRARY_CURSOR,
      setup: null,
    });
  });
});
