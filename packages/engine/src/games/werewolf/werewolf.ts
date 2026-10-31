import {
  werewolfRoleCounts,
  type WerewolfDawn,
  type WerewolfHostView,
  type WerewolfPhase,
  type WerewolfPlayerView,
  type WerewolfRole,
  type WerewolfSeerResult,
  type WerewolfTeam,
  type WerewolfVerdict,
  type WerewolfVote,
} from '@couchwave/shared';
import type { GameModule } from '../../game.js';
import { shuffle } from '../../random.js';

export interface WerewolfSettings {
  /** Everyone's secret role, dealt by `dealRoles`. */
  roles: Record<string, WerewolfRole>;
  /** Show the role of whoever dies straight away. */
  revealRoles: boolean;
  rolesMs: number;
  nightMs: number;
  dawnMs: number;
  dayMs: number;
  voteMs: number;
  verdictMs: number;
}

export type WerewolfInput =
  /** At night, who you pick; by day, your vote (null skips). */
  | { type: 'pick'; targetId: string | null }
  /** "Got it" on your role, or "let's vote" during the day. */
  | { type: 'ready' };

export interface WerewolfState {
  settings: WerewolfSettings;
  playerIds: string[];
  phase: WerewolfPhase;
  /** 1-based night (and the day after it). */
  round: number;
  endsAt: number | null;
  aliveIds: string[];
  readyIds: string[];
  /** Tonight's picks, or today's votes (null: a skip). */
  picks: Record<string, string | null>;
  /** Who the doctor protected last night: they can't pick them again tonight. */
  lastProtectedId: string | null;
  seerResults: WerewolfSeerResult[];
  dawn: WerewolfDawn | null;
  verdict: WerewolfVerdict | null;
  winner: WerewolfTeam | null;
}

/** Deals the roles for `werewolfRoleCounts` at random. */
export function dealRoles(
  playerIds: readonly string[],
  random: () => number,
): Record<string, WerewolfRole> {
  const counts = werewolfRoleCounts(playerIds.length);
  const deck = (Object.keys(counts) as WerewolfRole[]).flatMap((role) =>
    Array.from({ length: counts[role] }, () => role),
  );
  const seats = shuffle(playerIds, random);
  return Object.fromEntries(seats.map((id, i) => [id, deck[i] ?? 'villager']));
}

const roleOf = (state: WerewolfState, playerId: string): WerewolfRole =>
  state.settings.roles[playerId] ?? 'villager';

const isWolf = (state: WerewolfState, playerId: string) => roleOf(state, playerId) === 'werewolf';

const livingWolves = (state: WerewolfState) => state.aliveIds.filter((id) => isWolf(state, id));

/** Wolves win once they're as many as everyone else; the village once they're all gone. */
function winnerOf(state: WerewolfState): WerewolfTeam | null {
  const wolves = livingWolves(state).length;
  if (wolves === 0) return 'village';
  return wolves >= state.aliveIds.length - wolves ? 'wolves' : null;
}

/** Who `playerId` may pick right now. */
function targetsOf(state: WerewolfState, playerId: string): string[] {
  if (!state.aliveIds.includes(playerId)) return [];
  const others = state.aliveIds.filter((id) => id !== playerId);
  if (state.phase === 'vote') return others;
  if (state.phase !== 'night') return [];

  switch (roleOf(state, playerId)) {
    case 'werewolf':
      return state.aliveIds.filter((id) => !isWolf(state, id));
    case 'seer': {
      const seen = new Set(state.seerResults.map((result) => result.targetId));
      return others.filter((id) => !seen.has(id));
    }
    case 'doctor':
      return state.aliveIds.filter((id) => id !== state.lastProtectedId);
    case 'villager':
      return others;
  }
}

/** The one target with the most votes, or null on a tie. `null` votes are skips. */
function plurality(votes: readonly (string | null)[]): string | null {
  const tally = new Map<string | null, number>();
  for (const vote of votes) tally.set(vote, (tally.get(vote) ?? 0) + 1);
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (!top || (second && second[1] === top[1])) return null;
  return top[0];
}

