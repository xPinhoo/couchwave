import { COLOR_CATEGORIES, COLOR_PUZZLES, COLOR_ROUNDS_OPTIONS } from '@couchwave/shared';
import { describe, expect, it } from 'vitest';
import { COLOR_ANSWERS } from './answers.js';
import {
  color,
  colorAccuracy,
  colorDifference,
  pickColorPuzzles,
  type ColorSettings,
  type ColorState,
} from './color.js';

const players = ['ana', 'rui'];
const settings = (change: Partial<ColorSettings> = {}): ColorSettings => ({
  category: 'flags',
  // Japan's flag is #bc002d, Italy's #008c45
  puzzleIds: ['japan', 'italy'],
  countdownMs: 0,
  pickMs: 20_000,
  revealMs: 8_000,
  ...change,
});

const start = (change: Partial<ColorSettings> = {}) => color.init(players, settings(change), 0);
const pick = (state: ColorState, id: string, hex: string) =>
  color.onInput(state, id, { type: 'pick', color: hex }, 0);
const lock = (state: ColorState, id: string) => color.onInput(state, id, { type: 'lock' }, 0);
const timeUp = (state: ColorState) => color.onTick(state, state.endsAt!);

describe('the pictures', () => {
  it('all have an answer, a real colour, and no answers are left over', () => {
    expect(Object.keys(COLOR_ANSWERS).sort()).toEqual(COLOR_PUZZLES.map((p) => p.id).sort());
    for (const hex of Object.values(COLOR_ANSWERS)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('are enough for the longest game of any category', () => {
    const longest = Math.max(...COLOR_ROUNDS_OPTIONS);
    for (const { id } of COLOR_CATEGORIES) {
      expect(pickColorPuzzles(id, longest, Math.random)).toHaveLength(longest);
    }
  });

  it('only come from the chosen category', () => {
    const flags = COLOR_PUZZLES.filter((p) => p.category === 'flags').map((p) => p.id);
    for (const id of pickColorPuzzles('flags', 10, Math.random)) expect(flags).toContain(id);
  });
});

describe('colorAccuracy', () => {
  it('gives full marks for the exact colour and none for the opposite', () => {
    expect(colorDifference('#ff0000', '#ff0000')).toBe(0);
    expect(colorAccuracy('#bc002d', '#bc002d')).toBe(100);
    expect(colorAccuracy('#ffffff', '#000000')).toBe(0);
  });

  it('rewards getting close, and more so the closer it is', () => {
    const close = colorAccuracy('#c00830', '#bc002d');
    const nearby = colorAccuracy('#e02040', '#bc002d');
    const wrong = colorAccuracy('#2040e0', '#bc002d');
    expect(close).toBeGreaterThan(90);
    expect(nearby).toBeLessThan(close);
    expect(nearby).toBeGreaterThan(50);
    expect(wrong).toBe(0);
  });

  it('is kind to the right kind of colour, but not to a different one', () => {
    expect(colorAccuracy('#0043ed', '#0f52ba')).toBeGreaterThan(60);
    expect(colorAccuracy('#fe1200', '#d6212f')).toBeGreaterThan(70);
    expect(colorAccuracy('#ff8000', '#bc002d')).toBeLessThan(50);
    expect(colorAccuracy('#ffd800', '#bc002d')).toBe(0);
  });
});

describe('Guess the Color', () => {
  it('starts with a countdown that hides the picture', () => {
    const state = start({ countdownMs: 5_000 });
    expect(color.hostView(state)).toMatchObject({ phase: 'countdown', puzzleId: '', name: '' });
    expect(color.playerView(state, 'ana').name).toBe('');
    expect(timeUp(state).phase).toBe('pick');
  });

  it('never shows the answer before the reveal', () => {
    const state = start();
    expect(color.hostView(state)).toMatchObject({
      puzzleId: 'japan',
      name: "Japan's flag",
      answer: null,
      results: [],
    });
    expect(color.playerView(state, 'ana').answer).toBeNull();
  });

  it('keeps picks private, and doesn’t let you lock in nothing', () => {
    const state = pick(start(), 'ana', '#ff0000');
    expect(color.playerView(state, 'ana').myColor).toBe('#ff0000');
    expect(JSON.stringify(color.hostView(state))).not.toContain('#ff0000');
    expect(lock(state, 'rui')).toBe(state);
    expect(pick(state, 'ana', 'red')).toBe(state);
    expect(pick(state, 'nobody', '#ff0000')).toBe(state);
  });

  it('freezes a locked colour, and reveals once everyone has locked in', () => {
    let state = lock(pick(start(), 'ana', '#bc002d'), 'ana');
    expect(color.hostView(state).lockedIds).toEqual(['ana']);
    expect(pick(state, 'ana', '#000000')).toBe(state);

    state = lock(pick(state, 'rui', '#ffffff'), 'rui');
    expect(state.phase).toBe('reveal');
    expect(color.hostView(state).answer).toBe('#bc002d');
    expect(color.hostView(state).results[0]).toEqual({
      playerId: 'ana',
      color: '#bc002d',
      accuracy: 100,
      points: 1_000,
    });
    expect(color.playerView(state, 'ana').result?.points).toBe(1_000);
    expect(color.playerView(state, 'ana').rank).toBe(1);
  });

  it('counts an unlocked colour when time runs out, and nothing for no colour', () => {
    const state = timeUp(pick(start(), 'ana', '#bc002d'));
    expect(color.hostView(state).results).toEqual([
      { playerId: 'ana', color: '#bc002d', accuracy: 100, points: 1_000 },
      { playerId: 'rui', color: null, accuracy: 0, points: 0 },
    ]);
  });

  it('adds up the rounds, then finishes with a leaderboard', () => {
    let state = timeUp(pick(start(), 'ana', '#bc002d'));
    state = timeUp(state);
    expect(state.phase).toBe('pick');
    expect(color.playerView(state, 'ana').myColor).toBeNull();
    expect(color.hostView(state).name).toBe("Italy's flag");

    state = timeUp(pick(pick(state, 'ana', '#008c45'), 'rui', '#008c45'));
    expect(color.hostView(state).leaderboard).toEqual([
      { playerId: 'ana', score: 2_000, gained: 1_000 },
      { playerId: 'rui', score: 1_000, gained: 1_000 },
    ]);

    state = timeUp(state);
    expect(state.phase).toBe('finished');
    expect(color.isOver(state)).toBe(true);
    expect(color.playerView(state, 'rui').rank).toBe(2);
    expect(color.hostView(state).answer).toBeNull();
  });
});
