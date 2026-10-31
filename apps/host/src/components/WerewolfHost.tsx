import {
  WEREWOLF_ROLES,
  werewolfRole,
  type LobbyState,
  type WerewolfDawn,
  type WerewolfHostView,
  type WerewolfRole,
  type WerewolfVerdict,
} from '@couchwave/shared';
import type { ReactNode } from 'react';
import type { HostGame } from '../useHostRoom';
import { useCountdownTicks } from '../sound';
import { useCountdown } from '../useCountdown';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerTag, type PlayerLookup } from './PlayerTag';

const TIMED = new Set(['roles', 'night', 'day', 'vote']);

/** Werewolf on the TV: the narrator. It never shows a secret, only what the village knows. */
export function WerewolfHost({
  game,
  lobby,
}: {
  game: HostGame<WerewolfHostView>;
  lobby: LobbyState;
}) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  useCountdownTicks(msLeft, TIMED.has(view.phase));
  const playerOf: PlayerLookup = (id) => lobby.players.find((p) => p.id === id);
  const dark = view.phase === 'roles' || view.phase === 'night' || view.phase === 'finished';

  const header = (
    <header className="trivia-header">
      <span className="eyebrow">
        🐺 Werewolf
        {view.phase !== 'roles' && view.phase !== 'finished' && ` · ${dayName(view)}`}
      </span>
      {TIMED.has(view.phase) && (
        <span className="timer" aria-label="Seconds left">
          {Math.ceil(msLeft / 1000)}
        </span>
      )}
      <span className="eyebrow">Room {lobby.roomCode}</span>
    </header>
  );

  return (
    <main className={`wolf ${dark ? 'wolf-night' : 'wolf-day'}`}>
      {header}
      {/* Keyed so each phase fades in */}
      <section className="wolf-stage" key={`${view.phase}-${view.round}`}>
        <Stage view={view} playerOf={playerOf} />
      </section>
      <footer className="trivia-footer">
        <Village view={view} playerOf={playerOf} />
        <span className="hint">{progress(view)}</span>
      </footer>
    </main>
  );
}

const dayName = (view: WerewolfHostView) =>
  view.phase === 'night' ? `Night ${view.round}` : `Day ${view.round}`;

function progress(view: WerewolfHostView): string {
  const living = view.aliveIds.length;
  switch (view.phase) {
    case 'roles':
      return `${view.readyIds.length}/${living} have seen their role`;
    case 'night':
      return `${view.nightDoneCount}/${living} done`;
    case 'day':
      return `${view.readyIds.length}/${living} ready to vote`;
    case 'vote':
      return `${view.votedIds.length}/${living} voted`;
    default:
      return `${living} of ${view.playerIds.length} still alive`;
  }
}

function Stage({ view, playerOf }: { view: WerewolfHostView; playerOf: PlayerLookup }) {
  switch (view.phase) {
    case 'roles':
      return (
        <Announce emoji="🃏" title="Check your secret role">
          <p className="hint">On your phone, and don't let anyone see it!</p>
          <RoleCounts counts={view.roleCounts} />
        </Announce>
      );
    case 'night':
      return (
        <Announce emoji="🌕" title="Night falls on the village…">
          <p className="hint">
            Everyone, pick someone on your phone. The werewolves are choosing who to eat.
          </p>
        </Announce>
      );
    case 'dawn':
      return view.dawn ? <DawnNews dawn={view.dawn} playerOf={playerOf} /> : null;
    case 'day':
      return (
        <Announce emoji="☀️" title="Who is a werewolf?">
          <p className="hint">
            Talk it over. The vote starts when time is up, or everyone is ready.
          </p>
        </Announce>
      );
    case 'vote':
      return (
        <Announce emoji="🗳️" title="Time to vote!">
          <p className="hint">Vote on your phone for who to throw out of the village.</p>
        </Announce>
      );
    case 'verdict':
      return view.verdict ? <Verdict verdict={view.verdict} playerOf={playerOf} /> : null;
    case 'finished':
      return (
        <Announce
          emoji={view.winner === 'wolves' ? '🐺' : '🎉'}
          title={view.winner === 'wolves' ? 'The werewolves win!' : 'The village wins!'}
        >
          <p className="hint">
            {view.winner === 'wolves'
              ? 'They ate their way through the village.'
              : 'Every werewolf is gone.'}{' '}
            The host can play again from their phone.
          </p>
        </Announce>
      );
  }
}

function Announce({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="wolf-announce">
      <span className="wolf-emoji" aria-hidden="true">
        {emoji}
      </span>
      <h1>{title}</h1>
      {children}
    </div>
  );
}