function startPhase(state: WerewolfState, phase: WerewolfPhase, now: number): WerewolfState {
  const { rolesMs, nightMs, dawnMs, dayMs, voteMs, verdictMs } = state.settings;
  const ms = {
    roles: rolesMs,
    night: nightMs,
    dawn: dawnMs,
    day: dayMs,
    vote: voteMs,
    verdict: verdictMs,
  };
  return {
    ...state,
    phase,
    endsAt: phase === 'finished' ? null : now + ms[phase],
    readyIds: [],
    picks: {},
  };
}

function kill(state: WerewolfState, playerId: string | null): WerewolfState {
  return playerId ? { ...state, aliveIds: state.aliveIds.filter((id) => id !== playerId) } : state;
}

const revealed = (state: WerewolfState, playerId: string | null) =>
  playerId && state.settings.revealRoles ? roleOf(state, playerId) : null;

/** Morning: the werewolves' victim dies, unless the doctor protected them. */
function endNight(state: WerewolfState, now: number): WerewolfState {
  const pack = livingWolves(state);
  const chosen = plurality(pack.flatMap((id) => state.picks[id] ?? []));
  const doctor = state.aliveIds.find((id) => roleOf(state, id) === 'doctor');
  const protectedId = doctor ? (state.picks[doctor] ?? null) : null;

  const outcome = !chosen ? 'undecided' : chosen === protectedId ? 'saved' : 'killed';
  const victimId = outcome === 'killed' ? chosen : null;
  const next = kill({ ...state, lastProtectedId: protectedId }, victimId);
  return startPhase(
    { ...next, dawn: { outcome, victimId, role: revealed(state, victimId) }, verdict: null },
    'dawn',
    now,
  );
}

/** Whoever gets the most votes is out; a tie, or most people skipping, saves everyone. */
function endVote(state: WerewolfState, now: number): WerewolfState {
  const votes: WerewolfVote[] = state.aliveIds.flatMap((voterId) =>
    voterId in state.picks ? [{ voterId, targetId: state.picks[voterId] ?? null }] : [],
  );
  const eliminatedId = plurality(votes.map((vote) => vote.targetId));
  const next = kill(state, eliminatedId);
  return startPhase(
    { ...next, verdict: { votes, eliminatedId, role: revealed(state, eliminatedId) } },
    'verdict',
    now,
  );
}

/** After a death is shown: the game ends if a team has won, or moves on. */
function afterDeath(state: WerewolfState, then: 'day' | 'night', now: number): WerewolfState {
  const winner = winnerOf(state);
  if (winner) return { ...startPhase(state, 'finished', now), winner };
  return then === 'night'
    ? startPhase({ ...state, round: state.round + 1, dawn: null, verdict: null }, 'night', now)
    : startPhase(state, 'day', now);
}

/** Everyone who can pick tonight has (a seer who has seen everyone can't). */
const everyonePicked = (state: WerewolfState) =>
  state.aliveIds.every((id) => state.picks[id] != null || targetsOf(state, id).length === 0);

/** The night ends early once everyone has picked and the werewolves agree. */
function nightDone(state: WerewolfState): boolean {
  if (!everyonePicked(state)) return false;
  return new Set(livingWolves(state).map((id) => state.picks[id])).size <= 1;
}

function pick(state: WerewolfState, playerId: string, targetId: string | null, now: number) {
  if (state.phase !== 'night' && state.phase !== 'vote') return state;
  if (targetId === null ? state.phase !== 'vote' : !targetsOf(state, playerId).includes(targetId)) {
    return state;
  }
  // The seer sees the answer straight away, so they can't look again
  if (roleOf(state, playerId) === 'seer' && state.phase === 'night' && state.picks[playerId]) {
    return state;
  }
  if (playerId in state.picks && state.picks[playerId] === targetId) return state;

  let next: WerewolfState = { ...state, picks: { ...state.picks, [playerId]: targetId } };
  if (state.phase === 'night' && targetId && roleOf(state, playerId) === 'seer') {
    next = {
      ...next,
      seerResults: [
        ...state.seerResults,
        { targetId, isWerewolf: isWolf(state, targetId), night: state.round },
      ],
    };
  }

  if (state.phase === 'night') return nightDone(next) ? endNight(next, now) : next;
  return next.aliveIds.every((id) => id in next.picks) ? endVote(next, now) : next;
}

function ready(state: WerewolfState, playerId: string, now: number): WerewolfState {
  if (state.phase !== 'roles' && state.phase !== 'day') return state;
  if (!state.aliveIds.includes(playerId) || state.readyIds.includes(playerId)) return state;

  const next = { ...state, readyIds: [...state.readyIds, playerId] };
  if (!next.aliveIds.every((id) => next.readyIds.includes(id))) return next;
  return startPhase(next, state.phase === 'roles' ? 'night' : 'vote', now);
}

