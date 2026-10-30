import type { SketchOp } from '@couchwave/shared';
import { describe, expect, it } from 'vitest';
import {
  REVEAL_LONG_FACTOR,
  phone,
  phoneSteps,
  planChains,
  type PhoneInput,
  type PhoneSettings,
  type PhoneState,
} from './phone.js';

/** A seeded pseudo-random generator, so plans are random but repeatable. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

const players = ['ana', 'rui', 'eva'];
const dot: SketchOp = { kind: 'pen', color: 0, size: 0, points: [500, 500] };

function settings(ids = players, change: Partial<PhoneSettings> = {}): PhoneSettings {
  return {
    order: planChains(ids, seeded(7)),
    phrases: ['A random cat', 'A random dog'],
    writeMs: 30_000,
    drawMs: 60_000,
    guessMs: 30_000,
    revealMs: 5_000,
    ...change,
  };
}

function input(state: PhoneState, playerId: string, ...inputs: PhoneInput[]) {
  return inputs.reduce((next, item) => phone.onInput(next, playerId, item, 0), state);
}

/** Everyone writes `phrase-<id>` and presses Done. */
function writeAll(state: PhoneState) {
  return players.reduce(
    (next, id) =>
      input(next, id, { type: 'text', text: `phrase-${id}` }, { type: 'done', done: true }),
    state,
  );
}

describe('phoneSteps', () => {
  it('ends every chain on a phrase', () => {
    expect([3, 4, 5, 6].map(phoneSteps)).toEqual([3, 3, 5, 5]);
  });
});

describe('planChains', () => {
  it.each([3, 4, 5, 8])(
    'gives everyone one chain per step, and never the same chain twice (%i players)',
    (count) => {
      const ids = Array.from({ length: count }, (_, i) => `p${i}`);
      const order = planChains(ids, seeded(count));

      expect(order).toHaveLength(phoneSteps(count));
      expect(order[0]).toEqual(ids);
      for (const step of order) expect(new Set(step).size).toBe(count);
      for (let chain = 0; chain < count; chain++) {
        expect(new Set(order.map((step) => step[chain])).size).toBe(order.length);
      }
    },
  );

  it("doesn't always pass the chains in the same order", () => {
    const ids = Array.from({ length: 7 }, (_, i) => `p${i}`);
    const firstHandoffs = new Set(
      [1, 2, 3, 4, 5].map((seed) => planChains(ids, seeded(seed))[1]!.join()),
    );
    expect(firstHandoffs.size).toBeGreaterThan(1);
  });
});

