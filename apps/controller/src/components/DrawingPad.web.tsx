import { DRAW_COORD_MAX, STROKE_CHUNK_MAX, paintStrokes, type Stroke } from '@couchwave/shared';
import { useCallback, useEffect, useImperativeHandle, useRef, type PointerEvent } from 'react';
import type { DrawingPadProps } from './DrawingPad.types';

/** New points are sent to the TV in batches this often, instead of one message per point. */
const FLUSH_MS = 50;
/** Points closer than this to the last one (in thousandths) are skipped. */
const MIN_STEP = 3;

interface InProgress {
  stroke: Stroke;
  /** Points not sent to the TV yet. */
  pending: number[];
}

/**
 * The artist's canvas, in the browser. It paints locally straight away and streams the
 * points to the server in small batches; the TV paints the same strokes with `paintStrokes`.
 */
export function DrawingPad({ color, size, onStroke, ref }: DrawingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<InProgress | null>(null);
  const nextId = useRef(1);
  const send = useRef(onStroke);

  useEffect(() => {
    send.current = onStroke;
  }, [onStroke]);

  const paint = useCallback((items: readonly Stroke[], fresh: boolean) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (fresh) ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintStrokes(ctx, items, canvas.width, canvas.height);
  }, []);

  const flush = useCallback(() => {
    const inProgress = current.current;
    if (!inProgress || inProgress.pending.length === 0) return;
    const { stroke, pending } = inProgress;
    for (let i = 0; i < pending.length; i += STROKE_CHUNK_MAX) {
      const points = pending.slice(i, i + STROKE_CHUNK_MAX);
      send.current({ id: stroke.id, color: stroke.color, size: stroke.size, points });
    }
    inProgress.pending = [];
  }, []);

  // Match the canvas's pixels to its size on screen (sharp lines on high-DPI phones)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(entry.contentRect.width * ratio);
      canvas.height = Math.round(entry.contentRect.height * ratio);
      paint(strokes.current, true);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paint]);

  useEffect(() => {
    const interval = setInterval(flush, FLUSH_MS);
    return () => clearInterval(interval);
  }, [flush]);

  useImperativeHandle(
    ref,
    () => ({
      undo() {
        flush();
        current.current = null;
        strokes.current = strokes.current.slice(0, -1);
        paint(strokes.current, true);
      },
      clear() {
        current.current = null;
        strokes.current = [];
        paint([], true);
      },
    }),
    [flush, paint],
  );

  const toPoint = (event: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = (value: number, length: number) =>
      Math.min(DRAW_COORD_MAX, Math.max(0, Math.round((value / length) * DRAW_COORD_MAX)));
    return [
      scale(event.clientX - rect.left, rect.width),
      scale(event.clientY - rect.top, rect.height),
    ];
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPoint(event);
    const stroke: Stroke = { id: nextId.current++, color, size, points: [...point] };
    strokes.current = [...strokes.current, stroke];
    current.current = { stroke, pending: [...point] };
    paint([stroke], false);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const inProgress = current.current;
    if (!inProgress) return;
    const { points } = inProgress.stroke;
    const [x, y] = toPoint(event);
    const lastX = points.at(-2)!;
    const lastY = points.at(-1)!;
    if (Math.hypot(x - lastX, y - lastY) < MIN_STEP) return;

    points.push(x, y);
    inProgress.pending.push(x, y);
    // Paint just the new segment; repainting everything on every move would lag
    paint([{ ...inProgress.stroke, points: [lastX, lastY, x, y] }], false);
  };

  const end = () => {
    flush();
    current.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label="Drawing pad"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        display: 'block',
        width: '100%',
        aspectRatio: '4 / 3',
        borderRadius: 12,
        background: '#fff',
        // Drawing must not scroll or zoom the page
        touchAction: 'none',
        cursor: 'crosshair',
      }}
    />
  );
}
