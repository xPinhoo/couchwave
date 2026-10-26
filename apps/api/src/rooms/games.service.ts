import { QUESTION_BANKS, pickQuestions, trivia, type TriviaState } from '@couchwave/engine';
import type { TriviaOptions } from '@couchwave/shared';
import { Inject, Injectable } from '@nestjs/common';
import { TRIVIA_CONFIG, type TriviaConfig } from './rooms.constants.js';

/**
 * Holds the running game of each room. Every method returns the new state only when
 * something changed, so callers know when to broadcast.
 */
@Injectable()
export class GamesService {
  private readonly games = new Map<string, TriviaState>();

  /** Overridable in tests for a deterministic question order. */
  random: () => number = Math.random;

  constructor(@Inject(TRIVIA_CONFIG) private readonly config: TriviaConfig) {}

  start(roomCode: string, playerIds: string[], options: TriviaOptions, now: number): TriviaState {
    const count = Math.min(options.questionCount, this.config.maxQuestions);
    const questions = pickQuestions(QUESTION_BANKS[options.topic], count, this.random);
    const state = trivia.init(
      playerIds,
      {
        topic: options.topic,
        questions,
        questionMs: options.secondsPerQuestion * this.config.msPerSecond,
        revealMs: this.config.revealMs,
      },
      now,
    );
    this.games.set(roomCode, state);
    return state;
  }

  get(roomCode: string): TriviaState | undefined {
    return this.games.get(roomCode);
  }

  answer(roomCode: string, playerId: string, choice: number, now: number): TriviaState | undefined {
    return this.update(roomCode, (state) => trivia.onInput(state, playerId, { choice }, now));
  }

  tick(roomCode: string, now: number): TriviaState | undefined {
    return this.update(roomCode, (state) => trivia.onTick(state, now));
  }

  stop(roomCode: string): void {
    this.games.delete(roomCode);
  }

  private update(
    roomCode: string,
    change: (state: TriviaState) => TriviaState,
  ): TriviaState | undefined {
    const state = this.games.get(roomCode);
    if (!state) return undefined;

    const next = change(state);
    if (next === state) return undefined;
    this.games.set(roomCode, next);
    return next;
  }
}
