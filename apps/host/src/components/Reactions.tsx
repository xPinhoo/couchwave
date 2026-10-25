import type { PublicPlayer } from '@couchwave/shared';
import type { CSSProperties } from 'react';
import type { FloatingReaction } from '../useHostRoom';
import { PlayerAvatar } from './PlayerAvatar';

interface ReactionsProps {
  reactions: FloatingReaction[];
  players: PublicPlayer[];
}

/** Spreads reactions across the screen without randomness, so renders are stable. */
const horizontalPosition = (key: number) => `${8 + ((key * 37) % 84)}%`;

/** Emoji players send from their phones, floating up the TV with their avatar. */
export function Reactions({ reactions, players }: ReactionsProps) {
  return (
    <div className="reactions" aria-live="polite">
      {reactions.map((reaction) => {
        const player = players.find((p) => p.id === reaction.playerId);
        return (
          <div
            key={reaction.key}
            className="reaction"
            style={{ left: horizontalPosition(reaction.key) } as CSSProperties}
          >
            <span className="reaction-emoji">{reaction.emoji}</span>
            {player && <PlayerAvatar avatar={player.avatar} size={36} />}
            {player && <span className="visually-hidden">{player.name} sent </span>}
          </div>
        );
      })}
    </div>
  );
}
