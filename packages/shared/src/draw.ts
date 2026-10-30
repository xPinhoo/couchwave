import type { LeaderboardEntry } from './games.js';

/**
 * Draw & Guess: each turn one player draws a word on their phone, the strokes appear live
 * on the TV, and everyone else types guesses on their phones.
 */

export const DRAW_SECONDS_OPTIONS = [45, 60, 90] as const;
/** How many times everyone gets to draw. */
export const DRAW_ROUNDS_OPTIONS = [1, 2, 3] as const;

export interface DrawOptions {
  secondsToDraw: (typeof DRAW_SECONDS_OPTIONS)[number];
  rounds: (typeof DRAW_ROUNDS_OPTIONS)[number];
}

export const DEFAULT_DRAW_OPTIONS: DrawOptions = { secondsToDraw: 60, rounds: 1 };

/** The artist picks one of this many words at the start of their turn. */
export const DRAW_WORD_CHOICES = 3;

export const GUESS_MAX_LENGTH = 32;

/** Pen colours. White doubles as the eraser, since the canvas is white. */
export const DRAW_COLORS = [
  '#1b1b1f',
  '#e5484d',
  '#f76b15',
  '#ffc53d',
  '#30a46c',
  '#3e63dd',
  '#8e4ec6',
  '#ffffff',
] as const;

/** Pen widths, in thousandths of the canvas width. */
export const DRAW_SIZES = [6, 14, 32] as const;

/**
 * Canvases are 16:9 on every screen, so a drawing looks the same on the phone (turned
 * sideways) and the TV.
 */
export const DRAW_ASPECT = 16 / 9;

/** Points are sent as integers from 0 to this, relative to the canvas width and height. */
export const DRAW_COORD_MAX = 1000;

/** Most numbers (x, y, x, y…) one stroke update may carry. */
export const STROKE_CHUNK_MAX = 256;

/**
 * One continuous line. `points` is a flat list of coordinates, x then y, each 0–1000.
 * While the artist draws, a stroke arrives in chunks that share its `id`.
 */
export interface Stroke {
  id: number;
  /** Index into DRAW_COLORS. */
  color: number;
  /** Index into DRAW_SIZES. */
  size: number;
  points: number[];
}

/**
 * choosing: the artist picks a word · drawing: the artist draws, the others guess ·
 * reveal: the word is shown with this turn's points · finished: final scores
 */
export type DrawPhase = 'choosing' | 'drawing' | 'reveal' | 'finished';

/** A wrong guess, shown on the TV for everyone to laugh at. */
export interface DrawGuess {
  playerId: string;
  text: string;
}

export interface DrawHostView {
  game: 'draw';
  phase: DrawPhase;
  /** 1-based. */
  turn: number;
  totalTurns: number;
  artistId: string;
  endsAt: number | null;
  /** The word with unrevealed letters as "_" (e.g. "c_t"); the full word from the reveal on. */
  hint: string;
  /** Who guessed the word this turn, in the order they got it. */
  guessedIds: string[];
  /** The most recent wrong guesses, oldest first. */
  feed: DrawGuess[];
  playerIds: string[];
  leaderboard: LeaderboardEntry[];
}

/** Private feedback on your last guess. "close" means one letter off. */
export type GuessFeedback = 'correct' | 'close' | 'wrong';

export interface DrawPlayerView {
  game: 'draw';
  phase: DrawPhase;
  turn: number;
  totalTurns: number;
  artistId: string;
  isArtist: boolean;
  endsAt: number | null;
  /** The artist's options while choosing; empty for everyone else. */
  wordChoices: string[];
  /** The artist sees the word while drawing; everyone sees it from the reveal on. */
  word: string | null;
  hint: string;
  /** You guessed this turn's word. */
  guessed: boolean;
  lastGuess: GuessFeedback | null;
  /** Points won on the last turn, from the reveal on. */
  gained: number;
  score: number;
  /** 1-based; players with the same score share a rank. */
  rank: number;
  playerCount: number;
}

/** The parts of a browser canvas context that painting strokes needs. */
export interface StrokeCanvas {
  lineCap: string;
  lineJoin: string;
  lineWidth: number;
  strokeStyle: unknown;
  fillStyle: unknown;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  stroke(): void;
  fill(): void;
}

/**
 * Paints strokes onto a canvas that is `width` × `height` pixels. Used by the TV and by the
 * artist's phone, so a drawing looks the same on both. A single point is painted as a dot.
 */
export function paintStrokes(
  ctx: StrokeCanvas,
  strokes: readonly Stroke[],
  width: number,
  height: number,
): void {
  const x = (value: number) => (value / DRAW_COORD_MAX) * width;
  const y = (value: number) => (value / DRAW_COORD_MAX) * height;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const { color, size, points } of strokes) {
    const lineWidth = ((DRAW_SIZES[size] ?? DRAW_SIZES[1]) / DRAW_COORD_MAX) * width;
    const style = DRAW_COLORS[color] ?? DRAW_COLORS[0];
    if (points.length < 2) continue;

    if (points.length === 2) {
      ctx.fillStyle = style;
      ctx.beginPath();
      ctx.arc(x(points[0]!), y(points[1]!), lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.strokeStyle = style;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x(points[0]!), y(points[1]!));
    for (let i = 2; i + 1 < points.length; i += 2) ctx.lineTo(x(points[i]!), y(points[i + 1]!));
    ctx.stroke();
  }
}

/** Adds a stroke update to a drawing: more points for the last stroke, or a new stroke. */
export function addStrokeChunk(strokes: readonly Stroke[], chunk: Stroke): Stroke[] {
  const last = strokes.at(-1);
  return last?.id === chunk.id
    ? [...strokes.slice(0, -1), { ...last, points: [...last.points, ...chunk.points] }]
    : [...strokes, chunk];
}

/** Turns words and guesses into a comparable form: lower case, no accents, single spaces. */
export function normalizeGuess(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
