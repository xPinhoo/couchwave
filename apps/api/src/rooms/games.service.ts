import { GENERAL_KNOWLEDGE, pickQuestions, trivia, type TriviaState } from '@couchwave/engine';
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

  start(roomCode: string, playerIds: string[], now: number): TriviaState {
    const questions = pickQuestions(GENERAL_KNOWLEDGE, this.config.rounds, this.random);
    const state = trivia.init(playerIds, { ...this.config, questions }, now);
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
