import { werewolfRoleCounts, type WerewolfRole } from '@couchwave/shared';
import { describe, expect, it } from 'vitest';
import {
  dealRoles,
  werewolf,
  type WerewolfInput,
  type WerewolfSettings,
  type WerewolfState,
} from './werewolf.js';

/** A seeded pseudo-random generator, so deals are random but repeatable. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
    return seed / 2 ** 31;
  };
}

const ROLES: Record<string, WerewolfRole> = {
  wolf: 'werewolf',
  seer: 'seer',
  doc: 'doctor',
  ana: 'villager',
  rui: 'villager',
};
const players = Object.keys(ROLES);

function settings(change: Partial<WerewolfSettings> = {}): WerewolfSettings {
  return {
    roles: ROLES,
    revealRoles: true,
    rolesMs: 20_000,
    nightMs: 40_000,
    dawnMs: 8_000,
    dayMs: 120_000,
    voteMs: 30_000,
    verdictMs: 8_000,
    ...change,
  };
}

const act = (state: WerewolfState, playerId: string, input: WerewolfInput) =>
  werewolf.onInput(state, playerId, input, 0);
const pick = (state: WerewolfState, playerId: string, targetId: string | null) =>
  act(state, playerId, { type: 'pick', targetId });

/** Everyone confirms their role: the first night starts. */
function toNight(change: Partial<WerewolfSettings> = {}) {
  const state = werewolf.init(players, settings(change), 0);
  return state.playerIds.reduce((next, id) => act(next, id, { type: 'ready' }), state);
}

/** Plays tonight's picks, in order. */
function night(state: WerewolfState, picks: Record<string, string>) {
  return Object.entries(picks).reduce((next, [id, target]) => pick(next, id, target), state);
}

/** Lets the current phase's timer run out. */
const timeUp = (state: WerewolfState) => werewolf.onTick(state, state.endsAt!);

describe('dealRoles', () => {
  it.each([4, 5, 6, 8])('deals the right roles to %i players', (count) => {
    const ids = Array.from({ length: count }, (_, i) => `p${i}`);
    const roles = dealRoles(ids, seeded(count));
    const counts = werewolfRoleCounts(count);

    expect(Object.keys(roles).sort()).toEqual([...ids].sort());
    for (const role of Object.keys(counts) as WerewolfRole[]) {
      expect(Object.values(roles).filter((r) => r === role)).toHaveLength(counts[role]);
    }
  });

  it("doesn't always make the same player the werewolf", () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const wolves = new Set(
      [1, 2, 3, 4, 5, 6].map(
        (seed) =>
          Object.entries(dealRoles(ids, seeded(seed))).find(([, r]) => r === 'werewolf')![0],
      ),
    );
    expect(wolves.size).toBeGreaterThan(1);
  });
});

