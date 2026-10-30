/** Injection token for the reconnect grace period in milliseconds. */
export const RECONNECT_GRACE_MS = Symbol('RECONNECT_GRACE_MS');

/** Injection token for how long a room survives without its TV screen, in milliseconds. */
export const SCREEN_GRACE_MS = Symbol('SCREEN_GRACE_MS');

/** Injection token for {@link GameConfig}. */
export const GAME_CONFIG = Symbol('GAME_CONFIG');

/**
 * Server-side game timing. The host's options pick things like the seconds per question or
 * to draw; these knobs exist so tests can play a whole game in a few seconds.
 */
export interface GameConfig {
  /** How long the answer (trivia) or the word (Draw & Guess) stays on screen. */
  revealMs: number;
  /** How long one of the games' "seconds" lasts. */
  msPerSecond: number;
  /** Upper bound on the number of trivia questions, whatever the host picked. */
  maxQuestions: number;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  revealMs: 5_000,
  msPerSecond: 1_000,
  maxQuestions: Number.POSITIVE_INFINITY,
};

/** The "get ready" countdown before trivia's first question. */
export const TRIVIA_COUNTDOWN_SECONDS = 5;

/** How long the artist has to pick a word in Draw & Guess. */
export const DRAW_CHOOSE_SECONDS = 15;

/** Drawing Phone: time to write the first phrase, and to guess a drawing. */
export const PHONE_WRITE_SECONDS = 45;
export const PHONE_GUESS_SECONDS = 40;

/** How often running games are checked for expired timers. */
export const GAME_TICK_MS = 250;
