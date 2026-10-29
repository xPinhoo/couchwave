import {
  DRAW_WORD_CHOICES,
  normalizeGuess,
  type DrawGuess,
  type DrawHostView,
  type DrawPhase,
  type DrawPlayerView,
  type GuessFeedback,
  type LeaderboardEntry,
} from '@couchwave/shared';
import type { GameModule } from '../../game.js';
import { shuffle } from '../../random.js';

export interface DrawTurn {
  artistId: string;
  /** The words the artist chooses from. */
  choices: string[];
}

export interface DrawSettings {
  turns: DrawTurn[];
  chooseMs: number;
  drawMs: number;
  revealMs: number;
}

export type DrawInput = { type: 'choose'; index: number } | { type: 'guess'; text: string };

export interface DrawState {
  settings: DrawSettings;
  playerIds: string[];
  /** 0-based index into `settings.turns`. */
  turn: number;
  phase: DrawPhase;
  phaseStartedAt: number;
  endsAt: number | null;
  /** Null until the artist has chosen. */
  word: string | null;
  /** How many hint letters are showing (they appear as time runs out). */
  hintsRevealed: number;
  /** When each player guessed this turn's word, in the order they got it. */
  guessedAt: Record<string, number>;
  feed: DrawGuess[];
  lastGuess: Record<string, GuessFeedback>;
  lastGuessAt: Record<string, number>;
  scores: Record<string, number>;
  /** Points each player won on the last revealed turn. */
  gained: Record<string, number>;
}

export const GUESS_BASE_POINTS = 200;
export const GUESS_SPEED_BONUS = 600;
/** The artist earns this for every player who guessed their drawing. */
export const ARTIST_POINTS_PER_GUESS = 200;
/** Players can't spam guesses faster than this. */
export const GUESS_COOLDOWN_MS = 500;
/** How many wrong guesses the TV keeps on screen. */
export const FEED_LENGTH = 8;
/** Hint letters appear once this much of the drawing time has passed. */
export const HINT_AT = [0.5, 0.75] as const;

/** A correct guess earns 200, plus up to 600 more the sooner it came. */
export function scoreGuess(guessedAfterMs: number, drawMs: number): number {
  const fractionLeft = Math.min(1, Math.max(0, 1 - guessedAfterMs / drawMs));
  return Math.round(GUESS_BASE_POINTS + GUESS_SPEED_BONUS * fractionLeft);
}

/**
 * Who draws and which words they choose from. Everyone draws once per round, in join order;
 * no word comes up twice in a game (unless the list runs out).
 */
export function planTurns(
  playerIds: string[],
  rounds: number,
  words: readonly string[],
  random: () => number = Math.random,
): DrawTurn[] {
  const artists = Array.from({ length: rounds }, () => playerIds).flat();
  let deck: string[] = [];
  return artists.map((artistId) => {
    if (deck.length < DRAW_WORD_CHOICES) deck = shuffle(words, random);
    return { artistId, choices: deck.splice(0, DRAW_WORD_CHOICES) };
  });
}

/** Edit distance, for spotting guesses that are one letter off. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** The letters a hint reveals, in order: the first one, then one in the middle. */
function hintPositions(word: string): number[] {
  return [...new Set([0, Math.floor(word.length / 2)])].filter((i) => word[i] !== ' ');
}

/** "ice cream" with one hint → "i__ _____". Spaces always show. */
export function maskWord(word: string, hintsRevealed: number): string {
  const shown = new Set(hintPositions(word).slice(0, hintsRevealed));
  return [...word].map((char, i) => (char === ' ' || shown.has(i) ? char : '_')).join('');
}

const currentTurn = (state: DrawState): DrawTurn => {
  const turn = state.settings.turns[state.turn];
  if (!turn) throw new Error(`No turn ${state.turn}`);
  return turn;
};

const guessers = (state: DrawState) =>
  state.playerIds.filter((id) => id !== currentTurn(state).artistId);

function startTurn(state: DrawState, turn: number, now: number): DrawState {
  return {
    ...state,
    turn,
    phase: 'choosing',
    phaseStartedAt: now,
    endsAt: now + state.settings.chooseMs,
    word: null,
    hintsRevealed: 0,
    guessedAt: {},
    feed: [],
    lastGuess: {},
    lastGuessAt: {},
  };
}

function chooseWord(state: DrawState, index: number, now: number): DrawState {
  const word = currentTurn(state).choices[index];
  if (word === undefined) return state;
  return {
    ...state,
    phase: 'drawing',
    phaseStartedAt: now,
    endsAt: now + state.settings.drawMs,
    word,
  };
}

function reveal(state: DrawState, now: number): DrawState {
  const { artistId } = currentTurn(state);
  const gained: Record<string, number> = Object.fromEntries(state.playerIds.map((id) => [id, 0]));
  for (const [playerId, at] of Object.entries(state.guessedAt)) {
    gained[playerId] = scoreGuess(at - state.phaseStartedAt, state.settings.drawMs);
  }
  gained[artistId] = ARTIST_POINTS_PER_GUESS * Object.keys(state.guessedAt).length;

  const scores = { ...state.scores };
  for (const [playerId, points] of Object.entries(gained)) {
    scores[playerId] = (scores[playerId] ?? 0) + points;
  }

  return {
    ...state,
    phase: 'reveal',
    phaseStartedAt: now,
    endsAt: now + state.settings.revealMs,
    scores,
    gained,
  };
}

