/** Built-in avatars: an emoji on a coloured circle. Same list on the TV and the phones. */
export const AVATAR_PRESETS = [
  { id: 'fox', emoji: '🦊', color: '#ff8a3d' },
  { id: 'frog', emoji: '🐸', color: '#3fbf7f' },
  { id: 'panda', emoji: '🐼', color: '#8f88b8' },
  { id: 'octopus', emoji: '🐙', color: '#ff5ca8' },
  { id: 'unicorn', emoji: '🦄', color: '#b57bff' },
  { id: 'tiger', emoji: '🐯', color: '#f5a623' },
  { id: 'monkey', emoji: '🐵', color: '#b5783e' },
  { id: 'penguin', emoji: '🐧', color: '#4f8ff7' },
  { id: 'koala', emoji: '🐨', color: '#7d8ba1' },
  { id: 'dino', emoji: '🦖', color: '#2fa84f' },
  { id: 'bee', emoji: '🐝', color: '#e6c400' },
  { id: 'dog', emoji: '🐶', color: '#e8743b' },
  { id: 'alien', emoji: '👽', color: '#22b8a0' },
  { id: 'robot', emoji: '🤖', color: '#5c6b80' },
  { id: 'ghost', emoji: '👻', color: '#9aa6c4' },
  { id: 'cat', emoji: '🐱', color: '#f0607a' },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]['id'];

/** A built-in avatar, or a small square photo (selfie) as a data URL. */
export type Avatar = { kind: 'preset'; id: AvatarPresetId } | { kind: 'photo'; dataUrl: string };

/** Photos are resized on the phone to this size before they are sent. */
export const AVATAR_PHOTO_SIZE = 160;

/** About 45 KB of base64: plenty for a 160px JPEG, small enough to send to every screen. */
export const AVATAR_PHOTO_MAX_CHARS = 60_000;

export function presetAvatar(id: string) {
  return AVATAR_PRESETS.find((preset) => preset.id === id) ?? AVATAR_PRESETS[0];
}

/** Emoji players can send to the TV while they wait. */
export const REACTIONS = ['🎉', '😂', '🔥', '👏', '😱', '💩'] as const;

export type Reaction = (typeof REACTIONS)[number];

/** Minimum time between two reactions from the same player. */
export const REACTION_COOLDOWN_MS = 300;

/** The games that can be played (the library also lists some that are coming soon). */
export type GameId = 'trivia' | 'draw';

export interface GameInfo {
  id: string;
  name: string;
  emoji: string;
  description: string;
  available: boolean;
  minPlayers: number;
}

/** What the games library shows, in order. */
export const GAMES: readonly GameInfo[] = [
  {
    id: 'trivia',
    name: 'Quick-fire trivia',
    emoji: '🧠',
    description: 'Answer fast for more points, but wrong answers cost you.',
    available: true,
    minPlayers: 1,
  },
  {
    id: 'bluff',
    name: 'Bluff',
    emoji: '🤥',
    description: 'Write fake answers and fool your friends.',
    available: false,
    minPlayers: 3,
  },
  {
    id: 'draw',
    name: 'Draw & Guess',
    emoji: '🎨',
    description: 'Draw on your phone, everyone else guesses the word.',
    available: true,
    minPlayers: 2,
  },
];

export function gameInfo(id: GameId): GameInfo {
  const game = GAMES.find((g) => g.id === id);
  if (!game) throw new Error(`Unknown game ${id}`);
  return game;
}
