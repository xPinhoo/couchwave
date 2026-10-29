import { describe, expect, it } from 'vitest';
import {
  ARTIST_POINTS_PER_GUESS,
  FEED_LENGTH,
  GUESS_COOLDOWN_MS,
  draw,
  maskWord,
  planTurns,
  scoreGuess,
  type DrawSettings,
  type DrawState,
} from './draw.js';
import { DRAW_WORDS } from './words.js';

const settings: DrawSettings = {
  turns: [
    { artistId: 'ana', choices: ['cat', 'ice cream', 'rocket'] },
    { artistId: 'rui', choices: ['dog', 'sun', 'tree'] },
  ],
  chooseMs: 5_000,
  drawMs: 10_000,
  revealMs: 3_000,
};

const start = (players = ['ana', 'rui', 'eva']) => draw.init(players, settings, 0);
const choose = (state: DrawState, playerId: string, index: number, now = 1_000) =>
  draw.onInput(state, playerId, { type: 'choose', index }, now);
const guess = (state: DrawState, playerId: string, text: string, now: number) =>
  draw.onInput(state, playerId, { type: 'guess', text }, now);
/** Ana chose "ice cream" at t=1000, so drawing ends at t=11000. */
const drawing = () => choose(start(), 'ana', 1);

describe('scoreGuess', () => {
  it('gives 800 for an instant guess and 200 at the buzzer', () => {
    expect(scoreGuess(0, 10_000)).toBe(800);
    expect(scoreGuess(10_000, 10_000)).toBe(200);
    expect(scoreGuess(5_000, 10_000)).toBe(500);
  });
});

describe('planTurns', () => {
  it('lets everyone draw once per round, in join order, with no repeated words', () => {
    const turns = planTurns(['ana', 'rui'], 3, DRAW_WORDS);
    expect(turns.map((t) => t.artistId)).toEqual(['ana', 'rui', 'ana', 'rui', 'ana', 'rui']);
    const words = turns.flatMap((t) => t.choices);
    expect(words).toHaveLength(18);
    expect(new Set(words).size).toBe(18);
  });

  it('reshuffles when a small list runs out', () => {
    const turns = planTurns(['ana', 'rui', 'eva'], 1, ['a', 'b', 'c', 'd']);
    expect(turns.every((t) => t.choices.length === 3)).toBe(true);
  });
});

describe('maskWord', () => {
  it('hides letters but keeps spaces, then reveals the first and a middle letter', () => {
    expect(maskWord('ice cream', 0)).toBe('___ _____');
    expect(maskWord('ice cream', 1)).toBe('i__ _____');
    expect(maskWord('ice cream', 2)).toBe('i__ c____');
    expect(maskWord('cat', 2)).toBe('ca_');
  });
});