function guess(state: DrawState, playerId: string, text: string, now: number): DrawState {
  if (state.phase !== 'drawing' || state.word === null) return state;
  if (state.endsAt === null || now >= state.endsAt) return state;
  if (!guessers(state).includes(playerId) || playerId in state.guessedAt) return state;
  if (now - (state.lastGuessAt[playerId] ?? -Infinity) < GUESS_COOLDOWN_MS) return state;

  const normalized = normalizeGuess(text);
  if (!normalized) return state;

  const answer = normalizeGuess(state.word);
  const feedback: GuessFeedback =
    normalized === answer
      ? 'correct'
      : answer.length >= 4 && distance(normalized, answer) === 1
        ? 'close'
        : 'wrong';

  const next: DrawState = {
    ...state,
    lastGuess: { ...state.lastGuess, [playerId]: feedback },
    lastGuessAt: { ...state.lastGuessAt, [playerId]: now },
    guessedAt: feedback === 'correct' ? { ...state.guessedAt, [playerId]: now } : state.guessedAt,
    // Near misses stay private: on the TV they would give the word away
    feed:
      feedback === 'wrong'
        ? [...state.feed, { playerId, text: text.trim() }].slice(-FEED_LENGTH)
        : state.feed,
  };
  // Everyone got it: no point drawing any longer
  return Object.keys(next.guessedAt).length === guessers(state).length ? reveal(next, now) : next;
}

function leaderboard(state: DrawState): LeaderboardEntry[] {
  return state.playerIds
    .map((playerId) => ({
      playerId,
      score: state.scores[playerId] ?? 0,
      gained: state.gained[playerId] ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
}

/** Players with the same score share a rank. */
function rankOf(state: DrawState, playerId: string): number {
  const score = state.scores[playerId] ?? 0;
  return 1 + state.playerIds.filter((id) => (state.scores[id] ?? 0) > score).length;
}

/** The word, masked while it's being guessed. Nothing is shown while the artist chooses. */
function hintOf(state: DrawState): string {
  if (state.word === null) return '';
  return state.phase === 'drawing' ? maskWord(state.word, state.hintsRevealed) : state.word;
}

export const draw: GameModule<DrawState, DrawInput, DrawSettings, DrawHostView, DrawPlayerView> = {
  id: 'draw',
  name: 'Draw & Guess',
  minPlayers: 2,

  init(playerIds, settings, now) {
    if (settings.turns.length === 0) throw new Error('Draw & Guess needs at least one turn');
    const initial: DrawState = {
      settings,
      playerIds,
      turn: 0,
      phase: 'choosing',
      phaseStartedAt: now,
      endsAt: null,
      word: null,
      hintsRevealed: 0,
      guessedAt: {},
      feed: [],
      lastGuess: {},
      lastGuessAt: {},
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      gained: {},
    };
    return startTurn(initial, 0, now);
  },

  onInput(state, playerId, input, now) {
    if (input.type === 'guess') return guess(state, playerId, input.text, now);

    if (state.phase !== 'choosing' || playerId !== currentTurn(state).artistId) return state;
    if (!Number.isInteger(input.index)) return state;
    return chooseWord(state, input.index, now);
  },

  onTick(state, now) {
    if (state.endsAt === null) return state;

    if (state.phase === 'drawing' && now < state.endsAt) {
      const elapsed = (now - state.phaseStartedAt) / state.settings.drawMs;
      const hintsRevealed = HINT_AT.filter((at) => elapsed >= at).length;
      return hintsRevealed > state.hintsRevealed ? { ...state, hintsRevealed } : state;
    }
    if (now < state.endsAt) return state;

    switch (state.phase) {
      // The artist didn't choose in time: take the first word for them
      case 'choosing':
        return chooseWord(state, 0, now);
      case 'drawing':
        return reveal(state, now);
      case 'reveal':
        return state.turn + 1 < state.settings.turns.length
          ? startTurn(state, state.turn + 1, now)
          : { ...state, phase: 'finished', phaseStartedAt: now, endsAt: null };
      default:
        return state;
    }
  },

  isOver: (state) => state.phase === 'finished',

  hostView(state) {
    return {
      game: 'draw',
      phase: state.phase,
      turn: state.turn + 1,
      totalTurns: state.settings.turns.length,
      artistId: currentTurn(state).artistId,
      endsAt: state.endsAt,
      hint: hintOf(state),
      guessedIds: Object.keys(state.guessedAt),
      feed: state.feed,
      playerIds: state.playerIds,
      leaderboard: leaderboard(state),
    };
  },

  playerView(state, playerId) {
    const { artistId, choices } = currentTurn(state);
    const isArtist = playerId === artistId;
    const wordIsPublic = state.phase === 'reveal' || state.phase === 'finished';

    return {
      game: 'draw',
      phase: state.phase,
      turn: state.turn + 1,
      totalTurns: state.settings.turns.length,
      artistId,
      isArtist,
      endsAt: state.endsAt,
      wordChoices: isArtist && state.phase === 'choosing' ? choices : [],
      word: wordIsPublic || (isArtist && state.phase === 'drawing') ? state.word : null,
      hint: hintOf(state),
      guessed: playerId in state.guessedAt,
      lastGuess: state.lastGuess[playerId] ?? null,
      gained: wordIsPublic ? (state.gained[playerId] ?? 0) : 0,
      score: state.scores[playerId] ?? 0,
      rank: rankOf(state, playerId),
      playerCount: state.playerIds.length,
    };
  },
};
