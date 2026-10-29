import type { Stroke } from '@couchwave/shared';
import type { Ref } from 'react';

export interface DrawingPadHandle {
  /** Removes the last stroke. */
  undo(): void;
  /** Wipes the whole drawing. */
  clear(): void;
}

export interface DrawingPadProps {
  /** Index into DRAW_COLORS. */
  color: number;
  /** Index into DRAW_SIZES. */
  size: number;
  /** Called many times a second while drawing, with new points for the TV. */
  onStroke: (stroke: Stroke) => void;
  ref?: Ref<DrawingPadHandle>;
}
