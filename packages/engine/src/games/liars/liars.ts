import {
  LIAR_HAND_SIZE,
  LIAR_MAX_PLAY,
  LIAR_RANKS,
  type LeaderboardEntry,
  type LiarCard,
  type LiarRank,
  type LiarReveal,
  type LiarsHostView,
  type LiarsPhase,
  type LiarsPlayerView,
} from '@couchwave/shared';
import type { GameModule } from '../../game.js';
import { shuffle } from '../../random.js';

export interface LiarsSettings {
  /** Every hand is dealt from this, as a game can last any number of hands. */
  seed: number;
  lives: number;
  dealMs: number;
  turnMs: number;
  revealMs: number;
}

export type LiarsInput = { type: 'play'; cardIds: readonly number[] } | { type: 'call' };

export interface LiarsState {
  settings: LiarsSettings;
  playerIds: string[];
  phase: LiarsPhase;
  /** 1-based hand. */
  round: number;
  endsAt: number | null;
  seed: number;
  lives: Record<string, number>;
  hands: Record<string, LiarCard[]>;
  tableRank: LiarRank;
  turnId: string | null;
  lastPlay: { playerId: string; cards: LiarCard[] } | null;
  pileCount: number;
  reveal: LiarReveal | null;
  /** Who has lost all their lives, in order. */
  outIds: string[];
}

/** Each pack is enough for this many players. */
const PLAYERS_PER_PACK = 4;
const COPIES_PER_RANK = 6;
const JOKERS_PER_PACK = 2;

/** mulberry32: a small generator that picks up from a saved seed. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function buildDeck(players: number): LiarCard[] {
  const packs = Math.ceil(players / PLAYERS_PER_PACK);
  const ranks = [
    ...LIAR_RANKS.flatMap((rank) => Array<LiarCard['rank']>(COPIES_PER_RANK).fill(rank.id)),
    ...Array<LiarCard['rank']>(JOKERS_PER_PACK).fill('joker'),
  ];
  return Array.from({ length: packs }, () => ranks)
    .flat()
    .map((rank, id) => ({ id, rank }));
}

const aliveIds = (state: LiarsState) => state.playerIds.filter((id) => (state.lives[id] ?? 0) > 0);

const isHonest = (card: LiarCard, tableRank: LiarRank) =>
  card.rank === tableRank || card.rank === 'joker';

/** The next seat after `fromId`, not counting `fromId`, that `matches`. */
function nextSeat(
  state: LiarsState,
  fromId: string,
  matches: (id: string) => boolean,
): string | null {
  const from = state.playerIds.indexOf(fromId);
  for (let step = 1; step < state.playerIds.length; step++) {
    const id = state.playerIds[(from + step) % state.playerIds.length]!;
    if (matches(id)) return id;
  }
  return null;
}

/** A new hand: fresh cards, a new table card and an empty table. */
function deal(state: LiarsState, starterId: string | null, now: number): LiarsState {
  const random = seeded(state.seed);
  const players = aliveIds(state);
  const deck = shuffle(buildDeck(players.length), random);
  const hands = Object.fromEntries(
    players.map((id, seat) => [id, deck.slice(seat * LIAR_HAND_SIZE, (seat + 1) * LIAR_HAND_SIZE)]),
  );
  const tableRank = LIAR_RANKS[Math.floor(random() * LIAR_RANKS.length)]!.id;
  const first = starterId ?? players[Math.floor(random() * players.length)] ?? null;
  return {
    ...state,
    phase: 'deal',
    round: state.round + 1,
    endsAt: now + state.settings.dealMs,
    seed: Math.floor(random() * 4_294_967_296),
    hands,
    tableRank,
    turnId: first,
    lastPlay: null,
    pileCount: 0,
    reveal: null,
  };
}

/** The cards on top of the table flip. `callerId` is null when nobody is left to call them. */
function flip(state: LiarsState, callerId: string | null, now: number): LiarsState {
  const play = state.lastPlay;
  if (!play) return state;
  const lied = play.cards.some((card) => !isHonest(card, state.tableRank));
  const loserId = lied ? play.playerId : callerId;
  const left = loserId ? (state.lives[loserId] ?? 0) - 1 : 0;
  const eliminated = loserId !== null && left === 0;
  return {
    ...state,
    phase: 'reveal',
    endsAt: now + state.settings.revealMs,
    turnId: null,
    lives: loserId ? { ...state.lives, [loserId]: left } : state.lives,
    outIds: eliminated ? [...state.outIds, loserId] : state.outIds,
    reveal: { playerId: play.playerId, cards: play.cards, callerId, lied, loserId, eliminated },
  };
}

