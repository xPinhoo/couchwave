export const TRIVIA_CHOICES = 4;

/** Each choice has the same colour and symbol on the TV and on the phones. */
export const CHOICE_STYLES = [
  { color: '#e5484d', symbol: '▲' },
  { color: '#3e63dd', symbol: '◆' },
  { color: '#d6a300', symbol: '●' },
  { color: '#30a46c', symbol: '■' },
] as const;

export type TriviaPhase = 'question' | 'reveal' | 'finished';

export interface LeaderboardEntry {
  playerId: string;
  score: number;
  /** Points won on the last question. */
  gained: number;
}

/** What the big screen shows. */
export interface TriviaHostView {
  game: 'trivia';
  phase: TriviaPhase;
  /** 1-based. */
  round: number;
  totalRounds: number;
  prompt: string;
  choices: string[];
  /** Server time (ms) when the current phase ends; null once the game is finished. */
  endsAt: number | null;
  answeredCount: number;
  playerCount: number;
  /** Only revealed after the question closes. */
  correctChoice: number | null;
  /** How many players picked each choice, only during the reveal. */
  choiceCounts: number[] | null;
  leaderboard: LeaderboardEntry[];
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
  lastResult: { correct: boolean; points: number } | null;
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
