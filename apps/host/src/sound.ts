import { useEffect, useRef } from 'react';

let audio: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

/**
 * Browsers only play sound once the page has been clicked or tapped. The TV gets clicked
 * to create the room, but not after a refresh, so any later click or key press counts too.
 */
export function unlockSoundOnInteraction() {
  for (const type of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(type, () => context(), { once: true, passive: true });
  }
}

/** A clock's tick: a short, falling click. `last` (the final second) is a bit higher. */
export function playTick(last = false) {
  const ctx = context();
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(last ? 2400 : 1800, now);
  osc.frequency.exponentialRampToValueAtTime(last ? 1200 : 800, now + 0.05);
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

/** Ticks as a visible timer reaches 3, 2 and 1 seconds left. */
export function useCountdownTicks(msLeft: number, enabled: boolean) {
  const seconds = Math.ceil(msLeft / 1000);
  const last = useRef<number | null>(null);

  useEffect(() => {
    const previous = last.current;
    last.current = seconds;
    if (enabled && previous !== null && seconds < previous && seconds >= 1 && seconds <= 3) {
      playTick(seconds === 1);
    }
  }, [seconds, enabled]);
}
