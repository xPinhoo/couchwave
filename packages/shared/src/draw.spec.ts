import { describe, expect, it } from 'vitest';
import { addStrokeChunk, normalizeGuess, paintStrokes, type StrokeCanvas } from './draw.js';
import { strokeSchema } from './schemas.js';

describe('normalizeGuess', () => {
  it('ignores case, accents, punctuation and extra spaces', () => {
    expect(normalizeGuess('  Ice   CRÉAM!! ')).toBe('ice cream');
  });
});

describe('addStrokeChunk', () => {
  it('appends points to the stroke in progress, or starts a new one', () => {
    const first = { id: 1, color: 0, size: 1, points: [0, 0] };
    let strokes = addStrokeChunk([], first);
    strokes = addStrokeChunk(strokes, { ...first, points: [10, 10] });
    expect(strokes).toEqual([{ ...first, points: [0, 0, 10, 10] }]);

    strokes = addStrokeChunk(strokes, { id: 2, color: 3, size: 0, points: [5, 5] });
    expect(strokes).toHaveLength(2);
  });
});

describe('paintStrokes', () => {
  function recorder() {
    const calls: string[] = [];
    const ctx: StrokeCanvas = {
      lineCap: '',
      lineJoin: '',
      lineWidth: 0,
      strokeStyle: '',
      fillStyle: '',
      beginPath: () => calls.push('begin'),
      moveTo: (x, y) => calls.push(`move ${x},${y}`),
      lineTo: (x, y) => calls.push(`line ${x},${y}`),
      arc: (x, y, r) => calls.push(`dot ${x},${y} r${r}`),
      stroke: () => calls.push('stroke'),
      fill: () => calls.push('fill'),
    };
    return { ctx, calls };
  }

  it('scales coordinates and pen sizes to the canvas', () => {
    const { ctx, calls } = recorder();
    paintStrokes(ctx, [{ id: 1, color: 1, size: 1, points: [0, 0, 500, 1000] }], 400, 300);
    expect(calls).toEqual(['begin', 'move 0,0', 'line 200,300', 'stroke']);
    expect(ctx.lineWidth).toBeCloseTo(5.6);
    expect(ctx.strokeStyle).toBe('#e5484d');
  });

  it('paints a single point as a dot', () => {
    const { ctx, calls } = recorder();
    paintStrokes(ctx, [{ id: 1, color: 0, size: 2, points: [500, 500] }], 1000, 750);
    expect(calls).toEqual(['begin', 'dot 500,375 r16', 'fill']);
  });
});

describe('strokeSchema', () => {
  const stroke = { id: 1, color: 0, size: 0, points: [1, 2] };

  it('accepts a valid chunk and rejects odd, out-of-range or unknown values', () => {
    expect(strokeSchema.safeParse(stroke).success).toBe(true);
    expect(strokeSchema.safeParse({ ...stroke, points: [1, 2, 3] }).success).toBe(false);
    expect(strokeSchema.safeParse({ ...stroke, points: [1001, 2] }).success).toBe(false);
    expect(strokeSchema.safeParse({ ...stroke, size: 3 }).success).toBe(false);
    expect(strokeSchema.safeParse({ ...stroke, points: [] }).success).toBe(false);
  });
});
