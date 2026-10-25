import { CHOICE_STYLES, type LobbyState, type TriviaHostView } from '@couchwave/shared';
import type { CSSProperties } from 'react';
import type { HostGame } from '../useHostRoom';
import { useCountdown } from '../useCountdown';

interface TriviaHostProps {
  game: HostGame;
  lobby: LobbyState;
}

/** Display only: the leader ends the game or goes back to the lobby from their phone. */
export function TriviaHost({ game, lobby }: TriviaHostProps) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  const nameOf = (id: string) => lobby.players.find((p) => p.id === id)?.name ?? 'Player';

  if (view.phase === 'finished') {
    const leader = lobby.leaderId ? nameOf(lobby.leaderId) : null;
    return <FinalScores view={view} nameOf={nameOf} leader={leader} />;
  }

  const revealed = view.phase === 'reveal';

  return (
    <main className="trivia">
      <header className="trivia-header">
        <span className="eyebrow">
          Question {view.round}/{view.totalRounds}
        </span>
        {!revealed && (
          <span className="timer" aria-label="Seconds left">
            {Math.ceil(msLeft / 1000)}
          </span>
        )}
        <span className="eyebrow">Room {lobby.roomCode}</span>
      </header>

      <h1 className="prompt">{view.prompt}</h1>

      <ol className="choices" aria-label="Choices">
        {view.choices.map((choice, i) => {
          const style = CHOICE_STYLES[i];
          const isCorrect = revealed && i === view.correctChoice;
          const className = ['choice', revealed && !isCorrect && 'dimmed', isCorrect && 'correct']
            .filter(Boolean)
            .join(' ');
          return (
            <li key={i} className={className} style={{ '--choice': style?.color } as CSSProperties}>
              <span className="choice-symbol" aria-hidden="true">
                {style?.symbol}
              </span>
              <span className="choice-text">{choice}</span>
              {revealed && view.choiceCounts && (
                <span className="choice-count">{view.choiceCounts[i]}</span>
              )}
            </li>
          );
        })}
      </ol>

      {revealed ? (
        <ol className="leaderboard" aria-label="Leaderboard">
          {view.leaderboard.slice(0, 5).map((entry) => (
            <li key={entry.playerId}>
              <span>{nameOf(entry.playerId)}</span>
              <span className="score">
                {entry.score}
                {entry.gained > 0 && <span className="gained"> +{entry.gained}</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <footer className="trivia-footer">
          <span>
            {view.answeredCount}/{view.playerCount} answered
          </span>
        </footer>
      )}
    </main>
  );
}

function FinalScores({
  view,
  nameOf,
  leader,
}: {
  view: TriviaHostView;
  nameOf: (id: string) => string;
  leader: string | null;
}) {
  return (
    <main className="final">
      <p className="eyebrow">Final scores</p>
      <ol className="podium" aria-label="Final scores">
        {view.leaderboard.map((entry, i) => (
          <li key={entry.playerId} className={i === 0 ? 'winner' : undefined}>
            <span className="place">{i + 1}</span>
            <span>{nameOf(entry.playerId)}</span>
            <span className="score">{entry.score}</span>
          </li>
        ))}
      </ol>
      {leader && <p className="hint">{leader} can start another round from their phone</p>}
    </main>
  );
}