describe('Werewolf', () => {
  it('starts on the roles, and moves to the night once everyone has seen theirs', () => {
    const state = werewolf.init(players, settings(), 0);
    expect(state.phase).toBe('roles');
    expect(state.endsAt).toBe(20_000);

    const almost = players
      .slice(0, -1)
      .reduce((next, id) => act(next, id, { type: 'ready' }), state);
    expect(almost.phase).toBe('roles');
    expect(werewolf.hostView(almost).readyIds).toHaveLength(4);
    expect(act(almost, 'rui', { type: 'ready' }).phase).toBe('night');
    // Or the timer runs out
    expect(timeUp(state).phase).toBe('night');
  });

  it('keeps every role secret: phones only know their own, the TV none', () => {
    const state = toNight();
    expect(werewolf.hostView(state).knownRoles).toEqual({});

    const villager = werewolf.playerView(state, 'ana');
    expect(villager.role).toBe('villager');
    expect(villager.knownRoles).toEqual({});
    expect(villager.packIds).toEqual([]);
    expect(werewolf.playerView(state, 'seer').seerResults).toEqual([]);
  });

  it('gives everyone something to pick at night, so nobody stands out', () => {
    const state = toNight();
    expect(werewolf.playerView(state, 'wolf').targets).toEqual(['seer', 'doc', 'ana', 'rui']);
    expect(werewolf.playerView(state, 'seer').targets).toEqual(['wolf', 'doc', 'ana', 'rui']);
    // The doctor may protect themselves
    expect(werewolf.playerView(state, 'doc').targets).toEqual(players);
    expect(werewolf.playerView(state, 'ana').targets).toEqual(['wolf', 'seer', 'doc', 'rui']);
    // Werewolves can't eat each other; nobody can pick nobody at night
    expect(pick(state, 'wolf', 'wolf')).toBe(state);
    expect(pick(state, 'ana', null)).toBe(state);
  });

  it('kills the werewolves’ victim at dawn, and shows their role', () => {
    const state = night(toNight(), { wolf: 'ana', seer: 'wolf', doc: 'doc', ana: 'rui' });
    expect(state.phase).toBe('night');
    const dawn = pick(state, 'rui', 'wolf');

    expect(dawn.phase).toBe('dawn');
    expect(dawn.aliveIds).not.toContain('ana');
    expect(werewolf.hostView(dawn).dawn).toEqual({
      outcome: 'killed',
      victimId: 'ana',
      role: 'villager',
    });
    expect(werewolf.hostView(dawn).knownRoles).toEqual({ ana: 'villager' });
    // The dead see everyone's role
    expect(werewolf.playerView(dawn, 'ana').knownRoles).toEqual(ROLES);
    expect(werewolf.playerView(dawn, 'ana').alive).toBe(false);
  });

  it('keeps the dead’s role secret when roles aren’t revealed', () => {
    const dawn = night(toNight({ revealRoles: false }), {
      wolf: 'ana',
      seer: 'wolf',
      doc: 'doc',
      ana: 'rui',
      rui: 'wolf',
    });
    expect(werewolf.hostView(dawn).dawn?.role).toBeNull();
    expect(werewolf.hostView(dawn).knownRoles).toEqual({});
  });

  it('saves the victim when the doctor protected them, and not twice in a row', () => {
    const dawn = night(toNight(), {
      wolf: 'ana',
      seer: 'wolf',
      doc: 'ana',
      ana: 'rui',
      rui: 'wolf',
    });
    expect(werewolf.hostView(dawn).dawn).toEqual({ outcome: 'saved', victimId: null, role: null });
    expect(dawn.aliveIds).toContain('ana');

    const nextNight = timeUp(timeUp(timeUp(timeUp(dawn))));
    expect(nextNight.phase).toBe('night');
    expect(nextNight.round).toBe(2);
    expect(werewolf.playerView(nextNight, 'doc').targets).not.toContain('ana');
  });

  it('shows the seer the truth straight away, and only once per night', () => {
    let state = pick(toNight(), 'seer', 'wolf');
    expect(werewolf.playerView(state, 'seer').seerResults).toEqual([
      { targetId: 'wolf', isWerewolf: true, night: 1 },
    ]);
    expect(pick(state, 'seer', 'ana')).toBe(state);
    // Nobody else learns anything
    expect(werewolf.playerView(state, 'ana').seerResults).toEqual([]);

    state = night(state, { wolf: 'rui', doc: 'doc', ana: 'rui', rui: 'ana' });
    expect(state.phase).toBe('dawn');
  });

  it('lets the werewolves see each other and their picks', () => {
    const roles = { ...ROLES, ana: 'werewolf' as const };
    const state = pick(toNight({ roles }), 'wolf', 'rui');
    const view = werewolf.playerView(state, 'ana');
    expect(view.packIds).toEqual(['wolf']);
    expect(view.packPicks).toEqual([{ voterId: 'wolf', targetId: 'rui' }]);
    // Villagers see no pack
    expect(werewolf.playerView(state, 'rui').packPicks).toEqual([]);
  });

  it('waits for the werewolves to agree, and kills nobody if they never do', () => {
    const roles = { ...ROLES, ana: 'werewolf' as const };
    const state = night(toNight({ roles }), {
      wolf: 'rui',
      ana: 'seer',
      seer: 'wolf',
      doc: 'doc',
      rui: 'wolf',
    });
    expect(state.phase).toBe('night');
    expect(werewolf.hostView(state).nightDoneCount).toBe(5);

    expect(timeUp(state).dawn).toEqual({ outcome: 'undecided', victimId: null, role: null });
    // Changing a pick to agree ends the night
    expect(pick(state, 'ana', 'rui').dawn?.victimId).toBe('rui');
  });

  it('kills whoever the most werewolves picked when time runs out', () => {
    const state = pick(toNight(), 'wolf', 'seer');
    expect(timeUp(state).dawn?.victimId).toBe('seer');
  });

  it('goes from dawn to the day, then to the vote when time is up or everyone is ready', () => {
    const dawn = night(toNight(), {
      wolf: 'ana',
      seer: 'wolf',
      doc: 'doc',
      ana: 'rui',
      rui: 'wolf',
    });
    const day = timeUp(dawn);
    expect(day.phase).toBe('day');
    expect(day.endsAt).toBe(dawn.endsAt! + 120_000);
    expect(timeUp(day).phase).toBe('vote');

    // The dead can't hurry the living
    const ready = ['wolf', 'seer', 'doc'].reduce(
      (next, id) => act(next, id, { type: 'ready' }),
      day,
    );
    expect(act(ready, 'ana', { type: 'ready' })).toBe(ready);
    expect(act(ready, 'rui', { type: 'ready' }).phase).toBe('vote');
  });

  /** Night 1: the wolf eats Ana. Then everyone gets to the vote. */
  function toVote() {
    const dawn = night(toNight(), {
      wolf: 'ana',
      seer: 'wolf',
      doc: 'doc',
      ana: 'rui',
      rui: 'wolf',
    });
    return timeUp(timeUp(dawn));
  }

  it('votes out whoever gets the most votes, and the village wins when the werewolf is out', () => {
    let vote = toVote();
    expect(werewolf.playerView(vote, 'seer').targets).toEqual(['wolf', 'doc', 'rui']);
    vote = pick(vote, 'seer', 'wolf');
    vote = pick(vote, 'doc', 'wolf');
    vote = pick(vote, 'wolf', 'rui');
    expect(werewolf.hostView(vote).votedIds).toEqual(['seer', 'doc', 'wolf']);
    expect(werewolf.playerView(vote, 'seer')).toMatchObject({ voted: true, myPick: 'wolf' });

    const verdict = pick(vote, 'rui', 'wolf');
    expect(verdict.phase).toBe('verdict');
    expect(werewolf.hostView(verdict).verdict).toEqual({
      votes: [
        { voterId: 'wolf', targetId: 'rui' },
        { voterId: 'seer', targetId: 'wolf' },
        { voterId: 'doc', targetId: 'wolf' },
        { voterId: 'rui', targetId: 'wolf' },
      ],
      eliminatedId: 'wolf',
      role: 'werewolf',
    });

    const end = timeUp(verdict);
    expect(end.phase).toBe('finished');
    expect(end.winner).toBe('village');
    expect(werewolf.isOver(end)).toBe(true);
    expect(werewolf.hostView(end).knownRoles).toEqual(ROLES);
  });

  it('saves everyone on a tie or when skipping wins', () => {
    const vote = toVote();
    const tie = [
      ['seer', 'wolf'],
      ['doc', 'rui'],
      ['wolf', null],
      ['rui', null],
    ] as const;
    const verdict = tie.reduce((next, [id, target]) => pick(next, id, target), vote);
    expect(verdict.verdict?.eliminatedId).toBeNull();

    // Then the next night starts
    const next = timeUp(verdict);
    expect(next.phase).toBe('night');
    expect(next.round).toBe(2);
    expect(next.aliveIds).toHaveLength(4);
  });

  it('counts only the votes cast when time runs out', () => {
    const vote = pick(toVote(), 'seer', 'doc');
    expect(timeUp(vote).verdict?.eliminatedId).toBe('doc');
  });

  it('lets the werewolves win once they are as many as everyone else', () => {
    // 4 players: the wolf eats one, the village votes out a villager: 1 wolf vs 1
    const roles: Record<string, WerewolfRole> = {
      wolf: 'werewolf',
      seer: 'seer',
      ana: 'villager',
      rui: 'villager',
    };
    const ids = Object.keys(roles);
    let state = werewolf.init(ids, settings({ roles }), 0);
    state = timeUp(state);
    state = night(state, { wolf: 'seer', seer: 'ana', ana: 'rui', rui: 'ana' });
    state = timeUp(timeUp(state));
    expect(state.phase).toBe('vote');
    state = ['wolf', 'ana', 'rui'].reduce(
      (next, id) => pick(next, id, id === 'ana' ? 'rui' : 'ana'),
      state,
    );
    expect(state.verdict?.eliminatedId).toBe('ana');

    const end = timeUp(state);
    expect(end.winner).toBe('wolves');
    expect(end.phase).toBe('finished');
  });

  it('ignores the dead, and players outside the game', () => {
    const dawn = night(toNight(), {
      wolf: 'ana',
      seer: 'wolf',
      doc: 'doc',
      ana: 'rui',
      rui: 'wolf',
    });
    const vote = timeUp(timeUp(dawn));
    expect(pick(vote, 'ana', 'wolf')).toBe(vote);
    expect(pick(vote, 'nobody', 'wolf')).toBe(vote);
    // Nor can anyone vote for the dead, or themselves
    expect(pick(vote, 'seer', 'ana')).toBe(vote);
    expect(pick(vote, 'seer', 'seer')).toBe(vote);
  });
});
