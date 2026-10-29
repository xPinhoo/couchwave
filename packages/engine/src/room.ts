import {
  AVATAR_PRESETS,
  DEFAULT_DRAW_OPTIONS,
  DEFAULT_TRIVIA_OPTIONS,
  GAMES,
  MAX_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  type Avatar,
  type ErrorCode,
  type GameId,
  type GameSetup,
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
  /** Settings and ready-up of the chosen game; kept after a game so the next one reuses them. */
  setup: GameSetup | null;
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
    setup: null,
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
  const setup = room.setup && {
    ...room.setup,
    readyIds: room.setup.readyIds.filter((id) => id !== playerId),
  };
  return { ...room, players, leaderId, setup };
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

/**
 * Opens the setup screen of a game. Playing the same game again starts from the last
 * settings; otherwise from the defaults. Nobody is ready yet.
 */
export function openSetup(room: Room, gameId: GameId): Room {
  const setup: GameSetup =
    room.setup?.gameId === gameId
      ? { ...room.setup, readyIds: [] }
      : gameId === 'draw'
        ? { gameId, options: DEFAULT_DRAW_OPTIONS, readyIds: [] }
        : { gameId, options: DEFAULT_TRIVIA_OPTIONS, readyIds: [] };
  return { ...room, status: 'setup', setup };
}

/**
 * Changing the settings un-readies the leader: they confirm again when they're done.
 * The options must belong to the game being set up (the server validates them per game).
 */
export function setSetupOptions(room: Room, options: GameSetup['options']): Room {
  if (!room.setup) return room;
  return {
    ...room,
    setup: {
      ...room.setup,
      options,
      readyIds: room.setup.readyIds.filter((id) => id !== room.leaderId),
    } as GameSetup,
  };
}

export function setReady(room: Room, playerId: string, ready: boolean): Room {
  if (!room.setup || !room.players.some((p) => p.id === playerId)) return room;
  const others = room.setup.readyIds.filter((id) => id !== playerId);
  return {
    ...room,
    // Keep join order, so the ready list reads naturally
    setup: {
      ...room.setup,
      readyIds: room.players
        .map((p) => p.id)
        .filter((id) => others.includes(id) || (ready && id === playerId)),
    },
  };
}

/**
 * Whether the game can start: every connected player is ready (and there is at least one).
 * Disconnected players don't hold the room hostage; they get the next game.
 */
export function everyoneReady(room: Room): boolean {
  if (room.status !== 'setup' || !room.setup) return false;
  const connected = room.players.filter((p) => p.connected);
  return connected.length > 0 && connected.every((p) => room.setup!.readyIds.includes(p.id));
}

/** The players who take part when the game starts: everyone connected right now. */
export function startingPlayerIds(room: Room): string[] {
  return room.players.filter((p) => p.connected).map((p) => p.id);
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
    setup: room.setup,
  };
}