function play(state: LiarsState, playerId: string, cardIds: readonly number[], now: number) {
  const hand = state.hands[playerId] ?? [];
  const unique = new Set(cardIds);
  const valid =
    cardIds.length >= 1 &&
    cardIds.length <= LIAR_MAX_PLAY &&
    unique.size === cardIds.length &&
    cardIds.every((id) => hand.some((card) => card.id === id));
  if (!valid) return state;

  const next: LiarsState = {
    ...state,
    hands: { ...state.hands, [playerId]: hand.filter((card) => !unique.has(card.id)) },
    lastPlay: { playerId, cards: hand.filter((card) => unique.has(card.id)) },
    pileCount: state.pileCount + cardIds.length,
  };
  const nextId = nextSeat(next, playerId, (id) => (next.hands[id]?.length ?? 0) > 0);
  // Nobody else has cards to answer with, so the game calls it
  if (!nextId) return flip(next, null, now);
  return { ...next, turnId: nextId, endsAt: now + state.settings.turnMs };
}

/** After the flip: the game ends with one player left, or the loser starts the next hand. */
function afterReveal(state: LiarsState, now: number): LiarsState {
  if (aliveIds(state).length <= 1) {
    return { ...state, phase: 'finished', endsAt: null, turnId: null };
  }
  const { loserId, playerId } = state.reveal!;
  const isAlive = (id: string) => (state.lives[id] ?? 0) > 0;
  const starter =
    loserId && isAlive(loserId) ? loserId : nextSeat(state, loserId ?? playerId, isAlive);
  return deal(state, starter, now);
}

/** The winner first, then whoever went out last. */
function standings(state: LiarsState): string[] {
  const alive = aliveIds(state).sort((a, b) => (state.lives[b] ?? 0) - (state.lives[a] ?? 0));
  return [...alive, ...[...state.outIds].reverse()];
}

const leaderboard = (state: LiarsState): LeaderboardEntry[] =>
  standings(state).map((playerId) => ({
    playerId,
    score: state.lives[playerId] ?? 0,
    gained: 0,
  }));

const lastPlayView = (state: LiarsState) =>
  state.lastPlay ? { playerId: state.lastPlay.playerId, count: state.lastPlay.cards.length } : null;

const winnerOf = (state: LiarsState) =>
  state.phase === 'finished' ? (aliveIds(state)[0] ?? null) : null;

export const liars: GameModule<
  LiarsState,
  LiarsInput,
  LiarsSettings,
  LiarsHostView,
  LiarsPlayerView
> = {
  id: 'liars',
  name: "Liar's Table",
  minPlayers: 2,

  init(playerIds, settings, now) {
    return deal(
      {
        settings,
        playerIds,
        phase: 'deal',
        round: 0,
        endsAt: null,
        seed: settings.seed,
        lives: Object.fromEntries(playerIds.map((id) => [id, settings.lives])),
        hands: {},
        tableRank: 'K',
        turnId: null,
        lastPlay: null,
        pileCount: 0,
        reveal: null,
        outIds: [],
      },
      null,
      now,
    );
  },

  onInput(state, playerId, input, now) {
    if (state.phase !== 'turn' || state.turnId !== playerId) return state;
    if (input.type === 'play') return play(state, playerId, input.cardIds, now);
    return state.lastPlay ? flip(state, playerId, now) : state;
  },

  onTick(state, now) {
    if (state.endsAt === null || now < state.endsAt) return state;
    switch (state.phase) {
      case 'deal':
        return { ...state, phase: 'turn', endsAt: now + state.settings.turnMs };
      case 'turn': {
        // Too slow: hands are shuffled, so the first card is a random one
        const turnId = state.turnId!;
        return play(state, turnId, [state.hands[turnId]![0]!.id], now);
      }
      case 'reveal':
        return afterReveal(state, now);
      case 'finished':
        return state;
    }
  },

  isOver: (state) => state.phase === 'finished',

  hostView(state) {
    return {
      game: 'liars',
      phase: state.phase,
      round: state.round,
      endsAt: state.endsAt,
      tableRank: state.tableRank,
      playerIds: state.playerIds,
      aliveIds: aliveIds(state),
      lives: state.lives,
      maxLives: state.settings.lives,
      handCounts: Object.fromEntries(
        state.playerIds.map((id) => [id, state.hands[id]?.length ?? 0]),
      ),
      turnId: state.turnId,
      lastPlay: lastPlayView(state),
      pileCount: state.pileCount,
      reveal: state.reveal,
      winnerId: winnerOf(state),
      leaderboard: leaderboard(state),
    };
  },

  playerView(state, playerId) {
    const lives = state.lives[playerId] ?? 0;
    return {
      game: 'liars',
      phase: state.phase,
      round: state.round,
      endsAt: state.endsAt,
      tableRank: state.tableRank,
      hand: lives > 0 ? (state.hands[playerId] ?? []) : [],
      turnId: state.turnId,
      isMyTurn: state.phase === 'turn' && state.turnId === playerId,
      lastPlay: lastPlayView(state),
      alive: lives > 0,
      lives,
      maxLives: state.settings.lives,
      reveal: state.reveal,
      winnerId: winnerOf(state),
      rank: standings(state).indexOf(playerId) + 1,
      playerCount: state.playerIds.length,
    };
  },
};
