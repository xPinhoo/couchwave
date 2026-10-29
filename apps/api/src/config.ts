import { DEFAULT_GAME_CONFIG, type GameConfig } from './rooms/rooms.constants.js';

/**
 * Comma-separated list of allowed origins in production (CORS_ORIGINS=https://a.app,https://b.app).
 * When unset, any origin is allowed — convenient for local dev and for phones on the LAN.
 */
export function corsOrigins(): string[] | true {
  const raw = process.env.CORS_ORIGINS?.trim();
  return raw ? raw.split(',').map((origin) => origin.trim()) : true;
}

function positiveIntEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** How long a disconnected player keeps their seat before it is freed (RECONNECT_GRACE_MS). */
export function reconnectGraceMs(): number {
  return positiveIntEnv('RECONNECT_GRACE_MS', 30_000);
}

/** How long a room waits for its TV screen to come back before closing (SCREEN_GRACE_MS). */
export function screenGraceMs(): number {
  return positiveIntEnv('SCREEN_GRACE_MS', 120_000);
}

/**
 * Game timing. Production uses the defaults; the browser tests speed games up with
 * GAME_MS_PER_SECOND (how long one "second" lasts), GAME_REVEAL_MS and TRIVIA_MAX_QUESTIONS.
 */
export function gameConfig(): GameConfig {
  return {
    revealMs: positiveIntEnv('GAME_REVEAL_MS', DEFAULT_GAME_CONFIG.revealMs),
    msPerSecond: positiveIntEnv('GAME_MS_PER_SECOND', DEFAULT_GAME_CONFIG.msPerSecond),
    maxQuestions: positiveIntEnv('TRIVIA_MAX_QUESTIONS', DEFAULT_GAME_CONFIG.maxQuestions),
  };
}
