import { DRAW_COORD_MAX } from './draw.js';

/**
 * Drawing Phone: everyone writes a secret phrase, then the phrases travel from phone to
 * phone, drawn by one player and guessed by the next, until the TV reveals how each one
 * fell apart.
 */

export const PHONE_SECONDS_OPTIONS = [30, 60, 90, 120] as const;

export const PHONE_LANGUAGES = [
  { id: 'en', name: 'English', flag: '🇬🇧' },
  { id: 'pt', name: 'Português', flag: '🇵🇹' },
] as const;

export type PhoneLanguage = (typeof PHONE_LANGUAGES)[number]['id'];

export interface PhoneOptions {
  secondsToDraw: (typeof PHONE_SECONDS_OPTIONS)[number];
  /** The language of the random phrases. */
  language: PhoneLanguage;
}

export const DEFAULT_PHONE_OPTIONS: PhoneOptions = { secondsToDraw: 60, language: 'en' };

export function phoneLanguage(id: PhoneLanguage) {
  return PHONE_LANGUAGES.find((language) => language.id === id) ?? PHONE_LANGUAGES[0];
}

export const PHRASE_MAX_LENGTH = 60;

// ── Sketches ─────────────────────────────────────────────────────────────────

export const SKETCH_COLORS = [
  '#1b1b1f',
  '#8b8d98',
  '#ffffff',
  '#e5484d',
  '#f76b15',
  '#ffc53d',
  '#30a46c',
  '#12a594',
  '#3e63dd',
  '#8e4ec6',
  '#d6409f',
  '#a07553',
] as const;

/** Pen and shape widths, in thousandths of the canvas width. */
export const PEN_SIZES = [5, 12, 24, 40] as const;
/** Eraser widths, in thousandths of the canvas width. */
export const ERASER_SIZES = [20, 50, 100] as const;

export const SKETCH_SHAPES = ['line', 'rect', 'ellipse'] as const;
export type SketchShape = (typeof SKETCH_SHAPES)[number];

/** Most numbers (x, y, x, y…) in one freehand line; longer lines are split in several. */
export const SKETCH_OP_POINTS_MAX = 4_000;

/**
 * One action on the canvas. Coordinates are integers from 0 to DRAW_COORD_MAX, relative
 * to the canvas width and height, like Draw & Guess strokes. A clear is an action too,
 * so undo can bring the drawing back.
 */
export type SketchOp =
  | { kind: 'pen'; color: number; size: number; points: number[] }
  | { kind: 'erase'; size: number; points: number[] }
  /** Shapes are drawn from one corner (x, y) to the other. */
  | { kind: SketchShape; color: number; size: number; points: number[] }
  | { kind: 'fill'; color: number; points: number[] }
  | { kind: 'clear' };

/** What a drawing is made of, plus what undo took away (for redo). */
export interface Sketch {
  ops: SketchOp[];
  redo: SketchOp[];
}

export const EMPTY_SKETCH: Sketch = { ops: [], redo: [] };

export function addSketchOp(sketch: Sketch, op: SketchOp): Sketch {
  return { ops: [...sketch.ops, op], redo: [] };
}

export function undoSketch(sketch: Sketch): Sketch {
  const last = sketch.ops.at(-1);
  return last ? { ops: sketch.ops.slice(0, -1), redo: [...sketch.redo, last] } : sketch;
}

export function redoSketch(sketch: Sketch): Sketch {
  const next = sketch.redo.at(-1);
  return next ? { ops: [...sketch.ops, next], redo: sketch.redo.slice(0, -1) } : sketch;
}

/** How many numbers a drawing holds, to cap its size on the server. */
export function sketchSize(ops: readonly SketchOp[]): number {
  return ops.reduce((total, op) => total + ('points' in op ? op.points.length : 1), 0);
}

// ── Painting ─────────────────────────────────────────────────────────────────

interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** The parts of a browser canvas context that painting a sketch needs. */
export interface SketchCanvas {
  lineCap: string;
  lineJoin: string;
  lineWidth: number;
  strokeStyle: unknown;
  fillStyle: unknown;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    start: number,
    end: number,
  ): void;
  rect(x: number, y: number, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  stroke(): void;
  fill(): void;
  getImageData(x: number, y: number, width: number, height: number): Pixels;
  putImageData(pixels: Pixels, x: number, y: number): void;
}

const BACKGROUND = SKETCH_COLORS[2];

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * Paints the area around (x, y) that has about the same colour as that pixel, in place.
 * Pixels within `tolerance` count as the same, so the soft edges of lines don't leave gaps.
 */
export function floodFill(
  pixels: Pixels,
  x: number,
  y: number,
  color: readonly [number, number, number],
  tolerance = 96,
): void {
  const { data, width, height } = pixels;
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const start = (y * width + x) * 4;
  const target = [data[start]!, data[start + 1]!, data[start + 2]!];
  if (target.every((value, i) => Math.abs(value - color[i]!) <= 2)) return;

  const matches = (pixel: number) => {
    const i = pixel * 4;
    return (
      Math.abs(data[i]! - target[0]!) +
        Math.abs(data[i + 1]! - target[1]!) +
        Math.abs(data[i + 2]! - target[2]!) <=
      tolerance
    );
  };
  const seen = new Uint8Array(width * height);
  const stack = [y * width + x];
  while (stack.length > 0) {
    const pixel = stack.pop()!;
    if (seen[pixel] || !matches(pixel)) continue;
    // Walk left and right along the row, then queue the rows above and below
    const row = Math.floor(pixel / width) * width;
    let left = pixel;
    while (left > row && !seen[left - 1] && matches(left - 1)) left--;
    let right = pixel;
    while (right < row + width - 1 && !seen[right + 1] && matches(right + 1)) right++;
    for (let p = left; p <= right; p++) {
      seen[p] = 1;
      data[p * 4] = color[0];
      data[p * 4 + 1] = color[1];
      data[p * 4 + 2] = color[2];
      data[p * 4 + 3] = 255;
      if (p - width >= 0 && !seen[p - width]) stack.push(p - width);
      if (p + width < width * height && !seen[p + width]) stack.push(p + width);
    }
  }
}

