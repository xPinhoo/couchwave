import { TRIVIA_LENGTH_OPTIONS, TRIVIA_TOPICS } from '@couchwave/shared';
import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS, pickQuestions } from './questions/index.js';
import {
  NO_ANSWER_POINTS,
  scoreAnswer,
  trivia,
  type TriviaSettings,
  type TriviaState,
} from './trivia.js';

const settings: TriviaSettings = {
  topic: 'general',
  questions: [
    { prompt: 'Q1', choices: ['a', 'b', 'c', 'd'], answer: 1 },
    { prompt: 'Q2', choices: ['a', 'b', 'c', 'd'], answer: 3 },
  ],
  questionMs: 10_000,
  revealMs: 3_000,
  countdownMs: 0,
};

const start = (players = ['ana', 'rui']) => trivia.init(players, settings, 0);
const answer = (state: TriviaState, playerId: string, choice: number, now: number) =>
  trivia.onInput(state, playerId, { choice }, now);

describe('scoreAnswer', () => {
  it('gives 1000 for an instant correct answer and 500 at the buzzer', () => {
    expect(scoreAnswer(true, 0, 10_000)).toBe(1000);
    expect(scoreAnswer(true, 10_000, 10_000)).toBe(500);
  });

  it('scales the speed bonus linearly', () => {
    expect(scoreAnswer(true, 2_500, 10_000)).toBe(875);
  });

  it('makes a fast wrong answer cost more than a slow one', () => {
    expect(scoreAnswer(false, 0, 10_000)).toBe(-400);
    expect(scoreAnswer(false, 2_500, 10_000)).toBe(-325);
    expect(scoreAnswer(false, 10_000, 10_000)).toBe(-100);
  });

  it('charges no answer the same as a wrong answer at the last moment', () => {
    expect(NO_ANSWER_POINTS).toBe(scoreAnswer(false, 10_000, 10_000));
  });
});

