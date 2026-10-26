/** Injection token for the reconnect grace period in milliseconds. */
export const RECONNECT_GRACE_MS = Symbol('RECONNECT_GRACE_MS');

/** Injection token for how long a room survives without its TV screen, in milliseconds. */
export const SCREEN_GRACE_MS = Symbol('SCREEN_GRACE_MS');

/** Injection token for {@link TriviaConfig}. */
export const TRIVIA_CONFIG = Symbol('TRIVIA_CONFIG');

/**
 * Server-side trivia timing. The host's options pick the topic, seconds per question and
 * number of questions; these knobs exist so tests can play a whole game in under a second.
 */
export interface TriviaConfig {
  revealMs: number;
  /** How long one of the host's "seconds per question" lasts. */
  msPerSecond: number;
  /** Upper bound on the number of questions, whatever the host picked. */
  maxQuestions: number;
}

export const DEFAULT_TRIVIA_CONFIG: TriviaConfig = {
  revealMs: 5_000,
  msPerSecond: 1_000,
  maxQuestions: Number.POSITIVE_INFINITY,
};

/** How often running games are checked for expired timers. */
export const GAME_TICK_MS = 250;
