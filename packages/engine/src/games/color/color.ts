import {
  COLOR_PUZZLES,
  HEX_COLOR,
  colorPuzzle,
  type ColorCategory,
  type ColorHostView,
  type ColorPhase,
  type ColorPlayerView,
  type ColorResult,
  type LeaderboardEntry,
} from '@couchwave/shared';
import type { GameModule } from '../../game.js';
import { shuffle } from '../../random.js';
import { COLOR_ANSWERS } from './answers.js';

export interface ColorSettings {
  category: ColorCategory;
  /** The pictures to play, in order. */
  puzzleIds: readonly string[];
  countdownMs: number;
  pickMs: number;
  revealMs: number;
}

export type ColorInput = { type: 'pick'; color: string } | { type: 'lock' };

export interface ColorState {
  settings: ColorSettings;
  playerIds: string[];
  phase: ColorPhase;
  /** 0-based. */
  round: number;
  endsAt: number | null;
  /** This round's colours, as they're mixed. */
  picks: Record<string, string>;
  lockedIds: string[];
  results: ColorResult[];
  scores: Record<string, number>;
  gained: Record<string, number>;
}

/** What the exact colour scores. */
export const MAX_COLOR_POINTS = 1_000;
/** Colours this different (see `colorDifference`) or more score nothing. */
const ZERO_POINTS_DIFFERENCE = 66;

/** Picks `count` random pictures from a category ("mix" means all of them). */
export function pickColorPuzzles(
  category: ColorCategory,
  count: number,
  random: () => number,
): string[] {
  const pool = COLOR_PUZZLES.filter((item) => category === 'mix' || item.category === category);
  return shuffle(pool, random)
    .slice(0, count)
    .map((item) => item.id);
}

function toLab(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/**
 * How different two colours look to the eye (CIE76: the distance in Lab space), rather than
 * how far apart their hex digits are: 2 is barely visible, 100 is black against white.
 */
export function colorDifference(a: string, b: string): number {
  const [la, aa, ba] = toLab(a);
  const [lb, ab, bb] = toLab(b);
  return Math.hypot(la - lb, aa - ab, ba - bb);
}

/** How close a guess is, from 0 to 100. */
export function colorAccuracy(guess: string, answer: string): number {
  const away = colorDifference(guess, answer) / ZERO_POINTS_DIFFERENCE;
  return Math.max(0, Math.round((1 - away) * 100));
}

const puzzleId = (state: ColorState) => state.settings.puzzleIds[state.round] ?? '';
const answerOf = (state: ColorState) => COLOR_ANSWERS[puzzleId(state)] ?? '#000000';
/** The picture stays hidden during the countdown. */
const showing = (state: ColorState) => state.phase === 'pick' || state.phase === 'reveal';
const nameOf = (state: ColorState) =>
  showing(state) ? (colorPuzzle(puzzleId(state))?.name ?? '') : '';
const revealedAnswer = (state: ColorState) => (state.phase === 'reveal' ? answerOf(state) : null);

function startRound(state: ColorState, round: number, now: number): ColorState {
  return {
    ...state,
    phase: 'pick',
    round,
    endsAt: now + state.settings.pickMs,
    picks: {},
    lockedIds: [],
    results: [],
    gained: {},
  };
}

function reveal(state: ColorState, now: number): ColorState {
  const answer = answerOf(state);
  const results = state.playerIds
    .map((playerId): ColorResult => {
      const color = state.picks[playerId] ?? null;
      const accuracy = color ? colorAccuracy(color, answer) : 0;
      return { playerId, color, accuracy, points: (accuracy * MAX_COLOR_POINTS) / 100 };
    })
    .sort((a, b) => b.points - a.points);
  const gained = Object.fromEntries(results.map((result) => [result.playerId, result.points]));
  return {
    ...state,
    phase: 'reveal',
    endsAt: now + state.settings.revealMs,
    results,
    gained,
    scores: Object.fromEntries(
      state.playerIds.map((id) => [id, (state.scores[id] ?? 0) + (gained[id] ?? 0)]),
    ),
  };
}

function leaderboard(state: ColorState): LeaderboardEntry[] {
  return state.playerIds
    .map((playerId) => ({
      playerId,
      score: state.scores[playerId] ?? 0,
      gained: state.gained[playerId] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
}

/** Players with the same score share a rank. */
function rankOf(state: ColorState, playerId: string): number {
  const score = state.scores[playerId] ?? 0;
  return 1 + state.playerIds.filter((id) => (state.scores[id] ?? 0) > score).length;
}

export const color: GameModule<
  ColorState,
  ColorInput,
  ColorSettings,
  ColorHostView,
  ColorPlayerView
> = {
  id: 'color',
  name: 'Guess the Color',
  minPlayers: 1,

  init(playerIds, settings, now) {
    if (settings.puzzleIds.length === 0) throw new Error('Guess the Color needs pictures');
    const initial: ColorState = {
      settings,
      playerIds,
      phase: 'countdown',
      round: 0,
      endsAt: now + settings.countdownMs,
      picks: {},
      lockedIds: [],
      results: [],
      scores: {},
      gained: {},
    };
    return settings.countdownMs > 0 ? initial : startRound(initial, 0, now);
  },

  onInput(state, playerId, input, now) {
    if (state.phase !== 'pick' || !state.playerIds.includes(playerId)) return state;
    if (state.lockedIds.includes(playerId)) return state;

    if (input.type === 'pick') {
      return HEX_COLOR.test(input.color) && state.picks[playerId] !== input.color
        ? { ...state, picks: { ...state.picks, [playerId]: input.color } }
        : state;
    }
    if (!state.picks[playerId]) return state;
    const next = { ...state, lockedIds: [...state.lockedIds, playerId] };
    return next.lockedIds.length === state.playerIds.length ? reveal(next, now) : next;
  },

  onTick(state, now) {
    if (state.endsAt === null || now < state.endsAt) return state;
    switch (state.phase) {
      case 'countdown':
        return startRound(state, 0, now);
      case 'pick':
        return reveal(state, now);
      case 'reveal':
        return state.round + 1 < state.settings.puzzleIds.length
          ? startRound(state, state.round + 1, now)
          : { ...state, phase: 'finished', endsAt: null };
      case 'finished':
        return state;
    }
  },

  isOver: (state) => state.phase === 'finished',

  hostView(state) {
    return {
      game: 'color',
      phase: state.phase,
      category: state.settings.category,
      round: state.round + 1,
      totalRounds: state.settings.puzzleIds.length,
      puzzleId: showing(state) ? puzzleId(state) : '',
      name: nameOf(state),
      endsAt: state.endsAt,
      playerIds: state.playerIds,
      lockedIds: state.lockedIds,
      answer: revealedAnswer(state),
      results: state.phase === 'reveal' ? state.results : [],
      leaderboard: leaderboard(state),
    };
  },

  playerView(state, playerId) {
    return {
      game: 'color',
      phase: state.phase,
      round: state.round + 1,
      totalRounds: state.settings.puzzleIds.length,
      name: nameOf(state),
      endsAt: state.endsAt,
      myColor: state.picks[playerId] ?? null,
      locked: state.lockedIds.includes(playerId),
      lockedCount: state.lockedIds.length,
      answer: revealedAnswer(state),
      result:
        state.phase === 'reveal'
          ? (state.results.find((item) => item.playerId === playerId) ?? null)
          : null,
      score: state.scores[playerId] ?? 0,
      rank: rankOf(state, playerId),
      playerCount: state.playerIds.length,
    };
  },
};
