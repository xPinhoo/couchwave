import {
  EMPTY_SKETCH,
  PHRASE_MAX_LENGTH,
  addSketchOp,
  redoSketch,
  sketchSize,
  undoSketch,
  type PhoneEntry,
  type PhoneHostView,
  type PhonePhase,
  type PhonePlayerView,
  type PhoneReveal,
  type PhoneSummary,
  type Sketch,
  type SketchOp,
} from '@couchwave/shared';
import type { GameModule } from '../../game.js';
import { shuffle } from '../../random.js';

export interface PhoneSettings {
  /** `order[step][chain]` is who adds the next link to that chain at that step. */
  order: string[][];
  /** Random phrases, already shuffled, handed out in order. */
  phrases: readonly string[];
  writeMs: number;
  drawMs: number;
  guessMs: number;
  /** How long a phrase stays on screen during the reveal; drawings get a bit longer. */
  revealMs: number;
}

export type PhoneInput =
  | { type: 'text'; text: string }
  | { type: 'random' }
  | { type: 'op'; op: SketchOp }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'done'; done: boolean }
  | { type: 'next' };

export interface PhoneState {
  settings: PhoneSettings;
  playerIds: string[];
  /** 0-based step: 0 is writing, then drawing and guessing take turns. */
  step: number;
  phase: PhonePhase;
  phaseStartedAt: number;
  endsAt: number | null;
  /** One chain per player, in join order: their phrase and what became of it. */
  chains: PhoneEntry[][];
  /** This step's text, per player, as they type it. */
  drafts: Record<string, string>;
  /** The random phrase each player got this step, to tell it apart from a typed one. */
  randomDrafts: Record<string, string>;
  /** This step's drawing, per player. */
  sketches: Record<string, Sketch>;
  doneIds: string[];
  /** Index of the next random phrase to hand out. */
  nextPhrase: number;
  /** During the reveal: which chain and which link of it the TV is showing. */
  reveal: { chain: number; entry: number };
}

/** Caps on one drawing, so a misbehaving client can't fill the server's memory. */
export const MAX_SKETCH_OPS = 1_000;
export const MAX_SKETCH_NUMBERS = 60_000;
/** Drawings and the "original vs final" card stay on screen this much longer than phrases. */
export const REVEAL_LONG_FACTOR = 1.6;

/** Steps in a game of `players`: everyone writes, then the chains alternate draw/guess. */
export function phoneSteps(players: number): number {
  // With an even number of players the last step would be a drawing nobody guesses,
  // so the chains stop one step early and every chain still ends on a phrase
  return players % 2 === 1 ? players : players - 1;
}

/**
 * Who works on which chain at each step. Everyone starts on their own chain, does one
 * thing per step, and never sees the same chain twice. The players sit in a random
 * circle, and each step passes the chains a random distance around it, so you don't
 * always get your work from the same person.
 */
export function planChains(playerIds: readonly string[], random: () => number): string[][] {
  const count = playerIds.length;
  const circle = shuffle(playerIds, random);
  const shifts = [
    0,
    ...shuffle(
      Array.from({ length: count - 1 }, (_, i) => i + 1),
      random,
    ),
  ].slice(0, phoneSteps(count));
  return shifts.map((shift) =>
    playerIds.map((owner) => circle[(circle.indexOf(owner) + shift) % count]!),
  );
}

const phaseOfStep = (step: number): PhonePhase =>
  step === 0 ? 'write' : step % 2 === 1 ? 'draw' : 'guess';

const chainOf = (state: PhoneState, playerId: string, step = state.step) =>
  state.settings.order[step]?.indexOf(playerId) ?? -1;

/** The last phrase anyone wrote in a chain, before link `before` (by default, all of it). */
function lastText(chain: readonly PhoneEntry[], before = chain.length): string | null {
  for (let i = before - 1; i >= 0; i--) {
    const entry = chain[i]!;
    if (entry.kind === 'text' && entry.text) return entry.text;
  }
  return null;
}

function summaryOf(state: PhoneState, chain: number): PhoneSummary {
  const entries = state.chains[chain] ?? [];
  const first = entries[0];
  return {
    ownerId: state.playerIds[chain] ?? '',
    original: first?.kind === 'text' ? first.text : '',
    final: lastText(entries) ?? '',
  };
}

