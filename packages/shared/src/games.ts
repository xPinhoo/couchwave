export const TRIVIA_CHOICES = 4;

/** Each choice has the same colour and symbol on the TV and on the phones. */
export const CHOICE_STYLES = [
  { color: '#e5484d', symbol: '▲' },
  { color: '#3e63dd', symbol: '◆' },
  { color: '#d6a300', symbol: '●' },
  { color: '#30a46c', symbol: '■' },
] as const;

export const TRIVIA_TOPICS = [
  { id: 'general', name: 'General', emoji: '🧠' },
  { id: 'music', name: 'Music', emoji: '🎵' },
  { id: 'sports', name: 'Sports', emoji: '⚽' },
  { id: 'cinema', name: 'Cinema', emoji: '🎬' },
  { id: 'geography', name: 'Geography', emoji: '🌍' },
  { id: 'history', name: 'History', emoji: '🏛️' },
] as const;

export type TriviaTopic = (typeof TRIVIA_TOPICS)[number]['id'];

export const TRIVIA_SECONDS_OPTIONS = [10, 15, 30] as const;
export const TRIVIA_LENGTH_OPTIONS = [10, 20, 30] as const;

/** What the host picks on the setup screen. */
export interface TriviaOptions {
  topic: TriviaTopic;
  secondsPerQuestion: (typeof TRIVIA_SECONDS_OPTIONS)[number];
  questionCount: (typeof TRIVIA_LENGTH_OPTIONS)[number];
}

export const DEFAULT_TRIVIA_OPTIONS: TriviaOptions = {
  topic: 'general',
  secondsPerQuestion: 15,
  questionCount: 10,
};

export function triviaTopic(id: TriviaTopic) {
  return TRIVIA_TOPICS.find((topic) => topic.id === id) ?? TRIVIA_TOPICS[0];
}

/** `countdown` is the "get ready" before the first question, which stays hidden. */
export type TriviaPhase = 'countdown' | 'question' | 'reveal' | 'finished';

export interface LeaderboardEntry {
  playerId: string;
  score: number;
  /** Points won or lost on the last question (negative for a wrong or missing answer). */
  gained: number;
}

export interface TriviaPick {
  playerId: string;
  choice: number;
}

/** What the big screen shows. */
export interface TriviaHostView {
  game: 'trivia';
  topic: TriviaTopic;
  phase: TriviaPhase;
  /** 1-based. */
  round: number;
  totalRounds: number;
  prompt: string;
  choices: string[];
  /** Server time (ms) when the current phase ends; null once the game is finished. */
  endsAt: number | null;
  /** Everyone in the game, in join order. */
  playerIds: string[];
  /** Who has answered the current question (not what they picked). */
  answeredIds: string[];
  /** Only revealed after the question closes. */
  correctChoice: number | null;
  /** Who picked what, only during the reveal. */
  picks: TriviaPick[] | null;
  leaderboard: LeaderboardEntry[];
}

export interface TriviaResult {
  correct: boolean;
  /** True when the player didn't answer in time. */
  missed: boolean;
  /** Points won or lost (negative for a wrong or missing answer). */
  points: number;
}

/** What one phone shows. Never includes the correct answer while the question is open. */
export interface TriviaPlayerView {
  game: 'trivia';
  phase: TriviaPhase;
  round: number;
  totalRounds: number;
  choices: string[];
  endsAt: number | null;
  myChoice: number | null;
  /** Outcome of the last question, from the reveal onwards. */
  lastResult: TriviaResult | null;
  score: number;
  /** 1-based; players with the same score share a rank. */
  rank: number;
  playerCount: number;
}

/** Every game update carries the server's clock so clients can line up countdowns. */
export interface GameUpdate<View> {
  serverTime: number;
  view: View;
}

/**
 * Time left until `endsAt` (a server timestamp), corrected for the difference between
 * the server's clock and this device's. `receivedAt` and `now` use the device clock.
 */
export function remainingMs(
  endsAt: number,
  serverTime: number,
  receivedAt: number,
  now: number,
): number {
  const clockOffset = serverTime - receivedAt;
  return Math.max(0, endsAt - (now + clockOffset));
}
