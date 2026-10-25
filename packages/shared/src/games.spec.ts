import { describe, expect, it } from 'vitest';
import { remainingMs } from './games.js';

describe('remainingMs', () => {
  it('counts down on a device whose clock matches the server', () => {
    expect(remainingMs(10_000, 4_000, 4_000, 7_000)).toBe(3_000);
  });

  it('corrects for a device clock that runs ahead of the server', () => {
    // The device clock is 2s ahead: it received serverTime 4000 at its 6000
    expect(remainingMs(10_000, 4_000, 6_000, 9_000)).toBe(3_000);
  });

  it('never goes below zero', () => {
    expect(remainingMs(10_000, 4_000, 4_000, 20_000)).toBe(0);
  });
});
