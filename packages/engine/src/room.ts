import {
  MAX_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type ErrorCode,
  type LobbyState,
} from '@couchwave/shared';

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  joinedAt: number;
}

export type RoomStatus = 'lobby' | 'playing';

export interface Room {
  code: string;
  status: RoomStatus;
  players: Player[];
  createdAt: number;
}

export type JoinResult =
  | { ok: true; room: Room; player: Player }
  | { ok: false; error: Extract<ErrorCode, 'ROOM_FULL' | 'NAME_TAKEN' | 'GAME_IN_PROGRESS'> };

/** `random` returns a number in [0, 1) — injectable so tests are deterministic. */
export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function createRoom(code: string, now: number): Room {
  return { code, status: 'lobby', players: [], createdAt: now };
}

export function addPlayer(
  room: Room,
  input: { id: string; name: string; now: number },
): JoinResult {
  if (room.status !== 'lobby') return { ok: false, error: 'GAME_IN_PROGRESS' };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, error: 'ROOM_FULL' };

  const nameKey = input.name.toLocaleLowerCase();
  if (room.players.some((p) => p.name.toLocaleLowerCase() === nameKey)) {
    return { ok: false, error: 'NAME_TAKEN' };
  }

  const player: Player = { id: input.id, name: input.name, connected: true, joinedAt: input.now };
  return { ok: true, room: { ...room, players: [...room.players, player] }, player };
}

export function removePlayer(room: Room, playerId: string): Room {
  return { ...room, players: room.players.filter((p) => p.id !== playerId) };
}

export function toLobbyState(room: Room): LobbyState {
  return {
    roomCode: room.code,
    players: room.players.map(({ id, name, connected }) => ({ id, name, connected })),
    maxPlayers: MAX_PLAYERS,
  };
}
