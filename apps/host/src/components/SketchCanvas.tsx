import { paintSketch, type SketchOp } from '@couchwave/shared';
import { useEffect, useRef, useState } from 'react';

/** A Drawing Phone drawing, scaled to whatever size the canvas has on screen. */
export function SketchCanvas({ ops, label = 'Drawing' }: { ops: SketchOp[]; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Paint at the screen's real pixel density so lines stay sharp on a 4K TV
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const ratio = window.devicePixelRatio || 1;
      setSize({
        width: Math.round(entry.contentRect.width * ratio),
        height: Math.round(entry.contentRect.height * ratio),
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || size.width === 0) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    if (canvas.width !== size.width || canvas.height !== size.height) {
      canvas.width = size.width;
      canvas.height = size.height;
    }
    paintSketch(ctx, ops, size.width, size.height);
  }, [ops, size]);

  return (
    <canvas ref={ref} className="draw-canvas" role="img" aria-label={label} data-ops={ops.length} />
  );
}
