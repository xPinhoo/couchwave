import type { SketchOp } from '@couchwave/shared';

export interface SketchPadProps {
  /** The drawing so far, e.g. after a reload. Only read when the pad mounts. */
  initial: readonly SketchOp[];
  /** Locked (e.g. after pressing Done): shows the drawing, but no tools. */
  disabled: boolean;
  /** Called once per finished action: a line, a shape, a fill or a clear. */
  onOp: (op: SketchOp) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export interface SketchViewProps {
  ops: readonly SketchOp[];
}
