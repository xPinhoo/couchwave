import {
  GAME_CATEGORIES,
  GAMES,
  focusedGame,
  gamesInCategory,
  type LobbyState,
  type PublicPlayer,
} from '@couchwave/shared';
import { useState } from 'react';
import { Logo } from './Logo';
import { PlayerAvatar } from './PlayerAvatar';

interface LibraryProps {
  lobby: LobbyState;
}

/**
 * The games menu, one category tab at a time. Every tab and game card is a position the leader
 * moves between with their phone, like a TV remote: OK on a tab shows its games, OK on a game
 * picks it.
 */
export function Library({ lobby }: LibraryProps) {
  const leader = lobby.players.find((p) => p.id === lobby.leaderId);
  const { category, focus } = lobby.library;
  const focused = focusedGame(lobby.library);

  return (
    <main className="library">
      <header className="library-nav">
        <div className="library-brand">
          <Logo size={40} />
          <p className="library-room">
            Room <strong aria-label="Room code">{lobby.roomCode}</strong>
          </p>
        </div>
        <NavPlayers players={lobby.players} leaderId={lobby.leaderId} />
      </header>

      <div className="library-body">
        <h1>Choose a game</h1>

        <ul className="category-tabs" aria-label="Categories">
          {GAME_CATEGORIES.map((tab, i) => {
            const isFocused = focus.area === 'tabs' && focus.index === i;
            return (
              <li
                key={tab.id}
                className={[i === category && 'shown', isFocused && 'focused']
                  .filter(Boolean)
                  .join(' ')}
                aria-current={isFocused ? 'true' : undefined}
              >
                <span aria-hidden="true">{tab.emoji}</span> {tab.name}
              </li>
            );
          })}
        </ul>

        <ol className="game-cards" aria-label="Games">
          {gamesInCategory(category).map((index) => {
            const game = GAMES[index]!;
            const selected = index === focused;
            return (
              <li
                key={game.id}
                className={['game-card', selected && 'selected', !game.available && 'unavailable']
                  .filter(Boolean)
                  .join(' ')}
                aria-current={selected ? 'true' : undefined}
              >
                <span className="game-emoji" aria-hidden="true">
                  {game.emoji}
                </span>
                <h2>{game.name}</h2>
                <p>{game.description}</p>
                {!game.available && <span className="badge">Coming soon</span>}
              </li>
            );
          })}
        </ol>
      </div>

      <footer className="library-footer">
        <p className="hint">
          {leader
            ? `${leader.name} is choosing on their phone… arrows to move, OK to open a tab or play`
            : ''}
        </p>
      </footer>
    </main>
  );
}

/** Everyone's avatar, in join order. Players who join while the menu is up pop in. */
function NavPlayers({ players, leaderId }: { players: PublicPlayer[]; leaderId: string | null }) {
  // Those here when the menu opened don't animate. Anyone after that is remembered as arrived,
  // so their class (and its animation) stays put while the leader browses.
  const [known, setKnown] = useState(() => new Set(players.map((p) => p.id)));
  const [arrived, setArrived] = useState(() => new Set<string>());
  const newcomers = players.filter((p) => !known.has(p.id)).map((p) => p.id);
  if (newcomers.length > 0) {
    // Updating state while rendering: React re-renders straight away, before painting
    setKnown(new Set([...known, ...newcomers]));
    setArrived(new Set([...arrived, ...newcomers]));
  }

  return (
    <ul className="nav-players" aria-label="Players">
      {players.map((player) => {
        const isNew = arrived.has(player.id);
        return (
          <li
            key={player.id}
            title={player.name}
            aria-label={player.name}
            className={[isNew && 'arrived', !player.connected && 'away'].filter(Boolean).join(' ')}
          >
            <PlayerAvatar avatar={player.avatar} size={44} leader={player.id === leaderId} />
          </li>
        );
      })}
    </ul>
  );
}