/** The roles seen so far: the dead (when roles are revealed), and everyone at the end. */
function knownRoles(state: WerewolfState): Record<string, WerewolfRole> {
  const shown =
    state.phase === 'finished'
      ? state.playerIds
      : state.settings.revealRoles
        ? state.playerIds.filter((id) => !state.aliveIds.includes(id))
        : [];
  return Object.fromEntries(shown.map((id) => [id, roleOf(state, id)]));
}

export const werewolf: GameModule<
  WerewolfState,
  WerewolfInput,
  WerewolfSettings,
  WerewolfHostView,
  WerewolfPlayerView
> = {
  id: 'werewolf',
  name: 'Werewolf',
  minPlayers: 4,

  init(playerIds, settings, now) {
    if (!playerIds.some((id) => settings.roles[id] === 'werewolf')) {
      throw new Error('Werewolf needs at least one werewolf');
    }
    return startPhase(
      {
        settings,
        playerIds,
        phase: 'roles',
        round: 1,
        endsAt: null,
        aliveIds: [...playerIds],
        readyIds: [],
        picks: {},
        lastProtectedId: null,
        seerResults: [],
        dawn: null,
        verdict: null,
        winner: null,
      },
      'roles',
      now,
    );
  },

  onInput(state, playerId, input, now) {
    if (!state.aliveIds.includes(playerId)) return state;
    return input.type === 'pick'
      ? pick(state, playerId, input.targetId, now)
      : ready(state, playerId, now);
  },

  onTick(state, now) {
    if (state.endsAt === null || now < state.endsAt) return state;
    switch (state.phase) {
      case 'roles':
        return startPhase(state, 'night', now);
      case 'night':
        return endNight(state, now);
      case 'dawn':
        return afterDeath(state, 'day', now);
      case 'day':
        return startPhase(state, 'vote', now);
      case 'vote':
        return endVote(state, now);
      case 'verdict':
        return afterDeath(state, 'night', now);
      case 'finished':
        return state;
    }
  },

  isOver: (state) => state.phase === 'finished',

  hostView(state) {
    return {
      game: 'werewolf',
      phase: state.phase,
      round: state.round,
      endsAt: state.endsAt,
      playerIds: state.playerIds,
      aliveIds: state.aliveIds,
      readyIds: state.readyIds,
      votedIds: state.phase === 'vote' ? Object.keys(state.picks) : [],
      nightDoneCount:
        state.phase === 'night' ? state.aliveIds.filter((id) => state.picks[id] != null).length : 0,
      roleCounts: werewolfRoleCounts(state.playerIds.length),
      knownRoles: knownRoles(state),
      dawn: state.dawn,
      verdict: state.verdict,
      winner: state.winner,
    };
  },

  playerView(state, playerId) {
    const role = roleOf(state, playerId);
    const alive = state.aliveIds.includes(playerId);
    const wolf = role === 'werewolf';
    // The dead can't give anything away by tapping, so they see everything
    const everyRole = !alive || state.phase === 'finished';
    return {
      game: 'werewolf',
      phase: state.phase,
      round: state.round,
      endsAt: state.endsAt,
      role,
      alive,
      playerIds: state.playerIds,
      aliveIds: state.aliveIds,
      ready: state.readyIds.includes(playerId),
      readyCount: state.readyIds.length,
      myPick: state.picks[playerId] ?? null,
      voted: state.phase === 'vote' && playerId in state.picks,
      targets: targetsOf(state, playerId),
      packIds: wolf ? state.playerIds.filter((id) => id !== playerId && isWolf(state, id)) : [],
      packPicks:
        wolf && state.phase === 'night'
          ? livingWolves(state).flatMap((voterId) => {
              const targetId = state.picks[voterId];
              return targetId ? [{ voterId, targetId }] : [];
            })
          : [],
      seerResults: role === 'seer' ? state.seerResults : [],
      knownRoles: everyRole
        ? Object.fromEntries(state.playerIds.map((id) => [id, roleOf(state, id)]))
        : knownRoles(state),
      dawn: state.dawn,
      verdict: state.verdict,
      winner: state.winner,
    };
  },
};