function startStep(state: PhoneState, step: number, now: number): PhoneState {
  const phase = phaseOfStep(step);
  const { writeMs, drawMs, guessMs } = state.settings;
  return {
    ...state,
    step,
    phase,
    phaseStartedAt: now,
    endsAt: now + (phase === 'write' ? writeMs : phase === 'draw' ? drawMs : guessMs),
    drafts: {},
    randomDrafts: {},
    sketches: {},
    doneIds: [],
  };
}

function randomPhrase(state: PhoneState): string {
  const { phrases } = state.settings;
  return phrases[state.nextPhrase % phrases.length] ?? '';
}

/** Time's up (or everyone is done): whatever each player has so far becomes their link. */
function finishStep(state: PhoneState, now: number): PhoneState {
  const chains = state.chains.map((chain) => [...chain]);
  let { nextPhrase } = state;

  for (const playerId of state.playerIds) {
    const chain = chains[chainOf(state, playerId)];
    if (!chain) continue;
    const text = (state.drafts[playerId] ?? '').trim();

    if (state.phase === 'draw') {
      chain.push({ kind: 'sketch', playerId, ops: state.sketches[playerId]?.ops ?? [] });
    } else if (state.phase === 'write' && !text) {
      // Nobody can draw nothing: hand out a random phrase instead
      const phrases = state.settings.phrases;
      chain.push({
        kind: 'text',
        playerId,
        text: phrases[nextPhrase++ % phrases.length] ?? '',
        source: 'random',
      });
    } else {
      chain.push({
        kind: 'text',
        playerId,
        text,
        source: !text ? 'missed' : text === state.randomDrafts[playerId] ? 'random' : 'typed',
      });
    }
  }

  const next = { ...state, chains, nextPhrase };
  return state.step + 1 < state.settings.order.length
    ? startStep(next, state.step + 1, now)
    : showReveal(next, { chain: 0, entry: 0 }, now);
}

function showReveal(state: PhoneState, reveal: PhoneState['reveal'], now: number): PhoneState {
  const chain = state.chains[reveal.chain];
  if (!chain) return { ...state, phase: 'finished', phaseStartedAt: now, endsAt: null };

  const long = reveal.entry >= chain.length || chain[reveal.entry]?.kind === 'sketch';
  const { revealMs } = state.settings;
  return {
    ...state,
    phase: 'reveal',
    phaseStartedAt: now,
    endsAt: now + Math.round(long ? revealMs * REVEAL_LONG_FACTOR : revealMs),
    reveal,
  };
}

/** The next link of the chain, then its "original vs final" card, then the next chain. */
function nextReveal(state: PhoneState, now: number): PhoneState {
  const { chain, entry } = state.reveal;
  const length = state.chains[chain]?.length ?? 0;
  return showReveal(
    state,
    entry < length ? { chain, entry: entry + 1 } : { chain: chain + 1, entry: 0 },
    now,
  );
}

function setDone(state: PhoneState, playerId: string, done: boolean, now: number): PhoneState {
  if (state.phase !== 'write' && state.phase !== 'draw' && state.phase !== 'guess') return state;
  if (done && state.phase !== 'draw' && !(state.drafts[playerId] ?? '').trim()) return state;
  if (done === state.doneIds.includes(playerId)) return state;

  const doneIds = done
    ? state.playerIds.filter((id) => id === playerId || state.doneIds.includes(id))
    : state.doneIds.filter((id) => id !== playerId);
  const next = { ...state, doneIds };
  return doneIds.length === state.playerIds.length ? finishStep(next, now) : next;
}

/** Changes a player's drawing, unless they're done or it would get too big. */
function draw(state: PhoneState, playerId: string, change: (sketch: Sketch) => Sketch) {
  if (state.phase !== 'draw') return state;
  const sketch = state.sketches[playerId] ?? EMPTY_SKETCH;
  const next = change(sketch);
  if (next === sketch) return state;
  if (next.ops.length > MAX_SKETCH_OPS || sketchSize(next.ops) > MAX_SKETCH_NUMBERS) return state;
  return { ...state, sketches: { ...state.sketches, [playerId]: next } };
}

