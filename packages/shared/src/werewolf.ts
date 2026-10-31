/**
 * Werewolf: everyone gets a secret role on their phone. At night the werewolves pick
 * someone to eat, the seer looks into a player and the doctor protects one. By day the
 * village talks it over and votes someone out. The TV is the narrator.
 */

export const WEREWOLF_ROLES = [
  {
    id: 'werewolf',
    name: 'Werewolf',
    emoji: '🐺',
    team: 'wolves',
    goal: 'Each night, pick a villager to eat with the other werewolves. By day, blend in.',
  },
  {
    id: 'seer',
    name: 'Seer',
    emoji: '🔮',
    team: 'village',
    goal: 'Each night, look into one player and find out if they are a werewolf.',
  },
  {
    id: 'doctor',
    name: 'Doctor',
    emoji: '💉',
    team: 'village',
    goal: 'Each night, protect one player from the werewolves. Not the same one twice in a row.',
  },
  {
    id: 'villager',
    name: 'Villager',
    emoji: '🧑‍🌾',
    team: 'village',
    goal: 'Find the werewolves and vote them out before they eat everyone.',
  },
] as const;

export type WerewolfRole = (typeof WEREWOLF_ROLES)[number]['id'];
export type WerewolfTeam = (typeof WEREWOLF_ROLES)[number]['team'];

export function werewolfRole(id: WerewolfRole) {
  return WEREWOLF_ROLES.find((role) => role.id === id) ?? WEREWOLF_ROLES[3];
}

/** How many of each role a game of `players` has. */
export function werewolfRoleCounts(players: number): Record<WerewolfRole, number> {
  const werewolf = players >= 9 ? 3 : players >= 6 ? 2 : 1;
  const doctor = players >= 5 ? 1 : 0;
  return { werewolf, seer: 1, doctor, villager: Math.max(0, players - werewolf - 1 - doctor) };
}

export const WEREWOLF_DISCUSS_OPTIONS = [60, 120, 180, 300] as const;

export interface WerewolfOptions {
  /** How long the village talks before the vote. */
  secondsToDiscuss: (typeof WEREWOLF_DISCUSS_OPTIONS)[number];
  /** Show the role of whoever dies; otherwise roles stay secret until the end. */
  revealRoles: boolean;
}

export const DEFAULT_WEREWOLF_OPTIONS: WerewolfOptions = {
  secondsToDiscuss: 120,
  revealRoles: true,
};

/**
 * roles: everyone checks their secret role · night: everyone picks someone on their phone
 * (villagers too, so nobody can tell who's who by who's tapping) · dawn: who died ·
 * day: the village talks · vote: everyone votes · verdict: who's out · finished: a team won
 */
export type WerewolfPhase = 'roles' | 'night' | 'dawn' | 'day' | 'vote' | 'verdict' | 'finished';

/** killed: the werewolves got someone · saved: the doctor got there first · undecided: the werewolves didn't agree */
export type WerewolfNightOutcome = 'killed' | 'saved' | 'undecided';

export interface WerewolfDawn {
  outcome: WerewolfNightOutcome;
  victimId: string | null;
  /** The victim's role, when roles are revealed on death. */
  role: WerewolfRole | null;
}

export interface WerewolfVote {
  voterId: string;
  /** null: they voted to skip. */
  targetId: string | null;
}

export interface WerewolfVerdict {
  votes: WerewolfVote[];
  /** null on a tie, or when skipping won. */
  eliminatedId: string | null;
  role: WerewolfRole | null;
}

export interface WerewolfSeerResult {
  targetId: string;
  isWerewolf: boolean;
  /** 1-based night. */
  night: number;
}

export interface WerewolfHostView {
  game: 'werewolf';
  phase: WerewolfPhase;
  /** 1-based; a night and the day after it share a number. */
  round: number;
  endsAt: number | null;
  playerIds: string[];
  aliveIds: string[];
  /** Who confirmed their role (roles), or wants to vote now (day). */
  readyIds: string[];
  /** Who has voted (not whom), during the vote. */
  votedIds: string[];
  /** How many living players have picked someone tonight (not who, or whom). */
  nightDoneCount: number;
  roleCounts: Record<WerewolfRole, number>;
  /** Roles shown so far: the dead when roles are revealed, everyone at the end. */
  knownRoles: Record<string, WerewolfRole>;
  dawn: WerewolfDawn | null;
  verdict: WerewolfVerdict | null;
  winner: WerewolfTeam | null;
}

export interface WerewolfPlayerView {
  game: 'werewolf';
  phase: WerewolfPhase;
  round: number;
  endsAt: number | null;
  role: WerewolfRole;
  alive: boolean;
  playerIds: string[];
  aliveIds: string[];
  /** You confirmed your role, or want to vote now. */
  ready: boolean;
  readyCount: number;
  /** Your pick this night, or your vote (null: none yet, or a skip once `voted`). */
  myPick: string | null;
  voted: boolean;
  /** Who you can pick right now (empty when there's nothing to pick). */
  targets: string[];
  /** Werewolves: the other werewolves. */
  packIds: string[];
  /** Werewolves at night: what the pack has picked so far. */
  packPicks: WerewolfVote[];
  /** The seer: everyone they've looked into. */
  seerResults: WerewolfSeerResult[];
  /** The dead and, at the end, everyone: every role. Otherwise what the TV knows. */
  knownRoles: Record<string, WerewolfRole>;
  dawn: WerewolfDawn | null;
  verdict: WerewolfVerdict | null;
  winner: WerewolfTeam | null;
}