/**
 * Paints a sketch onto a canvas that is `width` × `height` pixels, on a white background.
 * Used by the phones and the TV, so a drawing looks the same everywhere.
 */
export function paintSketch(
  ctx: SketchCanvas,
  ops: readonly SketchOp[],
  width: number,
  height: number,
): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  for (const op of ops) paintSketchOp(ctx, op, width, height);
}

/** Paints one action on top of what the canvas already shows. */
export function paintSketchOp(
  ctx: SketchCanvas,
  op: SketchOp,
  width: number,
  height: number,
): void {
  const x = (value: number) => (value / DRAW_COORD_MAX) * width;
  const y = (value: number) => (value / DRAW_COORD_MAX) * height;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (op.kind === 'clear') {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  if (op.kind === 'fill') {
    const [px = 0, py = 0] = op.points;
    const pixels = ctx.getImageData(0, 0, width, height);
    const color = hexToRgb(SKETCH_COLORS[op.color] ?? SKETCH_COLORS[0]);
    floodFill(pixels, Math.round(x(px)), Math.round(y(py)), color);
    ctx.putImageData(pixels, 0, 0);
    return;
  }

  const style = op.kind === 'erase' ? BACKGROUND : (SKETCH_COLORS[op.color] ?? SKETCH_COLORS[0]);
  const sizes = op.kind === 'erase' ? ERASER_SIZES : PEN_SIZES;
  const lineWidth = ((sizes[op.size] ?? sizes[0]) / DRAW_COORD_MAX) * width;
  const { points } = op;
  if (points.length < 2) return;

  if (op.kind === 'pen' || op.kind === 'erase') {
    if (points.length === 2) {
      ctx.fillStyle = style;
      ctx.beginPath();
      ctx.arc(x(points[0]!), y(points[1]!), lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x(points[0]!), y(points[1]!));
    for (let i = 2; i + 1 < points.length; i += 2) ctx.lineTo(x(points[i]!), y(points[i + 1]!));
    ctx.stroke();
    return;
  }

  const [x1, y1, x2, y2] = [x(points[0]!), y(points[1]!), x(points[2] ?? 0), y(points[3] ?? 0)];
  ctx.strokeStyle = style;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  if (op.kind === 'line') {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  } else if (op.kind === 'rect') {
    ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else {
    ctx.ellipse(
      (x1 + x2) / 2,
      (y1 + y2) / 2,
      Math.abs(x2 - x1) / 2,
      Math.abs(y2 - y1) / 2,
      0,
      0,
      Math.PI * 2,
    );
  }
  ctx.stroke();
}

// ── Game views ───────────────────────────────────────────────────────────────

/**
 * write: everyone writes a phrase · draw: draw the phrase you got · guess: write what the
 * drawing you got shows · reveal: the TV goes through every chain · finished: all done
 */
export type PhonePhase = 'write' | 'draw' | 'guess' | 'reveal' | 'finished';

/** One link of a chain: a phrase or a drawing, and who made it. */
export type PhoneEntry =
  | {
      kind: 'text';
      playerId: string;
      text: string;
      /** random: they asked for (or ran out of time and got) a random phrase. */
      source: 'typed' | 'random' | 'missed';
    }
  | { kind: 'sketch'; playerId: string; ops: SketchOp[] };

export interface PhoneSummary {
  ownerId: string;
  original: string;
  final: string;
}

export interface PhoneReveal {
  /** 0-based chain being shown, and how many there are. */
  chain: number;
  totalChains: number;
  ownerId: string;
  /** 0-based link being shown; equal to `entryCount` on the "original vs final" card. */
  entry: number;
  entryCount: number;
  /** The link on screen, null on the summary card. */
  current: PhoneEntry | null;
  /** The last phrase before the current link (what a drawer received). */
  previousText: string | null;
  summary: PhoneSummary;
}

export interface PhoneHostView {
  game: 'phone';
  phase: PhonePhase;
  /** 1-based step of the chain (write, draw, guess, draw…). */
  step: number;
  totalSteps: number;
  endsAt: number | null;
  playerIds: string[];
  /** Who has finished this step. */
  doneIds: string[];
  reveal: PhoneReveal | null;
  /** Every chain's first and last phrase, once finished. */
  summaries: PhoneSummary[];
}

export interface PhonePlayerView {
  game: 'phone';
  phase: PhonePhase;
  step: number;
  totalSteps: number;
  endsAt: number | null;
  /** You finished this step (you can still change your mind until it ends). */
  done: boolean;
  doneCount: number;
  playerCount: number;
  /** While drawing: the phrase to draw. */
  phrase: string | null;
  /** While guessing: the drawing to guess. */
  drawing: SketchOp[] | null;
  /** What you've written or drawn so far this step, to pick up after a reload. */
  draft: string;
  sketch: SketchOp[];
}