describe('Drawing Phone', () => {
  it('starts with everyone writing', () => {
    const state = phone.init(players, settings(), 0);
    expect(state.phase).toBe('write');
    expect(state.endsAt).toBe(30_000);
    expect(phone.hostView(state)).toMatchObject({ step: 1, totalSteps: 3, doneIds: [] });
  });

  it('moves on as soon as everyone is done, and passes each phrase on to draw', () => {
    const state = writeAll(phone.init(players, settings(), 0));
    expect(state.phase).toBe('draw');

    for (const id of players) {
      const owner = state.playerIds[state.settings.order[1]!.indexOf(id)]!;
      expect(owner).not.toBe(id);
      expect(phone.playerView(state, id).phrase).toBe(`phrase-${owner}`);
    }
  });

  it("can't be done without a phrase, and Edit lets you change it", () => {
    let state = phone.init(players, settings(), 0);
    state = input(state, 'ana', { type: 'done', done: true });
    expect(state.doneIds).toEqual([]);

    state = input(state, 'ana', { type: 'text', text: 'first' }, { type: 'done', done: true });
    expect(state.doneIds).toEqual(['ana']);
    // Typing while done is ignored until they press Edit
    state = input(state, 'ana', { type: 'text', text: 'ignored' });
    expect(state.drafts.ana).toBe('first');
    state = input(state, 'ana', { type: 'done', done: false }, { type: 'text', text: 'second' });
    expect(state.drafts.ana).toBe('second');
  });

  it('hands out random phrases and remembers they were random', () => {
    let state = phone.init(players, settings(), 0);
    state = input(state, 'ana', { type: 'random' });
    expect(phone.playerView(state, 'ana').draft).toBe('A random cat');
    state = input(state, 'rui', { type: 'text', text: 'typed' });

    // Eva wrote nothing, so time running out gives her a random phrase too
    state = phone.onTick(state, 30_000);
    expect(state.chains.map((chain) => chain[0])).toEqual([
      { kind: 'text', playerId: 'ana', text: 'A random cat', source: 'random' },
      { kind: 'text', playerId: 'rui', text: 'typed', source: 'typed' },
      { kind: 'text', playerId: 'eva', text: 'A random dog', source: 'random' },
    ]);
  });

  it('sends unfinished drawings and guesses when time runs out', () => {
    let state = writeAll(phone.init(players, settings(), 0));
    state = input(state, 'ana', { type: 'op', op: dot }, { type: 'op', op: { kind: 'clear' } });
    state = input(state, 'ana', { type: 'undo' });
    expect(phone.playerView(state, 'ana').sketch).toEqual([dot]);
    state = phone.onTick(state, state.endsAt!);

    expect(state.phase).toBe('guess');
    const anaChain = state.settings.order[1]!.indexOf('ana');
    expect(state.chains[anaChain]![1]).toEqual({ kind: 'sketch', playerId: 'ana', ops: [dot] });

    // Whoever got Ana's drawing guesses it
    const guesser = state.settings.order[2]![anaChain]!;
    expect(phone.playerView(state, guesser).drawing).toEqual([dot]);
    state = input(state, guesser, { type: 'text', text: '  a dot ' });
    state = phone.onTick(state, state.endsAt!);
    expect(state.chains[anaChain]![2]).toMatchObject({ text: 'a dot', source: 'typed' });
  });

  it('records a missed guess, and the next drawer gets the phrase before it', () => {
    const five = ['a', 'b', 'c', 'd', 'e'];
    let state = phone.init(five, settings(five), 0);
    for (const id of five) state = input(state, id, { type: 'text', text: `phrase-${id}` });
    state = phone.onTick(state, state.endsAt!); // write → draw
    state = phone.onTick(state, state.endsAt!); // draw → guess, nobody guesses
    state = phone.onTick(state, state.endsAt!); // guess → draw

    expect(state.chains[0]![2]).toMatchObject({ text: '', source: 'missed' });
    const drawer = state.settings.order[3]![0]!;
    expect(phone.playerView(state, drawer).phrase).toBe('phrase-a');
  });

  it("ignores drawing when it isn't time to draw, and from players not in the game", () => {
    const state = phone.init(players, settings(), 0);
    expect(input(state, 'ana', { type: 'op', op: dot })).toBe(state);
    expect(input(state, 'zoe', { type: 'text', text: 'hi' })).toBe(state);
  });

  describe('the reveal', () => {
    /** Plays a 3-player game to the reveal: write, draw a dot, guess "guess-<id>". */
    function toReveal() {
      let state = writeAll(phone.init(players, settings(), 0));
      for (const id of players) state = input(state, id, { type: 'op', op: dot });
      state = players.reduce((next, id) => input(next, id, { type: 'done', done: true }), state);
      return players.reduce(
        (next, id) =>
          input(next, id, { type: 'text', text: `guess-${id}` }, { type: 'done', done: true }),
        state,
      );
    }

    it('goes link by link, then shows the original and the final phrase', () => {
      let state = toReveal();
      expect(state.phase).toBe('reveal');
      const first = phone.hostView(state).reveal!;
      expect(first).toMatchObject({
        chain: 0,
        totalChains: 3,
        ownerId: 'ana',
        entry: 0,
        entryCount: 3,
        current: { kind: 'text', text: 'phrase-ana' },
        previousText: null,
      });
      expect(state.endsAt).toBe(5_000);

      state = phone.onTick(state, 5_000);
      const drawing = phone.hostView(state).reveal!;
      expect(drawing).toMatchObject({
        entry: 1,
        current: { kind: 'sketch' },
        previousText: 'phrase-ana',
      });
      // Drawings stay up a little longer
      expect(state.endsAt).toBe(5_000 + 5_000 * REVEAL_LONG_FACTOR);

      state = phone.onTick(phone.onTick(state, state.endsAt!), Infinity);
      const summary = phone.hostView(state).reveal!;
      const lastGuesser = state.settings.order[2]![0]!;
      expect(summary).toMatchObject({ entry: 3, current: null });
      expect(summary.summary).toEqual({
        ownerId: 'ana',
        original: 'phrase-ana',
        final: `guess-${lastGuesser}`,
      });
    });

    it('lets the host skip ahead, and finishes with every chain', () => {
      let state = toReveal();
      // 3 chains × (3 links + the summary card)
      for (let i = 0; i < 12; i++) state = input(state, 'ana', { type: 'next' });
      expect(phone.isOver(state)).toBe(true);
      expect(phone.hostView(state).summaries.map((s) => s.original)).toEqual([
        'phrase-ana',
        'phrase-rui',
        'phrase-eva',
      ]);
    });
  });
});
