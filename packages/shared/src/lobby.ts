import { AVATAR_ART } from './avatar-art.js';

export interface AvatarPreset {
  /** Also the drawing's file name in assets/profile-avatars. */
  id: keyof typeof AVATAR_ART;
  /** Shown on the native apps, which can't draw SVG yet. */
  emoji: string;
  color: string;
}

/** Built-in avatars: a drawing on a coloured circle. Same list on the TV and the phones. */
export const AVATAR_PRESETS = [
  { id: 'happy-bot', emoji: '🤖', color: '#c4b5fd' },
  { id: 'dino', emoji: '🦖', color: '#fbcfe8' },
  { id: 'cat', emoji: '🐱', color: '#bfdbfe' },
  { id: 'dog', emoji: '🐶', color: '#fde68a' },
  { id: 'pilot', emoji: '🧑‍✈️', color: '#a7f3d0' },
  { id: 'fighter', emoji: '🥊', color: '#fdba74' },
  { id: 'student', emoji: '🧑‍🎓', color: '#a5b4fc' },
  { id: 'thief', emoji: '🦹', color: '#fcd34d' },
  { id: 'tipsy', emoji: '🥴', color: '#fecaca' },
  { id: 'big-guy', emoji: '🧔‍♂️', color: '#99f6e4' },
  { id: 'nerd', emoji: '🤓', color: '#ffd166' },
  { id: 'gamer', emoji: '🎮', color: '#9fd8ff' },
  { id: 'explorer', emoji: '🤠', color: '#7cc6a4' },
  { id: 'executive', emoji: '💼', color: '#8fd6c3' },
  { id: 'bearded', emoji: '🧔', color: '#f4a261' },
  { id: 'turban', emoji: '👳', color: '#f6c453' },
  { id: 'grandma', emoji: '👵', color: '#f7a8b8' },
  { id: 'droid', emoji: '🤖', color: '#ffcf70' },
  { id: 'anonymous', emoji: '👤', color: '#4c5a78' },
] as const satisfies readonly AvatarPreset[];

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]['id'];

/** A built-in avatar, or a small square photo (selfie) as a data URL. */
export type Avatar = { kind: 'preset'; id: AvatarPresetId } | { kind: 'photo'; dataUrl: string };

/** Photos are resized on the phone to this size before they are sent. */
export const AVATAR_PHOTO_SIZE = 160;

/** About 45 KB of base64: plenty for a 160px JPEG, small enough to send to every screen. */
export const AVATAR_PHOTO_MAX_CHARS = 60_000;

/** Unknown ids (say, a preset that has since been removed) show as the anonymous silhouette. */
export function presetAvatar(id: string): AvatarPreset {
  return (
    AVATAR_PRESETS.find((preset) => preset.id === id) ??
    AVATAR_PRESETS.find((preset) => preset.id === 'anonymous')!
  );
}

/** The preset's drawing as a URL an <img> can show. */
export function avatarArtUrl(preset: AvatarPreset) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(AVATAR_ART[preset.id])}`;
}

/** Emoji players can send to the TV while they wait. */
export const REACTIONS = ['🎉', '😂', '🔥', '👏', '😱', '💩'] as const;

export type Reaction = (typeof REACTIONS)[number];

/** Minimum time between two reactions from the same player. */
export const REACTION_COOLDOWN_MS = 300;

/** The games that can be played (the library also lists some that are coming soon). */
export type GameId = 'trivia' | 'draw';

/** Library tabs: games grouped by how they play. */
export const GAME_CATEGORIES = [
  { id: 'quiz', name: 'Quiz', emoji: '🧠' },
  { id: 'creative', name: 'Creative', emoji: '🎨' },
] as const;

export type GameCategoryId = (typeof GAME_CATEGORIES)[number]['id'];

export interface GameInfo {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: GameCategoryId;
  available: boolean;
  minPlayers: number;
}

/** What the games library shows, in order, grouped by category. */
export const GAMES: readonly GameInfo[] = [
  {
    id: 'trivia',
    name: 'Quick-fire trivia',
    emoji: '🧠',
    description: 'Answer fast for more points, but wrong answers cost you.',
    category: 'quiz',
    available: true,
    minPlayers: 1,
  },
  {
    id: 'draw',
    name: 'Draw & Guess',
    emoji: '🎨',
    description: 'Draw on your phone, everyone else guesses the word.',
    category: 'creative',
    available: true,
    minPlayers: 2,
  },
  {
    id: 'bluff',
    name: 'Bluff',
    emoji: '🤥',
    description: 'Write fake answers and fool your friends.',
    category: 'creative',
    available: false,
    minPlayers: 3,
  },
];

/** The library opens by itself once this many players are in the lobby. */
export const AUTO_LIBRARY_PLAYERS = 3;

/** Indexes into `GAMES` of the games in a category, in library order. */
export function gamesInCategory(category: GameCategoryId): number[] {
  return GAMES.flatMap((game, index) => (game.category === category ? [index] : []));
}

/** Where a game sits in the library: its category's tab and its place within it. */
export function libraryPosition(gameIndex: number) {
  const category = GAMES[gameIndex]?.category ?? GAME_CATEGORIES[0].id;
  const games = gamesInCategory(category);
  return {
    categoryIndex: GAME_CATEGORIES.findIndex((c) => c.id === category),
    games,
    gameIndex: Math.max(0, games.indexOf(gameIndex)),
  };
}

/**
 * Moves the library highlight: along the games of the current category, or to the first game
 * of the previous or next category. Stops at the ends rather than wrapping around.
 */
export function moveInLibrary(selected: number, axis: 'game' | 'category', delta: -1 | 1) {
  const position = libraryPosition(selected);
  if (axis === 'game') {
    const target = position.games[position.gameIndex + delta];
    return target ?? selected;
  }
  const category = GAME_CATEGORIES[position.categoryIndex + delta];
  return category ? (gamesInCategory(category.id)[0] ?? selected) : selected;
}

export function gameInfo(id: GameId): GameInfo {
  const game = GAMES.find((g) => g.id === id);
  if (!game) throw new Error(`Unknown game ${id}`);
  return game;
}
