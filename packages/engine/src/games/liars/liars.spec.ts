import type { LiarCard } from '@couchwave/shared';
import { describe, expect, it } from 'vitest';
import { liars, type LiarsSettings, type LiarsState } from './liars.js';

const settings = (change: Partial<LiarsSettings> = {}): LiarsSettings => ({
  seed: 7,
  lives: 2,
  dealMs: 3_000,
  turnMs: 30_000,
  revealMs: 8_000,
  ...change,
});

const K = (id: number): LiarCard => ({ id, rank: 'K' });
const Q = (id: number): LiarCard => ({ id, rank: 'Q' });
const JOKER = (id: number): LiarCard => ({ id, rank: 'joker' });

/** A game at the first turn, with known cards: the table names Kings and Ana goes first. */
function table(hands: Record<string, LiarCard[]>, change: Partial<LiarsSettings> = {}): LiarsState {
  const started = liars.init(Object.keys(hands), settings(change), 0);
  return {
    ...started,
    phase: 'turn',
    endsAt: 30_000,
    hands,
    tableRank: 'K',
    turnId: Object.keys(hands)[0]!,
  };
}

const playCards = (state: LiarsState, id: string, ...cardIds: number[]) =>
  liars.onInput(state, id, { type: 'play', cardIds }, 0);
const call = (state: LiarsState, id: string) => liars.onInput(state, id, { type: 'call' }, 0);
const timeUp = (state: LiarsState) => liars.onTick(state, state.endsAt!);

describe('dealing', () => {
  it('gives everyone five different cards, then opens the first turn', () => {
    const state = liars.init(['ana', 'rui', 'eva'], settings(), 0);
    expect(state.phase).toBe('deal');
    const cards = Object.values(state.hands).flat();
    expect(state.hands.ana).toHaveLength(5);
    expect(new Set(cards.map((card) => card.id)).size).toBe(15);
    expect(['ana', 'rui', 'eva']).toContain(state.turnId);
    expect(['K', 'Q', 'A']).toContain(state.tableRank);

    expect(playCards(state, state.turnId!, state.hands[state.turnId!]![0]!.id)).toBe(state);
    expect(timeUp(state).phase).toBe('turn');
  });

  it('has enough cards for a full room', () => {
    const players = Array.from({ length: 8 }, (_, i) => `p${i}`);
    const state = liars.init(players, settings(), 0);
    expect(
      new Set(
        Object.values(state.hands)
          .flat()
          .map((c) => c.id),
      ).size,
    ).toBe(40);
  });

  it('deals different hands as the game goes on', () => {
    let state = table({ ana: [Q(1)], rui: [K(2)] }, { lives: 5 });
    state = call(playCards(state, 'ana', 1), 'rui');
    const next = timeUp(state);
    const another = timeUp(
      call(playCards({ ...next, phase: 'turn' }, 'ana', next.hands.ana![0]!.id), 'rui'),
    );
    expect(next.round).toBe(2);
    expect(next.hands.ana).not.toEqual(another.hands.ana);
  });
});

describe('playing', () => {
  it('takes one to three of your own cards, on your turn', () => {
    const state = table({ ana: [K(1), K(2), K(3), K(4), K(5)], rui: [Q(6)] });
    expect(playCards(state, 'rui', 6)).toBe(state);
    expect(playCards(state, 'ana')).toBe(state);
    expect(playCards(state, 'ana', 1, 2, 3, 4)).toBe(state);
    expect(playCards(state, 'ana', 1, 1)).toBe(state);
    expect(playCards(state, 'ana', 6)).toBe(state);

    const next = playCards(state, 'ana', 1, 2);
    expect(next.hands.ana!.map((card) => card.id)).toEqual([3, 4, 5]);
    expect(next.turnId).toBe('rui');
    expect(next.endsAt).toBe(30_000);
    expect(next.pileCount).toBe(2);
  });

  it('never shows the cards on the table or anyone else’s hand', () => {
    const state = playCards(table({ ana: [Q(11), K(12)], rui: [K(13)] }), 'ana', 11);
    const host = liars.hostView(state);
    expect(host.lastPlay).toEqual({ playerId: 'ana', count: 1 });
    expect(host.handCounts).toEqual({ ana: 1, rui: 1 });
    expect(JSON.stringify(host)).not.toContain('"cards"');
    expect(JSON.stringify(host)).not.toContain('"rank":');

    const rui = liars.playerView(state, 'rui');
    expect(rui.hand).toEqual([K(13)]);
    expect(rui.isMyTurn).toBe(true);
    expect(JSON.stringify(rui)).not.toContain('"Q"');
  });

  it('skips players with no cards left', () => {
    const state = table({ ana: [K(1), K(2)], rui: [K(3)], eva: [K(4)] });
    const next = playCards(playCards(playCards(state, 'ana', 1), 'rui', 3), 'eva', 4);
    expect(next.turnId).toBe('ana');
  });

  it('plays a random card if time runs out', () => {
    const state = timeUp(table({ ana: [K(1), K(2)], rui: [K(3)] }));
    expect(state.hands.ana).toEqual([K(2)]);
    expect(state.lastPlay).toEqual({ playerId: 'ana', cards: [K(1)] });
    expect(state.turnId).toBe('rui');
  });
});