function revealView(state: PhoneState): PhoneReveal | null {
  if (state.phase !== 'reveal') return null;
  const { chain, entry } = state.reveal;
  const entries = state.chains[chain] ?? [];
  return {
    chain,
    totalChains: state.chains.length,
    ownerId: state.playerIds[chain] ?? '',
    entry,
    entryCount: entries.length,
    current: entries[entry] ?? null,
    previousText: lastText(entries, entry),
    summary: summaryOf(state, chain),
  };
}

export const phone: GameModule<
  PhoneState,
  PhoneInput,
  PhoneSettings,
  PhoneHostView,
  PhonePlayerView
> = {
  id: 'phone',
  name: 'Drawing Phone',
  minPlayers: 3,

  init(playerIds, settings, now) {
    if (settings.order.length === 0) throw new Error('Drawing Phone needs at least one step');
    if (settings.phrases.length === 0) throw new Error('Drawing Phone needs random phrases');
    const initial: PhoneState = {
      settings,
      playerIds,
      step: 0,
      phase: 'write',
      phaseStartedAt: now,
      endsAt: null,
      chains: playerIds.map(() => []),
      drafts: {},
      randomDrafts: {},
      sketches: {},
      doneIds: [],
      nextPhrase: 0,
      reveal: { chain: 0, entry: 0 },
    };
    return startStep(initial, 0, now);
  },

  onInput(state, playerId, input, now) {
    if (!state.playerIds.includes(playerId)) return state;
    if (input.type === 'next') return state.phase === 'reveal' ? nextReveal(state, now) : state;
    if (input.type === 'done') return setDone(state, playerId, input.done, now);
    // Finished players press "Edit" first, so nothing changes behind their back
    if (state.doneIds.includes(playerId)) return state;

    switch (input.type) {
      case 'text': {
        if (state.phase !== 'write' && state.phase !== 'guess') return state;
        const text = input.text.slice(0, PHRASE_MAX_LENGTH);
        return text === state.drafts[playerId]
          ? state
          : { ...state, drafts: { ...state.drafts, [playerId]: text } };
      }
      case 'random': {
        if (state.phase !== 'write') return state;
        const text = randomPhrase(state);
        return {
          ...state,
          drafts: { ...state.drafts, [playerId]: text },
          randomDrafts: { ...state.randomDrafts, [playerId]: text },
          nextPhrase: state.nextPhrase + 1,
        };
      }
      case 'op':
        return draw(state, playerId, (sketch) => addSketchOp(sketch, input.op));
      case 'undo':
        return draw(state, playerId, undoSketch);
      case 'redo':
        return draw(state, playerId, redoSketch);
    }
  },

  onTick(state, now) {
    if (state.endsAt === null || now < state.endsAt) return state;
    if (state.phase === 'reveal') return nextReveal(state, now);
    if (state.phase === 'finished') return state;
    return finishStep(state, now);
  },

  isOver: (state) => state.phase === 'finished',

  hostView(state) {
    return {
      game: 'phone',
      phase: state.phase,
      step: state.step + 1,
      totalSteps: state.settings.order.length,
      endsAt: state.endsAt,
      playerIds: state.playerIds,
      doneIds: state.doneIds,
      reveal: revealView(state),
      summaries:
        state.phase === 'finished' ? state.chains.map((_, chain) => summaryOf(state, chain)) : [],
    };
  },

  playerView(state, playerId) {
    const working = state.phase === 'draw' || state.phase === 'guess';
    const chain = working ? (state.chains[chainOf(state, playerId)] ?? []) : [];
    const last = chain.at(-1);
    return {
      game: 'phone',
      phase: state.phase,
      step: state.step + 1,
      totalSteps: state.settings.order.length,
      endsAt: state.endsAt,
      done: state.doneIds.includes(playerId),
      doneCount: state.doneIds.length,
      playerCount: state.playerIds.length,
      // A guesser who ran out of time left nothing: draw the phrase before theirs
      phrase: state.phase === 'draw' ? lastText(chain) : null,
      drawing: state.phase === 'guess' && last?.kind === 'sketch' ? last.ops : null,
      draft: state.drafts[playerId] ?? '',
      sketch: state.sketches[playerId]?.ops ?? [],
    };
  },
};