describe('draw', () => {
  it('starts with the first artist choosing a word; only they see the choices', () => {
    const state = start();
    expect(state).toMatchObject({ phase: 'choosing', turn: 0, endsAt: 5_000, word: null });
    expect(draw.playerView(state, 'ana').wordChoices).toEqual(['cat', 'ice cream', 'rocket']);
    expect(draw.playerView(state, 'rui').wordChoices).toEqual([]);
    expect(draw.hostView(state).hint).toBe('');
  });

  it('only lets the artist choose, and only from their choices', () => {
    const state = start();
    expect(choose(state, 'rui', 0)).toBe(state);
    expect(choose(state, 'ana', 3)).toBe(state);
    expect(choose(state, 'ana', 1)).toMatchObject({
      phase: 'drawing',
      word: 'ice cream',
      endsAt: 11_000,
    });
  });

  it('picks the first word for an artist who takes too long', () => {
    expect(draw.onTick(start(), 5_000)).toMatchObject({ phase: 'drawing', word: 'cat' });
  });

  it('shows the word to the artist only; the others and the TV get a masked hint', () => {
    const state = drawing();
    expect(draw.playerView(state, 'ana').word).toBe('ice cream');
    expect(draw.playerView(state, 'rui')).toMatchObject({ word: null, hint: '___ _____' });
    expect(draw.hostView(state).hint).toBe('___ _____');
  });

  it('reveals hint letters as time runs out', () => {
    let state = drawing();
    expect(draw.onTick(state, 5_999)).toBe(state);
    state = draw.onTick(state, 6_000);
    expect(state.hintsRevealed).toBe(1);
    state = draw.onTick(state, 8_500);
    expect(draw.hostView(state).hint).toBe('i__ c____');
  });

  it('accepts a correct guess whatever the case, accents or spacing', () => {
    const state = guess(drawing(), 'rui', '  ICE   Créam ', 2_000);
    expect(draw.playerView(state, 'rui')).toMatchObject({ guessed: true, lastGuess: 'correct' });
    expect(draw.hostView(state).guessedIds).toEqual(['rui']);
    expect(state.feed).toEqual([]);
  });

  it('puts wrong guesses on the TV but keeps near misses private', () => {
    let state = guess(drawing(), 'rui', 'banana', 2_000);
    state = guess(state, 'eva', 'ice crem', 2_000);
    expect(draw.hostView(state).feed).toEqual([{ playerId: 'rui', text: 'banana' }]);
    expect(draw.playerView(state, 'rui').lastGuess).toBe('wrong');
    expect(draw.playerView(state, 'eva').lastGuess).toBe('close');
  });

  it('ignores the artist, repeat guesses after getting it, spam and late guesses', () => {
    const state = drawing();
    expect(guess(state, 'ana', 'ice cream', 2_000)).toBe(state);

    const wrong = guess(state, 'rui', 'banana', 2_000);
    expect(guess(wrong, 'rui', 'apple', 2_000 + GUESS_COOLDOWN_MS - 1)).toBe(wrong);
    expect(guess(wrong, 'rui', 'apple', 2_000 + GUESS_COOLDOWN_MS).feed).toHaveLength(2);

    const right = guess(state, 'rui', 'ice cream', 2_000);
    expect(guess(right, 'rui', 'banana', 3_000)).toBe(right);
    expect(guess(state, 'rui', 'ice cream', 11_000)).toBe(state);
  });

  it('keeps only the latest wrong guesses', () => {
    let state = drawing();
    for (let i = 0; i < FEED_LENGTH + 2; i++) {
      state = guess(state, 'rui', `guess ${i}`, 2_000 + i * GUESS_COOLDOWN_MS);
    }
    expect(state.feed).toHaveLength(FEED_LENGTH);
    expect(state.feed.at(-1)?.text).toBe(`guess ${FEED_LENGTH + 1}`);
  });

  it('reveals as soon as everyone guessed, scoring guessers by speed and the artist per guess', () => {
    let state = guess(drawing(), 'rui', 'ice cream', 1_000); // instantly
    expect(state.phase).toBe('drawing');
    state = guess(state, 'eva', 'ice cream', 6_000); // halfway

    expect(state).toMatchObject({ phase: 'reveal', endsAt: 9_000 });
    expect(state.gained).toEqual({ rui: 800, eva: 500, ana: 2 * ARTIST_POINTS_PER_GUESS });
    expect(draw.playerView(state, 'rui')).toMatchObject({ word: 'ice cream', gained: 800 });
    expect(draw.hostView(state).leaderboard.map((e) => e.playerId)).toEqual(['rui', 'eva', 'ana']);
  });

  it('gives nobody points when nobody guessed in time', () => {
    const state = draw.onTick(drawing(), 11_000);
    expect(state.phase).toBe('reveal');
    expect(state.gained).toEqual({ ana: 0, rui: 0, eva: 0 });
    expect(draw.hostView(state).hint).toBe('ice cream');
  });

  it('moves on to the next artist after the reveal, then finishes', () => {
    let state = draw.onTick(drawing(), 11_000);
    state = draw.onTick(state, 14_000);
    expect(state).toMatchObject({ phase: 'choosing', turn: 1, feed: [], guessedAt: {} });
    expect(draw.hostView(state)).toMatchObject({ artistId: 'rui', turn: 2, totalTurns: 2 });

    state = draw.onTick(draw.onTick(state, 19_000), 29_000);
    expect(state.phase).toBe('reveal');
    state = draw.onTick(state, 32_000);
    expect(state.phase).toBe('finished');
    expect(draw.isOver(state)).toBe(true);
  });
});