describe('calling', () => {
  it('needs something on the table, and your turn', () => {
    const state = table({ ana: [K(1)], rui: [K(2)], eva: [K(3)] });
    expect(call(state, 'ana')).toBe(state);
    const played = playCards(state, 'ana', 1);
    expect(call(played, 'eva')).toBe(played);
  });

  it('costs the liar a life if any card was wrong', () => {
    const state = call(playCards(table({ ana: [K(1), Q(2)], rui: [K(3)] }), 'ana', 1, 2), 'rui');
    expect(state.phase).toBe('reveal');
    expect(state.lives).toEqual({ ana: 1, rui: 2 });
    expect(liars.hostView(state).reveal).toEqual({
      playerId: 'ana',
      cards: [K(1), Q(2)],
      callerId: 'rui',
      lied: true,
      loserId: 'ana',
      eliminated: false,
    });
  });

  it('costs the caller a life if they were honest, and jokers count', () => {
    const state = call(
      playCards(table({ ana: [K(1), JOKER(2)], rui: [K(3)] }), 'ana', 1, 2),
      'rui',
    );
    expect(state.lives).toEqual({ ana: 2, rui: 1 });
    expect(state.reveal).toMatchObject({ lied: false, loserId: 'rui' });
  });

  it('starts a new hand with the loser going first', () => {
    const state = timeUp(
      call(playCards(table({ ana: [Q(1)], rui: [K(2)], eva: [K(3)] }), 'ana', 1), 'rui'),
    );
    expect(state.phase).toBe('deal');
    expect(state.round).toBe(2);
    expect(state.turnId).toBe('ana');
    expect(state.lastPlay).toBeNull();
    expect(state.pileCount).toBe(0);
    expect(state.hands.eva).toHaveLength(5);
  });
});

describe('the last player with cards', () => {
  it('can still call the last play', () => {
    const state = playCards(table({ ana: [Q(1)], rui: [K(2), K(3)] }), 'ana', 1);
    expect(state.turnId).toBe('rui');
    expect(call(state, 'rui').lives.ana).toBe(1);
  });

  it('has their play called by the game, and a lie costs a life', () => {
    const played = playCards(table({ ana: [K(1)], rui: [Q(2)] }), 'ana', 1);
    const state = playCards(played, 'rui', 2);
    expect(state.phase).toBe('reveal');
    expect(state.reveal).toMatchObject({ callerId: null, lied: true, loserId: 'rui' });
    expect(state.lives.rui).toBe(1);
  });

  it('loses nothing for an honest play, and the next hand moves on', () => {
    const played = playCards(table({ ana: [K(1)], rui: [K(2)] }), 'ana', 1);
    const state = playCards(played, 'rui', 2);
    expect(state.reveal).toMatchObject({ callerId: null, lied: false, loserId: null });
    expect(state.lives).toEqual({ ana: 2, rui: 2 });
    expect(timeUp(state).turnId).toBe('ana');
  });
});

describe('going out', () => {
  const lastLife = { lives: 1 };

  it('removes a player with no lives left, and the next seat starts', () => {
    let state = call(
      playCards(table({ ana: [Q(1)], rui: [K(2)], eva: [K(3)] }, lastLife), 'ana', 1),
      'rui',
    );
    expect(state.reveal?.eliminated).toBe(true);
    state = timeUp(state);
    expect(state.phase).toBe('deal');
    expect(state.turnId).toBe('rui');
    expect(state.hands.ana).toBeUndefined();

    const ana = liars.playerView(state, 'ana');
    expect(ana.alive).toBe(false);
    expect(ana.hand).toEqual([]);
    expect(liars.hostView(state).aliveIds).toEqual(['rui', 'eva']);
  });

  it('ends when one player is left, with the winner on top', () => {
    let state = call(
      playCards(table({ ana: [Q(1)], rui: [K(2)], eva: [K(3)] }, lastLife), 'ana', 1),
      'rui',
    );
    state = { ...timeUp(state), phase: 'turn', tableRank: 'K', turnId: 'rui' };
    state = {
      ...state,
      hands: { rui: [Q(4)], eva: [K(5)] },
    };
    state = timeUp(call(playCards(state, 'rui', 4), 'eva'));

    expect(state.phase).toBe('finished');
    expect(liars.isOver(state)).toBe(true);
    const host = liars.hostView(state);
    expect(host.winnerId).toBe('eva');
    expect(host.leaderboard.map((entry) => entry.playerId)).toEqual(['eva', 'rui', 'ana']);
    expect(liars.playerView(state, 'eva').rank).toBe(1);
    expect(liars.playerView(state, 'ana').rank).toBe(3);
  });
});
