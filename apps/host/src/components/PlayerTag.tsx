import type { PublicPlayer } from '@couchwave/shared';
import { PlayerAvatar } from './PlayerAvatar';

export type PlayerLookup = (id: string) => PublicPlayer | undefined;

/** Avatar and name; players who left mid-game show as a plain "Player". */
export function PlayerTag({
  player,
  size = 32,
}: {
  player: PublicPlayer | undefined;
  size?: number;
}) {
  return (
    <span className="player-tag">
      {player && <PlayerAvatar avatar={player.avatar} size={size} />}
      {player?.name ?? 'Player'}
    </span>
  );
}

/** "+850" in green, "−250" in red. */
export function Gained({ points }: { points: number }) {
  if (points === 0) return null;
  return (
    <span className={points > 0 ? 'gained' : 'lost'}>
      {' '}
      {points > 0 ? `+${points}` : `−${Math.abs(points)}`}
    </span>
  );
}
