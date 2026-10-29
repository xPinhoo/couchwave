import type { DrawHostView, LobbyState, Stroke } from '@couchwave/shared';
import type { HostGame } from '../useHostRoom';
import { useCountdown } from '../useCountdown';
import { DrawCanvas } from './DrawCanvas';
import { FinalScores } from './FinalScores';
import { PlayerAvatar } from './PlayerAvatar';
import { Gained, PlayerTag, type PlayerLookup } from './PlayerTag';

interface DrawHostProps {
  game: HostGame<DrawHostView>;
  lobby: LobbyState;
  strokes: Stroke[];
}

/** Draw & Guess on the TV: the drawing, live, with the hint and everyone's guesses. */
export function DrawHost({ game, lobby, strokes }: DrawHostProps) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  const playerOf: PlayerLookup = (id) => lobby.players.find((p) => p.id === id);

  if (view.phase === 'finished') {
    return (
      <FinalScores
        leaderboard={view.leaderboard}
        players={lobby.players}
        leaderId={lobby.leaderId}
      />
    );
  }

  const artist = playerOf(view.artistId);
  const artistName = artist?.name ?? 'Someone';

  return (
    <main className="draw">
      <header className="trivia-header">
        <span className="eyebrow">
          🎨 Draw & Guess · Turn {view.turn}/{view.totalTurns}
        </span>
        {/* Hidden rather than removed during the reveal, so the layout doesn't jump */}
        <span
          className="timer"
          aria-label="Seconds left"
          aria-hidden={view.phase === 'reveal'}
          style={view.phase === 'reveal' ? { visibility: 'hidden' } : undefined}
        >
          {Math.ceil(msLeft / 1000)}
        </span>
        <span className="eyebrow">Room {lobby.roomCode}</span>
      </header>

      <div className="draw-layout">
        <div className="draw-stage">
          <DrawCanvas strokes={view.phase === 'choosing' ? [] : strokes} />
          {view.phase === 'choosing' && (
            <div className="draw-overlay">
              {artist && <PlayerAvatar avatar={artist.avatar} size={120} />}
              <p>{artistName} is choosing a word…</p>
            </div>
          )}
          {view.phase === 'reveal' && (
            <p className="draw-answer">
              It was <strong>{view.hint}</strong>
            </p>
          )}
        </div>

        <aside className="draw-side">
          <PlayerTag player={artist} size={44} />
          <p className="hint">{view.phase === 'reveal' ? 'drew this' : 'is drawing'}</p>

          {view.phase === 'drawing' && (
            <p className="draw-hint" aria-label="Word to guess">
              {view.hint}
            </p>
          )}

          {view.phase === 'reveal' ? (
            <ol className="leaderboard" aria-label="Leaderboard">
              {view.leaderboard.slice(0, 5).map((entry) => (
                <li key={entry.playerId}>
                  <PlayerTag player={playerOf(entry.playerId)} />
                  <span className="score">
                    {entry.score}
                    <Gained points={entry.gained} />
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <>
              {view.guessedIds.length > 0 && (
                <ul className="draw-guessed" aria-label="Guessed it">
                  {view.guessedIds.map((id) => (
                    <li key={id}>
                      <PlayerTag player={playerOf(id)} size={28} /> ✓
                    </li>
                  ))}
                </ul>
              )}
              <ul className="draw-feed" aria-label="Guesses">
                {view.feed.map((guess, i) => (
                  <li key={`${i}-${guess.text}`}>
                    <span className="draw-feed-name">{playerOf(guess.playerId)?.name}</span>{' '}
                    {guess.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