function RoleCounts({ counts }: { counts: Record<WerewolfRole, number> }) {
  return (
    <ul className="wolf-roles" aria-label="Roles in this game">
      {WEREWOLF_ROLES.filter((role) => counts[role.id] > 0).map((role) => (
        <li key={role.id}>
          <span aria-hidden="true">{role.emoji}</span> {counts[role.id]} × {role.name}
        </li>
      ))}
    </ul>
  );
}

function RoleLine({ role }: { role: WerewolfRole | null }) {
  if (!role) return null;
  const { emoji, name } = werewolfRole(role);
  return (
    <p className="wolf-was">
      They were {role === 'werewolf' ? 'a' : 'the'}{' '}
      <strong>
        {emoji} {name}
      </strong>
    </p>
  );
}

function DawnNews({ dawn, playerOf }: { dawn: WerewolfDawn; playerOf: PlayerLookup }) {
  if (dawn.outcome !== 'killed' || !dawn.victimId) {
    return (
      <Announce emoji="🌅" title="Nobody died last night!">
        <p className="hint">
          {dawn.outcome === 'saved'
            ? 'The doctor got there just in time.'
            : "The werewolves couldn't agree on who to eat."}
        </p>
      </Announce>
    );
  }
  return (
    <Announce emoji="🌅" title="The village wakes up to bad news…">
      <p className="wolf-death">
        <PlayerTag player={playerOf(dawn.victimId)} size={72} /> was eaten by the werewolves.
      </p>
      <RoleLine role={dawn.role} />
    </Announce>
  );
}

function Verdict({ verdict, playerOf }: { verdict: WerewolfVerdict; playerOf: PlayerLookup }) {
  // Who got votes, most first; skips last
  const tally = new Map<string | null, string[]>();
  for (const vote of verdict.votes) {
    tally.set(vote.targetId, [...(tally.get(vote.targetId) ?? []), vote.voterId]);
  }
  const rows = [...tally.entries()].sort(
    (a, b) => Number(a[0] === null) - Number(b[0] === null) || b[1].length - a[1].length,
  );
  const out = verdict.eliminatedId;

  return (
    <div className="wolf-verdict">
      <h1>
        {out ? (
          <>
            <PlayerTag player={playerOf(out)} size={72} /> is out!
          </>
        ) : verdict.votes.length === 0 ? (
          'Nobody voted. Everyone stays.'
        ) : (
          'Nobody is out. Everyone stays… for now.'
        )}
      </h1>
      {out && <RoleLine role={verdict.role} />}
      <ul className="wolf-tally" aria-label="Votes">
        {rows.map(([targetId, voters]) => (
          <li key={targetId ?? 'skip'} className={targetId === out && out ? 'out' : undefined}>
            <span className="wolf-tally-target">
              {targetId ? <PlayerTag player={playerOf(targetId)} size={40} /> : '🤷 Skip'}
            </span>
            <span className="wolf-tally-count">{voters.length}</span>
            <span className="wolf-voters" aria-label="Voted by">
              {voters.map((id) => {
                const voter = playerOf(id);
                return voter ? (
                  <span key={id} title={voter.name}>
                    <PlayerAvatar avatar={voter.avatar} size={32} />
                  </span>
                ) : null;
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Everyone in the game: the dead greyed out, with their role once it's known. */
function Village({ view, playerOf }: { view: WerewolfHostView; playerOf: PlayerLookup }) {
  const ticked =
    view.phase === 'vote' ? view.votedIds : view.phase === 'night' ? [] : view.readyIds;
  return (
    <ul className="answered-row wolf-village" aria-label="The village">
      {view.playerIds.map((id) => {
        const player = playerOf(id);
        const alive = view.aliveIds.includes(id);
        const role = view.knownRoles[id];
        const done = ticked.includes(id);
        return (
          <li
            key={id}
            className={[alive ? 'answered' : 'dead', done && 'done'].filter(Boolean).join(' ')}
          >
            <span className="avatar-badge">
              {player && <PlayerAvatar avatar={player.avatar} size={64} />}
              {done && (
                <span className="check" aria-label="Done">
                  ✓
                </span>
              )}
              {!alive && (
                <span className="wolf-grave" aria-label="Dead">
                  💀
                </span>
              )}
            </span>
            <span>{player?.name ?? 'Player'}</span>
            {role && (
              <span className="wolf-role-tag">
                {werewolfRole(role).emoji} {werewolfRole(role).name}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