describe('trivia', () => {
  it('opens the first question with a deadline', () => {
    expect(start()).toMatchObject({ phase: 'question', round: 0, endsAt: 10_000 });
  });

  it('can count down first, keeping the question hidden until it opens', () => {
    let state = trivia.init(['ana'], { ...settings, countdownMs: 5_000 }, 0);
    expect(state).toMatchObject({ phase: 'countdown', endsAt: 5_000 });
    expect(trivia.hostView(state)).toMatchObject({ prompt: '', choices: [] });
    expect(trivia.playerView(state, 'ana').choices).toEqual([]);
    expect(answer(state, 'ana', 1, 1_000)).toBe(state);

    state = trivia.onTick(state, 5_000);
    expect(state).toMatchObject({ phase: 'question', round: 0, endsAt: 15_000 });
    expect(trivia.hostView(state).prompt).toBe('Q1');
  });

  it('records one answer per player and ignores changes of mind', () => {
    let state = answer(start(), 'ana', 1, 1_000);
    state = answer(state, 'ana', 2, 2_000);
    expect(state.answers).toEqual({ ana: { choice: 1, at: 1_000 } });
  });

  it('ignores late answers, unknown players and invalid choices', () => {
    const state = start();
    expect(answer(state, 'ana', 1, 10_000)).toBe(state);
    expect(answer(state, 'stranger', 1, 1_000)).toBe(state);
    expect(answer(state, 'ana', 4, 1_000)).toBe(state);
    expect(answer(state, 'ana', 1.5, 1_000)).toBe(state);
  });

  it('reveals as soon as everyone has answered, scoring correctness and speed', () => {
    let state = answer(start(), 'ana', 1, 2_500); // correct, 2.5s in
    state = answer(state, 'rui', 0, 4_000); // wrong, 4s in

    expect(state.phase).toBe('reveal');
    expect(state.endsAt).toBe(4_000 + settings.revealMs);
    expect(state.scores).toEqual({ ana: 875, rui: -280 });
    expect(state.results).toEqual({
      ana: { correct: true, missed: false, points: 875 },
      rui: { correct: false, missed: false, points: -280 },
    });
  });

  it('reveals when the timer runs out, charging players who did not answer', () => {
    const state = trivia.onTick(answer(start(), 'ana', 1, 0), 10_000);
    expect(state.phase).toBe('reveal');
    expect(state.results.rui).toEqual({ correct: false, missed: true, points: -100 });
    expect(state.scores).toEqual({ ana: 1000, rui: -100 });
  });

  it('does nothing on a tick before the deadline', () => {
    const state = start();
    expect(trivia.onTick(state, 9_999)).toBe(state);
  });

  it('moves to the next question after the reveal, then finishes', () => {
    let state = trivia.onTick(start(), 10_000); // reveal Q1
    state = trivia.onTick(state, 13_000); // Q2
    expect(state).toMatchObject({ phase: 'question', round: 1, answers: {} });

    state = trivia.onTick(trivia.onTick(state, 23_000), 26_000);
    expect(state).toMatchObject({ phase: 'finished', endsAt: null });
    expect(trivia.isOver(state)).toBe(true);
  });

  describe('views', () => {
    it('shows who answered, but never what or the correct answer, while the question is open', () => {
      const state = answer(start(), 'ana', 1, 1_000);

      expect(trivia.hostView(state)).toMatchObject({
        topic: 'general',
        playerIds: ['ana', 'rui'],
        answeredIds: ['ana'],
        correctChoice: null,
        picks: null,
      });
      expect(trivia.playerView(state, 'ana')).toMatchObject({ myChoice: 1, lastResult: null });
      expect(trivia.playerView(state, 'rui')).toMatchObject({ myChoice: null });
    });

    it('shows the answer, who picked what and the leaderboard during the reveal', () => {
      let state = answer(start(), 'ana', 1, 0);
      state = answer(state, 'rui', 2, 5_000);

      expect(trivia.hostView(state)).toMatchObject({
        phase: 'reveal',
        correctChoice: 1,
        picks: [
          { playerId: 'ana', choice: 1 },
          { playerId: 'rui', choice: 2 },
        ],
        leaderboard: [
          { playerId: 'ana', score: 1000, gained: 1000 },
          { playerId: 'rui', score: -250, gained: -250 },
        ],
      });
      expect(trivia.playerView(state, 'rui')).toMatchObject({
        lastResult: { correct: false, missed: false, points: -250 },
        score: -250,
        rank: 2,
      });
    });

    it('gives tied players the same rank', () => {
      const state = trivia.onTick(start(), 10_000);
      expect(trivia.playerView(state, 'ana').rank).toBe(1);
      expect(trivia.playerView(state, 'rui').rank).toBe(1);
    });
  });
});

describe('question banks', () => {
  const longestGame = Math.max(...TRIVIA_LENGTH_OPTIONS);

  it.each(TRIVIA_TOPICS.map((t) => t.id))(
    '%s has enough well-formed questions for the longest game',
    (topic) => {
      const bank = QUESTION_BANKS[topic];
      expect(bank.length).toBeGreaterThanOrEqual(longestGame);
      expect(new Set(bank.map((q) => q.prompt)).size).toBe(bank.length);

      // Four distinct, non-empty choices, so exactly one can be right
      const malformed = bank
        .filter(({ answer, wrong }) => {
          const choices = [answer, ...wrong];
          return new Set(choices).size !== 4 || choices.some((c) => c.trim() === '');
        })
        .map((q) => q.prompt);
      expect(malformed).toEqual([]);
    },
  );
});

describe('pickQuestions', () => {
  const bank = QUESTION_BANKS.general;

  it('picks the requested number of distinct questions', () => {
    const picked = pickQuestions(bank, 8);
    expect(picked).toHaveLength(8);
    expect(new Set(picked.map((q) => q.prompt)).size).toBe(8);
  });

  it('keeps the answer index pointing at the right choice after shuffling', () => {
    for (const question of pickQuestions(bank, bank.length)) {
      const source = bank.find((q) => q.prompt === question.prompt);
      expect(question.choices[question.answer]).toBe(source?.answer);
      expect(question.choices).toHaveLength(4);
    }
  });

  it('is deterministic for a given random source', () => {
    const seeded = () => {
      let seed = 42;
      return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    };
    expect(pickQuestions(bank, 5, seeded())).toEqual(pickQuestions(bank, 5, seeded()));
  });
});
