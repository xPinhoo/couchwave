import {
  colorArtUrl,
  colorCategory,
  colorPuzzle,
  type ColorHostView,
  type LobbyState,
} from '@couchwave/shared';
import type { HostGame } from '../useHostRoom';
import { useCountdownTicks } from '../sound';
import { useCountdown } from '../useCountdown';
import { FinalScores } from './FinalScores';
import { PlayerAvatar } from './PlayerAvatar';
import { Gained, PlayerTag, type PlayerLookup } from './PlayerTag';

/** Guess the Color on the TV: the picture with its colour missing, then how close everyone got. */
export function ColorHost({ game, lobby }: { game: HostGame<ColorHostView>; lobby: LobbyState }) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  useCountdownTicks(msLeft, view.phase === 'countdown' || view.phase === 'pick');
  const playerOf: PlayerLookup = (id) => lobby.players.find((p) => p.id === id);
  const category = colorCategory(view.category);

  if (view.phase === 'finished') {
    return (
      <FinalScores
        leaderboard={view.leaderboard}
        players={lobby.players}
        leaderId={lobby.leaderId}
      />
    );
  }

  if (view.phase === 'countdown') {
    const seconds = Math.ceil(msLeft / 1000);
    return (
      <main className="trivia">
        <header className="trivia-header">
          <span className="eyebrow">
            {category.emoji} {category.name} · {view.totalRounds} rounds
          </span>
          <span className="eyebrow">Room {lobby.roomCode}</span>
        </header>
        <section className="trivia-countdown">
          <h1>Get ready!</h1>
          {/* Keyed so each second pops in */}
          <span key={seconds} className="countdown-number" aria-label="Starting in">
            {seconds}
          </span>
          <p className="hint">Mix the missing colour on your phone. The closer, the more points!</p>
        </section>
      </main>
    );
  }

  const puzzle = colorPuzzle(view.puzzleId);
  return (
    <main className="trivia">
      <header className="trivia-header">
        <span className="eyebrow">
          {category.emoji} {category.name} · Round {view.round}/{view.totalRounds}
        </span>
        {view.phase === 'pick' && (
          <span className="timer" aria-label="Seconds left">
            {Math.ceil(msLeft / 1000)}
          </span>
        )}
        <span className="eyebrow">Room {lobby.roomCode}</span>
      </header>

      <section className={view.phase === 'reveal' ? 'color-stage revealed' : 'color-stage'}>
        <figure className="color-picture">
          {puzzle && (
            <img
              src={colorArtUrl(puzzle, view.answer)}
              alt={view.answer ? view.name : `${view.name}, with its colour missing`}
            />
          )}
          <figcaption>
            <h1>{view.name}</h1>
            {view.answer ? (
              <p className="color-answer">
                <span className="color-swatch" style={{ background: view.answer }} />
                <code>{view.answer.toUpperCase()}</code>
              </p>
            ) : (
              <p className="hint">What colour is the missing part?</p>
            )}
          </figcaption>
        </figure>

        {view.phase === 'reveal' && <Results view={view} playerOf={playerOf} />}
      </section>

      {view.phase === 'pick' && (
        <footer className="trivia-footer">
          <ul className="answered-row" aria-label="Who has locked in">
            {view.playerIds.map((id) => {
              const player = playerOf(id);
              const locked = view.lockedIds.includes(id);
              return (
                <li key={id} className={locked ? 'answered' : undefined}>
                  <span className="avatar-badge">
                    {player && <PlayerAvatar avatar={player.avatar} size={52} />}
                    {locked && (
                      <span className="check" aria-label="Locked in">
                        ✓
                      </span>
                    )}
                  </span>
                  <span>{player?.name ?? 'Player'}</span>
                </li>
              );
            })}
          </ul>
          <span className="hint">
            {view.lockedIds.length}/{view.playerIds.length} locked in
          </span>
        </footer>
      )}
    </main>
  );
}

function Results({ view, playerOf }: { view: ColorHostView; playerOf: PlayerLookup }) {
  return (
    <ol className="color-results" aria-label="How close everyone got">
      {view.results.map((result) => {
        const total = view.leaderboard.find((entry) => entry.playerId === result.playerId);
        return (
          <li key={result.playerId}>
            <span
              className={result.color ? 'color-swatch' : 'color-swatch none'}
              style={result.color ? { background: result.color } : undefined}
            />
            <span className="color-result-who">
              <PlayerTag player={playerOf(result.playerId)} />
              <code>{result.color ? result.color.toUpperCase() : 'No colour'}</code>
            </span>
            <span className="color-accuracy">{result.accuracy}%</span>
            <span className="score">
              {total?.score ?? 0}
              <Gained points={result.points} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
