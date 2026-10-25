import { describe, expect, it } from 'vitest';
import { GENERAL_KNOWLEDGE, pickQuestions } from './questions.js';
import { scoreAnswer, trivia, type TriviaSettings, type TriviaState } from './trivia.js';

const settings: TriviaSettings = {
  questions: [
    { prompt: 'Q1', choices: ['a', 'b', 'c', 'd'], answer: 1 },
    { prompt: 'Q2', choices: ['a', 'b', 'c', 'd'], answer: 3 },
  ],
  questionMs: 10_000,
  revealMs: 3_000,
};

const start = (players = ['ana', 'rui']) => trivia.init(players, settings, 0);
const answer = (state: TriviaState, playerId: string, choice: number, now: number) =>
  trivia.onInput(state, playerId, { choice }, now);

describe('scoreAnswer', () => {
  it('gives nothing for a wrong answer', () => {
    expect(scoreAnswer(false, 0, 10_000)).toBe(0);
  });

  it('gives 1000 for an instant correct answer and 500 at the buzzer', () => {
    expect(scoreAnswer(true, 0, 10_000)).toBe(1000);
    expect(scoreAnswer(true, 10_000, 10_000)).toBe(500);
  });

  it('scales the speed bonus linearly', () => {
    expect(scoreAnswer(true, 2_500, 10_000)).toBe(875);
  });
});

describe('trivia', () => {
  it('opens the first question with a deadline', () => {
    expect(start()).toMatchObject({ phase: 'question', round: 0, endsAt: 10_000 });
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

  it('reveals as soon as everyone has answered, scoring by correctness and speed', () => {
    let state = answer(start(), 'ana', 1, 2_500); // correct, 2.5s in
    state = answer(state, 'rui', 0, 4_000); // wrong

    expect(state.phase).toBe('reveal');
    expect(state.endsAt).toBe(4_000 + settings.revealMs);
    expect(state.scores).toEqual({ ana: 875, rui: 0 });
  });

  it('reveals when the timer runs out, giving no points to players who did not answer', () => {
    const state = trivia.onTick(answer(start(), 'ana', 1, 0), 10_000);
    expect(state.phase).toBe('reveal');
    expect(state.gained).toEqual({ ana: 1000, rui: 0 });
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
    it('hides the correct answer from everyone while the question is open', () => {
      const state = answer(start(), 'ana', 1, 1_000);

      expect(trivia.hostView(state)).toMatchObject({
        correctChoice: null,
        choiceCounts: null,
        answeredCount: 1,
        playerCount: 2,
      });
      expect(trivia.playerView(state, 'ana')).toMatchObject({ myChoice: 1, lastResult: null });
      expect(trivia.playerView(state, 'rui')).toMatchObject({ myChoice: null });
    });

    it('shows the answer, the vote split and the leaderboard during the reveal', () => {
      let state = answer(start(), 'ana', 1, 0);
      state = answer(state, 'rui', 1, 5_000);

      expect(trivia.hostView(state)).toMatchObject({
        phase: 'reveal',
        correctChoice: 1,
        choiceCounts: [0, 2, 0, 0],
        leaderboard: [
          { playerId: 'ana', score: 1000, gained: 1000 },
          { playerId: 'rui', score: 750, gained: 750 },
        ],
      });
      expect(trivia.playerView(state, 'rui')).toMatchObject({
        lastResult: { correct: true, points: 750 },
        score: 750,
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

describe('pickQuestions', () => {
  it('picks the requested number of distinct questions', () => {
    const picked = pickQuestions(GENERAL_KNOWLEDGE, 8);
    expect(picked).toHaveLength(8);
    expect(new Set(picked.map((q) => q.prompt)).size).toBe(8);
  });

  it('keeps the answer index pointing at the right choice after shuffling', () => {
    for (const question of pickQuestions(GENERAL_KNOWLEDGE, GENERAL_KNOWLEDGE.length)) {
      const source = GENERAL_KNOWLEDGE.find((q) => q.prompt === question.prompt);
      expect(question.choices[question.answer]).toBe(source?.answer);
      expect(question.choices).toHaveLength(4);
    }
  });

  it('is deterministic for a given random source', () => {
    const seeded = () => {
      let seed = 42;
      return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    };
    expect(pickQuestions(GENERAL_KNOWLEDGE, 5, seeded())).toEqual(
      pickQuestions(GENERAL_KNOWLEDGE, 5, seeded()),
    );
  });
});
