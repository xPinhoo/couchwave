import { GAMES, type LobbyState } from '@couchwave/shared';
import { PlayerAvatar } from './PlayerAvatar';

interface LibraryProps {
  lobby: LobbyState;
}

/** The games menu. The leader moves the highlight and picks a game from their phone. */
export function Library({ lobby }: LibraryProps) {
  const leader = lobby.players.find((p) => p.id === lobby.leaderId);

  return (
    <main className="library">
      <header className="library-header">
        <p className="eyebrow">Room {lobby.roomCode}</p>
        <h1>Choose a game</h1>
      </header>

      <ol className="game-cards" aria-label="Games">
        {GAMES.map((game, i) => {
          const selected = i === lobby.selectedGame;
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

      <footer className="library-footer">
        <ul className="avatar-row" aria-label="Players">
          {lobby.players.map((player) => (
            <li key={player.id} className={player.connected ? undefined : 'away'}>
              <PlayerAvatar avatar={player.avatar} size={44} />
              <span>{player.name}</span>
            </li>
          ))}
        </ul>
        <p className="hint">
          {leader ? `${leader.name} is choosing on their phone… ◀ ▶ to browse, then Select` : ''}
        </p>
      </footer>
    </main>
  );
}
