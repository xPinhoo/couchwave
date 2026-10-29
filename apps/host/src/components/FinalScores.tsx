import type { LeaderboardEntry, PublicPlayer } from '@couchwave/shared';
import { PlayerAvatar } from './PlayerAvatar';
import { PlayerTag, type PlayerLookup } from './PlayerTag';

/** Second, first and third place, in that order, so the winner stands in the middle. */
const PODIUM_ORDER = [1, 0, 2];

interface FinalScoresProps {
  leaderboard: LeaderboardEntry[];
  players: PublicPlayer[];
  leaderId: string | null;
}

/** The end of any game: a podium for the top three, then everyone else. */
export function FinalScores({ leaderboard, players, leaderId }: FinalScoresProps) {
  const playerOf: PlayerLookup = (id) => players.find((p) => p.id === id);
  const leader = leaderId ? (playerOf(leaderId)?.name ?? null) : null;
  const top = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <main className="final">
      <p className="eyebrow">Final scores</p>

      <ol className="podium" aria-label="Podium">
        {PODIUM_ORDER.map((place) => {
          const entry = top[place];
          if (!entry) return null;
          const player = playerOf(entry.playerId);
          return (
            <li key={entry.playerId} className={`step place-${place + 1}`}>
              {player && <PlayerAvatar avatar={player.avatar} size={place === 0 ? 96 : 72} />}
              <span className="podium-name">{player?.name ?? 'Player'}</span>
              <span className="score">{entry.score}</span>
              <span className="block" aria-label={`Place ${place + 1}`}>
                {place === 0 ? '🏆' : place + 1}
              </span>
            </li>
          );
        })}
      </ol>

      {rest.length > 0 && (
        <ol className="rest" start={4} aria-label="Everyone else">
          {rest.map((entry, i) => (
            <li key={entry.playerId}>
              <span className="place">{i + 4}</span>
              <PlayerTag player={playerOf(entry.playerId)} />
              <span className="score">{entry.score}</span>
            </li>
          ))}
        </ol>
      )}

      {leader && <p className="hint">{leader} can play again or pick another game</p>}
    </main>
  );
}
