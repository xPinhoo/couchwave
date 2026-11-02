import type { LeaderboardEntry } from './games.js';

/**
 * Guess the Color: the TV shows something famous with its main colour missing, and each
 * player tries to mix that colour on their phone. The closer the hex code, the more points.
 */

export const COLOR_CATEGORIES = [
  { id: 'mix', name: 'A bit of everything', emoji: '🎲' },
  { id: 'characters', name: 'Characters', emoji: '🦸' },
  { id: 'things', name: 'Things', emoji: '🚌' },
  { id: 'flags', name: 'Flags', emoji: '🏳️' },
  { id: 'brands', name: 'Brands', emoji: '🏷️' },
] as const;

export type ColorCategory = (typeof COLOR_CATEGORIES)[number]['id'];

export function colorCategory(id: ColorCategory) {
  return COLOR_CATEGORIES.find((category) => category.id === id) ?? COLOR_CATEGORIES[0];
}

export const COLOR_ROUNDS_OPTIONS = [5, 10, 15] as const;
export const COLOR_SECONDS_OPTIONS = [15, 20, 30, 45] as const;

export interface ColorOptions {
  category: ColorCategory;
  rounds: (typeof COLOR_ROUNDS_OPTIONS)[number];
  secondsToPick: (typeof COLOR_SECONDS_OPTIONS)[number];
}

export const DEFAULT_COLOR_OPTIONS: ColorOptions = {
  category: 'mix',
  rounds: 5,
  secondsToPick: 20,
};

/** Lowercase, like `#ff0000`. */
export const HEX_COLOR = /^#[0-9a-f]{6}$/;

// ── Hex and HSL ──────────────────────────────────────────────────────────────

export interface Hsl {
  /** 0 to 360. */
  h: number;
  /** 0 to 100. */
  s: number;
  /** 0 to 100. */
  l: number;
}

export function hslToHex({ h, s, l }: Hsl): string {
  const light = l / 100;
  const amount = (s / 100) * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = light - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function hexToHsl(hex: string): Hsl {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const range = max - min;
  const l = (max + min) / 2;
  const s = range === 0 ? 0 : range / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (range !== 0) {
    if (max === r) h = ((g - b) / range + 6) % 6;
    else if (max === g) h = (b - r) / range + 2;
    else h = (r - g) / range + 4;
  }
  return { h: h * 60, s: s * 100, l: l * 100 };
}

// ── Game views ───────────────────────────────────────────────────────────────

/** countdown: "get ready" · pick: everyone mixes a colour · reveal: the real one · finished */
export type ColorPhase = 'countdown' | 'pick' | 'reveal' | 'finished';

export interface ColorResult {
  playerId: string;
  /** null: they didn't pick anything in time. */
  color: string | null;
  /** How close they got, from 0 to 100. */
  accuracy: number;
  points: number;
}

export interface ColorHostView {
  game: 'color';
  phase: ColorPhase;
  category: ColorCategory;
  /** 1-based. */
  round: number;
  totalRounds: number;
  /** Which picture to draw, and what it is. Empty during the countdown. */
  puzzleId: string;
  name: string;
  endsAt: number | null;
  playerIds: string[];
  /** Who has locked in their colour (not which one). */
  lockedIds: string[];
  /** The real colour, during the reveal. */
  answer: string | null;
  /** This round, best first, during the reveal. */
  results: ColorResult[];
  leaderboard: LeaderboardEntry[];
}

export interface ColorPlayerView {
  game: 'color';
  phase: ColorPhase;
  round: number;
  totalRounds: number;
  name: string;
  endsAt: number | null;
  /** What you've mixed so far, to pick up after a reload. */
  myColor: string | null;
  locked: boolean;
  lockedCount: number;
  answer: string | null;
  /** How you did this round, during the reveal. */
  result: ColorResult | null;
  score: number;
  /** 1-based; players with the same score share a rank. */
  rank: number;
  playerCount: number;
}
