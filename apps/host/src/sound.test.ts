import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Records each tick's starting pitch. */
const pitches: number[] = [];

class FakeAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  resume = () => Promise.resolve();
  createOscillator() {
    return {
      type: '',
      frequency: {
        setValueAtTime: (value: number) => pitches.push(value),
        exponentialRampToValueAtTime: () => {},
      },
      connect: (node: unknown) => node,
      start: () => {},
      stop: () => {},
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: (node: unknown) => node,
    };
  }
}

vi.stubGlobal('AudioContext', FakeAudioContext);
const { useCountdownTicks } = await import('./sound');

afterEach(() => {
  pitches.length = 0;
});

describe('useCountdownTicks', () => {
  it('ticks at 3, 2 and 1 seconds left, the last one higher', () => {
    const { rerender } = renderHook(({ ms }) => useCountdownTicks(ms, true), {
      initialProps: { ms: 5_000 },
    });
    for (const ms of [4_500, 3_900, 3_000, 2_400, 1_900, 1_000, 500, 0]) rerender({ ms });
    expect(pitches).toEqual([1800, 1800, 2400]);
  });

  it('stays quiet when the timer isn’t shown, or when it starts below 3', () => {
    const quiet = renderHook(({ ms }) => useCountdownTicks(ms, false), {
      initialProps: { ms: 4_000 },
    });
    for (const ms of [3_000, 2_000, 1_000]) quiet.rerender({ ms });

    // A phase that opens with under 3 seconds left doesn't tick for its first value
    const late = renderHook(({ ms }) => useCountdownTicks(ms, true), {
      initialProps: { ms: 2_500 },
    });
    late.rerender({ ms: 2_400 });
    expect(pitches).toEqual([]);
  });
});
