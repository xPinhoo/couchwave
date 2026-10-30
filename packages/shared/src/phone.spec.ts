import { describe, expect, it } from 'vitest';
import {
  EMPTY_SKETCH,
  addSketchOp,
  floodFill,
  paintSketch,
  redoSketch,
  sketchSize,
  undoSketch,
  type SketchCanvas,
  type SketchOp,
} from './phone.js';
import { sketchOpSchema } from './schemas.js';

const pen: SketchOp = { kind: 'pen', color: 0, size: 1, points: [10, 10, 20, 20] };
const clear: SketchOp = { kind: 'clear' };

describe('sketch history', () => {
  it('undoes and redoes, including a clear', () => {
    let sketch = addSketchOp(addSketchOp(EMPTY_SKETCH, pen), clear);
    sketch = undoSketch(sketch);
    expect(sketch.ops).toEqual([pen]);
    sketch = redoSketch(sketch);
    expect(sketch.ops).toEqual([pen, clear]);
  });

  it('forgets what was undone once something new is drawn', () => {
    const sketch = addSketchOp(undoSketch(addSketchOp(EMPTY_SKETCH, pen)), clear);
    expect(sketch).toEqual({ ops: [clear], redo: [] });
    expect(redoSketch(sketch)).toBe(sketch);
  });

  it('does nothing when there is nothing to undo or redo', () => {
    expect(undoSketch(EMPTY_SKETCH)).toBe(EMPTY_SKETCH);
    expect(redoSketch(EMPTY_SKETCH)).toBe(EMPTY_SKETCH);
  });

  it('counts the numbers a drawing holds', () => {
    expect(sketchSize([pen, clear])).toBe(5);
  });
});

/** A width × height image, white, with the pixels in `black` painted black. */
function image(width: number, height: number, black: [number, number][] = []) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const [x, y] of black) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
  return { data, width, height };
}

const red = (pixels: ReturnType<typeof image>, x: number, y: number) =>
  pixels.data[(y * pixels.width + x) * 4] === 229 &&
  pixels.data[(y * pixels.width + x) * 4 + 1] === 72;

describe('floodFill', () => {
  it('fills the area inside a wall and stops there', () => {
    // A vertical black wall at x = 2 splits a 5×3 image in two
    const pixels = image(5, 3, [
      [2, 0],
      [2, 1],
      [2, 2],
    ]);
    floodFill(pixels, 0, 1, [229, 72, 77]);
    expect(red(pixels, 0, 0)).toBe(true);
    expect(red(pixels, 1, 2)).toBe(true);
    expect(red(pixels, 2, 1)).toBe(false);
    expect(red(pixels, 4, 1)).toBe(false);
  });

  it('ignores points outside the image', () => {
    const pixels = image(2, 2);
    floodFill(pixels, 5, 5, [229, 72, 77]);
    expect(red(pixels, 0, 0)).toBe(false);
  });
});

describe('paintSketch', () => {
  it('starts from white and paints every kind of action', () => {
    const calls: string[] = [];
    const pixels = image(10, 10);
    const ctx: SketchCanvas = {
      lineCap: '',
      lineJoin: '',
      lineWidth: 0,
      strokeStyle: '',
      fillStyle: '',
      beginPath: () => calls.push('beginPath'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      arc: () => calls.push('arc'),
      ellipse: () => calls.push('ellipse'),
      rect: () => calls.push('rect'),
      fillRect: () => calls.push('fillRect'),
      stroke: () => calls.push('stroke'),
      fill: () => calls.push('fill'),
      getImageData: () => pixels,
      putImageData: () => calls.push('putImageData'),
    };
    paintSketch(
      ctx,
      [
        pen,
        { kind: 'erase', size: 0, points: [5, 5] },
        { kind: 'rect', color: 1, size: 0, points: [0, 0, 500, 500] },
        { kind: 'ellipse', color: 1, size: 0, points: [0, 0, 500, 500] },
        { kind: 'fill', color: 3, points: [900, 900] },
        clear,
      ],
      10,
      10,
    );
    expect(calls[0]).toBe('fillRect');
    expect(calls).toContain('arc');
    expect(calls).toContain('rect');
    expect(calls).toContain('ellipse');
    expect(calls).toContain('putImageData');
    expect(calls.at(-1)).toBe('fillRect');
    expect(red(pixels, 9, 9)).toBe(true);
  });
});

describe('sketchOpSchema', () => {
  it('accepts each kind of action', () => {
    for (const op of [
      pen,
      clear,
      { kind: 'erase', size: 2, points: [1, 2] },
      { kind: 'line', color: 11, size: 3, points: [0, 0, 1000, 1000] },
      { kind: 'fill', color: 0, points: [3, 4] },
    ]) {
      expect(sketchOpSchema.safeParse(op).success).toBe(true);
    }
  });

  it('rejects bad colours, sizes and shapes', () => {
    for (const op of [
      { ...pen, color: 12 },
      { kind: 'erase', size: 3, points: [1, 2] },
      { kind: 'rect', color: 0, size: 0, points: [0, 0, 10] },
      { kind: 'fill', color: 0, points: [3, 4, 5, 6] },
      { kind: 'text', text: 'hi' },
    ]) {
      expect(sketchOpSchema.safeParse(op).success).toBe(false);
    }
  });
});
