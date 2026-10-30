import {
  DRAW_COORD_MAX,
  ERASER_SIZES,
  PEN_SIZES,
  SKETCH_COLORS,
  SKETCH_OP_POINTS_MAX,
  addSketchOp,
  paintSketch,
  paintSketchOp,
  redoSketch,
  undoSketch,
  type Sketch,
  type SketchOp,
  type SketchShape,
} from '@couchwave/shared';
import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { DrawBoard } from './DrawBoard';
import type { SketchPadProps, SketchViewProps } from './Sketch.types';

type Tool = 'pen' | 'erase' | 'fill' | SketchShape;

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'pen', label: 'Pen', icon: '✏️' },
  { id: 'erase', label: 'Eraser', icon: '🧽' },
  { id: 'fill', label: 'Fill', icon: '🪣' },
  { id: 'line', label: 'Line', icon: '╱' },
  { id: 'rect', label: 'Rectangle', icon: '▭' },
  { id: 'ellipse', label: 'Circle', icon: '◯' },
];

/** Points closer than this to the last one (in thousandths) are skipped. */
const MIN_STEP = 3;

/** A line or shape being drawn, and for shapes, the canvas before it (to redraw over). */
interface InProgress {
  op: Extract<SketchOp, { points: number[] }>;
  base: ImageData | null;
}

const canvasStyle = {
  display: 'block',
  borderRadius: 12,
  background: '#fff',
} as const;

/** Keeps the canvas's pixels matched to its size on screen, repainting on every resize. */
function useSharpCanvas(canvasRef: RefObject<HTMLCanvasElement | null>, repaint: () => void) {
  const latest = useRef(repaint);
  useEffect(() => {
    latest.current = repaint;
  }, [repaint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(entry.contentRect.width * ratio);
      canvas.height = Math.round(entry.contentRect.height * ratio);
      latest.current();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef]);
}

const context = (canvas: HTMLCanvasElement | null) =>
  canvas?.getContext('2d', { willReadFrequently: true }) ?? null;

/**
 * The Drawing Phone canvas: pen, eraser, fill, shapes, undo/redo and clear, a bit like
 * Paint. Each finished action is sent to the server, which keeps the drawing.
 */
