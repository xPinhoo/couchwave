import {
  AVATAR_PRESETS,
  GAMES,
  MAX_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type Avatar,
  type ErrorCode,
  type LobbyState,
  type RoomStatus,
} from '@couchwave/shared';

export interface Player {
  id: string;
  name: string;
  avatar: Avatar;
  connected: boolean;
  joinedAt: number;
}

export interface Room {
  code: string;
  status: RoomStatus;
  players: Player[];
  /** The player who controls the room from their phone (start, kick, end). */
  leaderId: string | null;
  /** Whether the TV screen that shows this room is currently connected. */
  screenConnected: boolean;
  /** Index into `GAMES` of the game highlighted in the library. */
  selectedGame: number;
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
  return {
    code,
    status: 'lobby',
    players: [],
    leaderId: null,
    screenConnected: true,
    selectedGame: 0,
    createdAt: now,
  };
}

/** The first preset nobody in the room is using yet, for players who didn't pick one. */
export function freePresetAvatar(room: Room): Avatar {
  const taken = new Set(
    room.players.flatMap((p) => (p.avatar.kind === 'preset' ? [p.avatar.id] : [])),
  );
  const preset = AVATAR_PRESETS.find((p) => !taken.has(p.id)) ?? AVATAR_PRESETS[0];
  return { kind: 'preset', id: preset.id };
}

/** New players can join in the lobby and while the host is picking a game, not mid-game. */
export function addPlayer(
  room: Room,
  input: { id: string; name: string; avatar?: Avatar; now: number },
): JoinResult {
  if (room.status === 'playing') return { ok: false, error: 'GAME_IN_PROGRESS' };
  if (room.players.length >= MAX_PLAYERS) return { ok: false, error: 'ROOM_FULL' };

  const nameKey = input.name.toLocaleLowerCase();
  if (room.players.some((p) => p.name.toLocaleLowerCase() === nameKey)) {
    return { ok: false, error: 'NAME_TAKEN' };
  }

  const player: Player = {
    id: input.id,
    name: input.name,
    avatar: input.avatar ?? freePresetAvatar(room),
    connected: true,
    joinedAt: input.now,
  };
  return {
    ok: true,
    room: {
      ...room,
      players: [...room.players, player],
      // The first player in becomes the leader
      leaderId: room.leaderId ?? player.id,
    },
    player,
  };
}

/** Removing the leader hands leadership to the next player, in join order. */
export function removePlayer(room: Room, playerId: string): Room {
  const players = room.players.filter((p) => p.id !== playerId);
  const leaderId = room.leaderId === playerId ? (players[0]?.id ?? null) : room.leaderId;
  return { ...room, players, leaderId };
}

export function isLeader(room: Room, playerId: string | undefined): boolean {
  return playerId !== undefined && room.leaderId === playerId;
}

/** A disconnected player keeps their seat (and name) until they come back or are removed. */
export function setPlayerConnected(room: Room, playerId: string, connected: boolean): Room {
  return {
    ...room,
    players: room.players.map((p) => (p.id === playerId ? { ...p, connected } : p)),
  };
}

export function setScreenConnected(room: Room, screenConnected: boolean): Room {
  return { ...room, screenConnected };
}

export function setRoomStatus(room: Room, status: RoomStatus): Room {
  return { ...room, status };
}

/** Moves the library highlight, wrapping around at both ends. */
export function moveGameSelection(room: Room, delta: number): Room {
  const count = GAMES.length;
  return { ...room, selectedGame: (((room.selectedGame + delta) % count) + count) % count };
}

export function toLobbyState(room: Room): LobbyState {
  return {
    roomCode: room.code,
    status: room.status,
    players: room.players.map(({ id, name, avatar, connected }) => ({
      id,
      name,
      avatar,
      connected,
    })),
    leaderId: room.leaderId,
    maxPlayers: MAX_PLAYERS,
    screenConnected: room.screenConnected,
    selectedGame: room.selectedGame,
  };
}
