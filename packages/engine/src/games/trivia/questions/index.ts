import type { TriviaTopic } from '@couchwave/shared';
import type { TriviaQuestion } from '../trivia.js';
import { CINEMA } from './cinema.js';
import { GENERAL } from './general.js';
import { GEOGRAPHY } from './geography.js';
import { HISTORY } from './history.js';
import { MUSIC } from './music.js';
import { SPORTS } from './sports.js';
import type { QuestionSource } from './types.js';

export type { QuestionSource } from './types.js';

/** Hand-written starter banks. Each has at least 30 questions, the longest game. */
export const QUESTION_BANKS: Record<TriviaTopic, readonly QuestionSource[]> = {
  general: GENERAL,
  music: MUSIC,
  sports: SPORTS,
  cinema: CINEMA,
  geography: GEOGRAPHY,
  history: HISTORY,
};

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Picks `count` random questions and shuffles each one's choices. */
export function pickQuestions(
  source: readonly QuestionSource[],
  count: number,
  random: () => number = Math.random,
): TriviaQuestion[] {
  return shuffle(source, random)
    .slice(0, count)
    .map(({ prompt, answer, wrong }) => {
      const choices = shuffle([answer, ...wrong], random);
      return { prompt, choices, answer: choices.indexOf(answer) };
    });
}
