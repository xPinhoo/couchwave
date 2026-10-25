import type {
  LeaderboardEntry,
  TriviaHostView,
  TriviaPhase,
  TriviaPlayerView,
} from '@couchwave/shared';
import type { GameModule } from '../../game.js';

export interface TriviaQuestion {
  prompt: string;
  choices: string[];
  /** Index into `choices`. */
  answer: number;
}

export interface TriviaSettings {
  questions: TriviaQuestion[];
  questionMs: number;
  revealMs: number;
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
  /** Points each player won on the last revealed question. */
  gained: Record<string, number>;
}

export const BASE_POINTS = 500;
export const SPEED_BONUS = 500;

/** A correct answer is worth 500 points, plus up to 500 more the faster it came in. */
export function scoreAnswer(correct: boolean, answeredAfterMs: number, questionMs: number): number {
  if (!correct) return 0;
  const fractionLeft = Math.min(1, Math.max(0, 1 - answeredAfterMs / questionMs));
  return Math.round(BASE_POINTS + SPEED_BONUS * fractionLeft);
}

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
  const gained: Record<string, number> = {};

  for (const id of state.playerIds) {
    const answer = state.answers[id];
    const points = answer
      ? scoreAnswer(
          answer.choice === question.answer,
          answer.at - state.phaseStartedAt,
          state.settings.questionMs,
        )
      : 0;
    gained[id] = points;
    scores[id] = (scores[id] ?? 0) + points;
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

function leaderboard(state: TriviaState): LeaderboardEntry[] {
  return state.playerIds
    .map((playerId) => ({
      playerId,
      score: state.scores[playerId] ?? 0,
      gained: state.gained[playerId] ?? 0,
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
      gained: {},
    };
    return startQuestion(initial, 0, now);
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
    const revealed = state.phase === 'reveal';
    const counts = question.choices.map(
      (_, i) => Object.values(state.answers).filter((a) => a.choice === i).length,
    );

    return {
      game: 'trivia',
      phase: state.phase,
      round: state.round + 1,
      totalRounds: state.settings.questions.length,
      prompt: question.prompt,
      choices: question.choices,
      endsAt: state.endsAt,
      answeredCount: Object.keys(state.answers).length,
      playerCount: state.playerIds.length,
      correctChoice: state.phase === 'question' ? null : question.answer,
      choiceCounts: revealed ? counts : null,
      leaderboard: leaderboard(state),
    };
  },

  playerView(state, playerId) {
    const question = currentQuestion(state);
    const gained = state.gained[playerId] ?? 0;

    return {
      game: 'trivia',
      phase: state.phase,
      round: state.round + 1,
      totalRounds: state.settings.questions.length,
      choices: question.choices,
      endsAt: state.endsAt,
      myChoice: state.answers[playerId]?.choice ?? null,
      lastResult: state.phase === 'question' ? null : { correct: gained > 0, points: gained },
      score: state.scores[playerId] ?? 0,
      rank: rankOf(state, playerId),
      playerCount: state.playerIds.length,
    };
  },
};