export function SketchPad({
  initial,
  disabled,
  onOp,
  onUndo,
  onRedo,
  info,
  footer,
}: SketchPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const history = useRef<Sketch>({ ops: [...initial], redo: [] });
  const active = useRef<InProgress | null>(null);
  const [counts, setCounts] = useState({ undo: initial.length, redo: 0 });
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(0);
  const [penSize, setPenSize] = useState(1);
  const [eraserSize, setEraserSize] = useState(1);

  const paintAll = () => {
    const canvas = canvasRef.current;
    const ctx = context(canvas);
    if (canvas && ctx) paintSketch(ctx, history.current.ops, canvas.width, canvas.height);
  };
  const paintOne = (op: SketchOp) => {
    const canvas = canvasRef.current;
    const ctx = context(canvas);
    if (canvas && ctx) paintSketchOp(ctx, op, canvas.width, canvas.height);
  };
  useSharpCanvas(canvasRef, paintAll);

  const setHistory = (sketch: Sketch) => {
    history.current = sketch;
    setCounts({ undo: sketch.ops.length, redo: sketch.redo.length });
  };
  const commit = (op: SketchOp) => {
    setHistory(addSketchOp(history.current, op));
    onOp(op);
  };

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
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toPoint(event);

    if (tool === 'fill') {
      const op: SketchOp = { kind: 'fill', color, points: point };
      paintOne(op);
      commit(op);
      return;
    }
    if (tool === 'pen' || tool === 'erase') {
      const op: InProgress['op'] =
        tool === 'pen'
          ? { kind: 'pen', color, size: penSize, points: [...point] }
          : { kind: 'erase', size: eraserSize, points: [...point] };
      active.current = { op, base: null };
      paintOne(op);
      return;
    }
    const canvas = canvasRef.current;
    const base = canvas && context(canvas)?.getImageData(0, 0, canvas.width, canvas.height);
    active.current = {
      op: { kind: tool, color, size: penSize, points: [...point, ...point] },
      base: base ?? null,
    };
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const inProgress = active.current;
    if (!inProgress) return;
    const [x, y] = toPoint(event);
    const { op, base } = inProgress;

    if (op.kind === 'pen' || op.kind === 'erase') {
      const lastX = op.points.at(-2)!;
      const lastY = op.points.at(-1)!;
      if (Math.hypot(x - lastX, y - lastY) < MIN_STEP) return;
      op.points.push(x, y);
      // Paint just the new segment; repainting everything on every move would lag
      paintOne({ ...op, points: [lastX, lastY, x, y] });
      if (op.points.length >= SKETCH_OP_POINTS_MAX) {
        // A very long line: send what's there and carry on from the same point
        commit(op);
        active.current = { op: { ...op, points: [x, y] }, base: null };
      }
      return;
    }

    op.points = [op.points[0]!, op.points[1]!, x, y];
    if (base) context(canvasRef.current)?.putImageData(base, 0, 0);
    paintOne(op);
  };

  const end = () => {
    const inProgress = active.current;
    active.current = null;
    if (!inProgress) return;
    const [x1, y1, x2, y2] = inProgress.op.points;
    const isShape = inProgress.op.kind !== 'pen' && inProgress.op.kind !== 'erase';
    // A tap with a shape tool draws nothing
    if (isShape && x1 === x2 && y1 === y2) return;
    commit(inProgress.op);
  };

  const undo = () => {
    if (history.current.ops.length === 0) return;
    setHistory(undoSketch(history.current));
    paintAll();
    onUndo();
  };
  const redo = () => {
    if (history.current.redo.length === 0) return;
    setHistory(redoSketch(history.current));
    paintAll();
    onRedo();
  };
  const clear = () => {
    const op: SketchOp = { kind: 'clear' };
    paintOne(op);
    commit(op);
  };

  const sizes = tool === 'erase' ? ERASER_SIZES : PEN_SIZES;
  const size = tool === 'erase' ? eraserSize : penSize;
  const setSize = tool === 'erase' ? setEraserSize : setPenSize;

  return (
    <DrawBoard
      canvas={
        <canvas
          ref={canvasRef}
          aria-label="Drawing pad"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          style={{
            ...canvasStyle,
            width: '100%',
            height: '100%',
            // Drawing must not scroll or zoom the page
            touchAction: 'none',
            cursor: disabled ? 'default' : 'crosshair',
            opacity: disabled ? 0.7 : 1,
          }}
        />
      }
    >
      {info}

      {!disabled && (
        <>
          <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Tools">
            {TOOLS.map(({ id, label, icon }) => (
              <Pressable
                key={id}
                accessibilityRole="radio"
                accessibilityLabel={label}
                aria-checked={tool === id}
                onPress={() => setTool(id)}
                style={[styles.tool, tool === id && styles.selected]}
              >
                <Text style={styles.icon}>{icon}</Text>
              </Pressable>
            ))}
          </View>

          {tool !== 'erase' && (
            <View
              style={[styles.row, styles.colors]}
              accessibilityRole="radiogroup"
              accessibilityLabel="Colours"
            >
              {SKETCH_COLORS.map((value, index) => (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={`Colour ${index + 1}`}
                  aria-checked={color === index}
                  onPress={() => setColor(index)}
                  style={[
                    styles.swatch,
                    { backgroundColor: value },
                    color === index && styles.selected,
                  ]}
                />
              ))}
            </View>
          )}

          <View style={styles.row}>
            {tool !== 'fill' && (
              <View
                style={styles.row}
                accessibilityRole="radiogroup"
                accessibilityLabel={tool === 'erase' ? 'Eraser size' : 'Pen size'}
              >
                {sizes.map((value, index) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityLabel={`Size ${index + 1}`}
                    aria-checked={size === index}
                    onPress={() => setSize(index)}
                    style={[styles.tool, size === index && styles.selected]}
                  >
                    <View
                      style={[
                        styles.dot,
                        {
                          width: 4 + index * (tool === 'erase' ? 8 : 6),
                          height: 4 + index * (tool === 'erase' ? 8 : 6),
                        },
                        tool !== 'erase' && { backgroundColor: SKETCH_COLORS[color] },
                      ]}
                    />
                  </Pressable>
                ))}
              </View>
            )}
            <ToolButton label="Undo" icon="↶" disabled={counts.undo === 0} onPress={undo} />
            <ToolButton label="Redo" icon="↷" disabled={counts.redo === 0} onPress={redo} />
            <ToolButton label="Clear" icon="🗑" disabled={counts.undo === 0} onPress={clear} />
          </View>
        </>
      )}
      {footer}
    </DrawBoard>
  );
}

function ToolButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.tool, disabled && styles.disabled]}
    >
      <Text style={styles.icon}>{icon}</Text>
    </Pressable>
  );
}

/** Someone else's drawing, to guess. */
export function SketchView({ ops }: SketchViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = context(canvas);
    if (canvas && ctx) paintSketch(ctx, ops, canvas.width, canvas.height);
  }, [ops]);
  useSharpCanvas(canvasRef, paint);
  useEffect(paint, [paint]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Drawing to guess"
      style={{ ...canvasStyle, width: '100%', aspectRatio: '16 / 9' }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  tool: {
    minWidth: 42,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  icon: {
    color: colors.text,
    fontSize: 18,
  },
  /** Two even rows of 6 swatches. */
  colors: {
    alignSelf: 'center',
    maxWidth: 6 * 30 + 5 * 6 + 4,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
  },
  selected: {
    borderColor: colors.accent,
    borderWidth: 3,
    transform: [{ scale: 1.08 }],
  },
  dot: {
    borderRadius: 999,
    backgroundColor: colors.text,
  },
  disabled: {
    opacity: 0.35,
  },
});
