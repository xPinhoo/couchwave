/** Injection token for the reconnect grace period in milliseconds. */
export const RECONNECT_GRACE_MS = Symbol('RECONNECT_GRACE_MS');

/** Injection token for {@link TriviaConfig}. */
export const TRIVIA_CONFIG = Symbol('TRIVIA_CONFIG');

export interface TriviaConfig {
  rounds: number;
  questionMs: number;
  revealMs: number;
}

export const DEFAULT_TRIVIA_CONFIG: TriviaConfig = {
  rounds: 8,
  questionMs: 15_000,
  revealMs: 5_000,
};

/** How often running games are checked for expired timers. */
export const GAME_TICK_MS = 250;
