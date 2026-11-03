import type { LeaderboardEntry } from './games.js';

/**
 * Liar's Table: everyone gets a hand and the table names a card. On your turn you play one to
 * three cards face down, claiming they're all that card, unless you call the last player a liar.
 * Whoever a call goes against loses a life; the last player with any left wins.
 */

export const LIAR_LIVES_OPTIONS = [2, 3, 5] as const;
export const LIAR_SECONDS_OPTIONS = [15, 30, 45] as const;

export interface LiarsOptions {
  lives: (typeof LIAR_LIVES_OPTIONS)[number];
  secondsPerTurn: (typeof LIAR_SECONDS_OPTIONS)[number];
}

export const DEFAULT_LIARS_OPTIONS: LiarsOptions = {
  lives: 3,
  secondsPerTurn: 30,
};

export const LIAR_HAND_SIZE = 5;
/** The most cards you can play in one turn. */
export const LIAR_MAX_PLAY = 3;

/** The cards the table can name. */
export const LIAR_RANKS = [
  { id: 'K', name: 'King', plural: 'Kings' },
  { id: 'Q', name: 'Queen', plural: 'Queens' },
  { id: 'A', name: 'Ace', plural: 'Aces' },
] as const;

export type LiarRank = (typeof LIAR_RANKS)[number]['id'];

export function liarRank(id: LiarRank) {
  return LIAR_RANKS.find((rank) => rank.id === id) ?? LIAR_RANKS[0];
}

export interface LiarCard {
  id: number;
  /** A joker counts as whatever the table names. */
  rank: LiarRank | 'joker';
}

/** "Queen", or "Joker". */
export const liarCardName = (card: LiarCard) =>
  card.rank === 'joker' ? 'Joker' : liarRank(card.rank).name;

// ── Game views ───────────────────────────────────────────────────────────────

/** deal: the new table card · turn: someone plays or calls · reveal: the cards flip · finished */
export type LiarsPhase = 'deal' | 'turn' | 'reveal' | 'finished';

/** The cards on top of the table, as everyone sees them: face down. */
export interface LiarPlay {
  playerId: string;
  count: number;
}

export interface LiarReveal {
  playerId: string;
  cards: LiarCard[];
  /** null: nobody was left to call it, so the game did. */
  callerId: string | null;
  lied: boolean;
  /** Who loses a life. null: an honest play the game called, so nobody does. */
  loserId: string | null;
  /** That was their last life. */
  eliminated: boolean;
}

export interface LiarsHostView {
  game: 'liars';
  phase: LiarsPhase;
  /** 1-based hand. */
  round: number;
  endsAt: number | null;
  tableRank: LiarRank;
  playerIds: string[];
  aliveIds: string[];
  lives: Record<string, number>;
  maxLives: number;
  /** How many cards each player has left. */
  handCounts: Record<string, number>;
  /** Whose turn it is. */
  turnId: string | null;
  lastPlay: LiarPlay | null;
  /** How many cards are face down on the table. */
  pileCount: number;
  reveal: LiarReveal | null;
  winnerId: string | null;
  /** Lives left, the winner first and whoever went out first last. */
  leaderboard: LeaderboardEntry[];
}

export interface LiarsPlayerView {
  game: 'liars';
  phase: LiarsPhase;
  round: number;
  endsAt: number | null;
  tableRank: LiarRank;
  hand: LiarCard[];
  turnId: string | null;
  isMyTurn: boolean;
  lastPlay: LiarPlay | null;
  /** You're still in the game. */
  alive: boolean;
  lives: number;
  maxLives: number;
  reveal: LiarReveal | null;
  winnerId: string | null;
  /** 1-based, at the end. */
  rank: number;
  playerCount: number;
}
