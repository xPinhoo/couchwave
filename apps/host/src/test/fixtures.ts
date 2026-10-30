import type { LobbyState, PublicPlayer } from '@couchwave/shared';

export function player(id: string, name: string, overrides: Partial<PublicPlayer> = {}) {
  return {
    id,
    name,
    avatar: { kind: 'preset', id: 'happy-bot' },
    connected: true,
    ...overrides,
  } satisfies PublicPlayer;
}

export function lobbyState(overrides: Partial<LobbyState> = {}): LobbyState {
  const players = overrides.players ?? [];
  return {
    roomCode: 'WXYZ',
    status: 'lobby',
    maxPlayers: 8,
    players,
    leaderId: players[0]?.id ?? null,
    screenConnected: true,
    selectedGame: 0,
    setup: null,
    ...overrides,
  };
}
