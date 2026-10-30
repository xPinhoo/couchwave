import type {
  LeaderboardEntry,
  TriviaHostView,
  TriviaPhase,
  TriviaPlayerView,
  TriviaResult,
  TriviaTopic,
} from '@couchwave/shared';
import type { GameModule } from '../../game.js';

export interface TriviaQuestion {
  prompt: string;
  choices: string[];
  /** Index into `choices`. */
  answer: number;
}

export interface TriviaSettings {
  topic: TriviaTopic;
  questions: TriviaQuestion[];
  questionMs: number;
  revealMs: number;
  /** The "get ready" countdown before the first question; 0 starts straight away. */
  countdownMs: number;
}

export interface TriviaInput {
  choice: number;
}

interface Answer {
  choice: number;
  at: number;
}

export interface TriviaState {
  settings: TriviaSettings;
  playerIds: string[];
  /** 0-based index into `settings.questions`. */
  round: number;
  phase: TriviaPhase;
  phaseStartedAt: number;
  endsAt: number | null;
  /** Answers to the current question. */
  answers: Record<string, Answer>;
  scores: Record<string, number>;
  /** How each player did on the last revealed question. */
  results: Record<string, TriviaResult>;
}

export const BASE_POINTS = 500;
export const SPEED_BONUS = 500;
export const MIN_PENALTY = 100;
export const MAX_PENALTY = 400;

/**
 * Speed is a gamble. A correct answer earns 500 plus up to 500 more the faster it came in;
 * a wrong one costs 100 plus up to 300 more the faster it came in. So answering wrong at
 * the buzzer costs the minimum, and answering wrong instantly costs the most.
 */
export function scoreAnswer(correct: boolean, answeredAfterMs: number, questionMs: number): number {
  const fractionLeft = Math.min(1, Math.max(0, 1 - answeredAfterMs / questionMs));
  return correct
    ? Math.round(BASE_POINTS + SPEED_BONUS * fractionLeft)
    : -Math.round(MIN_PENALTY + (MAX_PENALTY - MIN_PENALTY) * fractionLeft);
}

/** Not answering costs the same as a wrong answer at the very last moment. */
export const NO_ANSWER_POINTS = -MIN_PENALTY;

const currentQuestion = (state: TriviaState): TriviaQuestion => {
  const question = state.settings.questions[state.round];
  if (!question) throw new Error(`No question for round ${state.round}`);
  return question;
};

function startQuestion(state: TriviaState, round: number, now: number): TriviaState {
  return {
    ...state,
    round,
    phase: 'question',
    phaseStartedAt: now,
    endsAt: now + state.settings.questionMs,
    answers: {},
  };
}

function reveal(state: TriviaState, now: number): TriviaState {
  const question = currentQuestion(state);
  const scores = { ...state.scores };
  const results: Record<string, TriviaResult> = {};

  for (const id of state.playerIds) {
    const answer = state.answers[id];
    const correct = answer?.choice === question.answer;
    const points = answer
      ? scoreAnswer(correct, answer.at - state.phaseStartedAt, state.settings.questionMs)
      : NO_ANSWER_POINTS;
    results[id] = { correct, missed: !answer, points };
    scores[id] = (scores[id] ?? 0) + points;
  }

  return {
    ...state,
    phase: 'reveal',
    phaseStartedAt: now,
    endsAt: now + state.settings.revealMs,
    scores,
    results,
  };
}

function leaderboard(state: TriviaState): LeaderboardEntry[] {
  return state.playerIds
    .map((playerId) => ({
      playerId,
      score: state.scores[playerId] ?? 0,
      gained: state.results[playerId]?.points ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
}

/** Players with the same score share a rank. */
function rankOf(state: TriviaState, playerId: string): number {
  const score = state.scores[playerId] ?? 0;
  return 1 + state.playerIds.filter((id) => (state.scores[id] ?? 0) > score).length;
}

export const trivia: GameModule<
  TriviaState,
  TriviaInput,
  TriviaSettings,
  TriviaHostView,
  TriviaPlayerView
> = {
  id: 'trivia',
  name: 'Quick-fire trivia',
  minPlayers: 1,

  init(playerIds, settings, now) {
    if (settings.questions.length === 0) throw new Error('Trivia needs at least one question');
    const initial: TriviaState = {
      settings,
      playerIds,
      round: 0,
      phase: 'question',
      phaseStartedAt: now,
      endsAt: null,
      answers: {},
      scores: Object.fromEntries(playerIds.map((id) => [id, 0])),
      results: {},
    };
    return settings.countdownMs > 0
      ? { ...initial, phase: 'countdown', endsAt: now + settings.countdownMs }
      : startQuestion(initial, 0, now);
  },

  onInput(state, playerId, { choice }, now) {
    if (state.phase !== 'question' || state.endsAt === null || now >= state.endsAt) return state;
    if (!state.playerIds.includes(playerId) || playerId in state.answers) return state;
    if (
      !Number.isInteger(choice) ||
      choice < 0 ||
      choice >= currentQuestion(state).choices.length
    ) {
      return state;
    }

    const next = { ...state, answers: { ...state.answers, [playerId]: { choice, at: now } } };
    // Everyone answered: no point making them wait for the timer
    return Object.keys(next.answers).length === state.playerIds.length ? reveal(next, now) : next;
  },

  onTick(state, now) {
    if (state.endsAt === null || now < state.endsAt) return state;
    if (state.phase === 'countdown') return startQuestion(state, 0, now);
    if (state.phase === 'question') return reveal(state, now);
    if (state.phase === 'reveal') {
      return state.round + 1 < state.settings.questions.length
        ? startQuestion(state, state.round + 1, now)
        : { ...state, phase: 'finished', phaseStartedAt: now, endsAt: null };
    }
    return state;
  },

  isOver: (state) => state.phase === 'finished',

  hostView(state) {
    const question = currentQuestion(state);
    // Nobody gets a head start on the first question
    const hidden = state.phase === 'countdown';

    return {
      game: 'trivia',
      topic: state.settings.topic,
      phase: state.phase,
      round: state.round + 1,
      totalRounds: state.settings.questions.length,
      prompt: hidden ? '' : question.prompt,
      choices: hidden ? [] : question.choices,
      endsAt: state.endsAt,
      playerIds: state.playerIds,
      answeredIds: state.playerIds.filter((id) => id in state.answers),
      correctChoice:
        state.phase === 'reveal' || state.phase === 'finished' ? question.answer : null,
      picks:
        state.phase === 'reveal'
          ? Object.entries(state.answers).map(([playerId, { choice }]) => ({ playerId, choice }))
          : null,
      leaderboard: leaderboard(state),
    };
  },

  playerView(state, playerId) {
    const question = currentQuestion(state);

    return {
      game: 'trivia',
      phase: state.phase,
      round: state.round + 1,
      totalRounds: state.settings.questions.length,
      choices: state.phase === 'countdown' ? [] : question.choices,
      endsAt: state.endsAt,
      myChoice: state.answers[playerId]?.choice ?? null,
      lastResult:
        state.phase === 'reveal' || state.phase === 'finished'
          ? (state.results[playerId] ?? null)
          : null,
      score: state.scores[playerId] ?? 0,
      rank: rankOf(state, playerId),
      playerCount: state.playerIds.length,
    };
  },
};
