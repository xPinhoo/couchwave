import {
  CHOICE_STYLES,
  type LobbyState,
  type PublicPlayer,
  type TriviaHostView,
} from '@couchwave/shared';
import type { CSSProperties } from 'react';
import type { HostGame } from '../useHostRoom';
import { useCountdown } from '../useCountdown';
import { PlayerAvatar } from './PlayerAvatar';

interface TriviaHostProps {
  game: HostGame;
  lobby: LobbyState;
}

type PlayerLookup = (id: string) => PublicPlayer | undefined;

/** Avatar and name; players who left mid-game show as a plain "Player". */
function PlayerTag({ player, size = 32 }: { player: PublicPlayer | undefined; size?: number }) {
  return (
    <span className="player-tag">
      {player && <PlayerAvatar avatar={player.avatar} size={size} />}
      {player?.name ?? 'Player'}
    </span>
  );
}

/** Display only: the leader ends the game or goes back to the library from their phone. */
export function TriviaHost({ game, lobby }: TriviaHostProps) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  const playerOf: PlayerLookup = (id) => lobby.players.find((p) => p.id === id);

  if (view.phase === 'finished') {
    const leader = lobby.leaderId ? (playerOf(lobby.leaderId)?.name ?? null) : null;
    return <FinalScores view={view} playerOf={playerOf} leader={leader} />;
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
              <PlayerTag player={playerOf(entry.playerId)} />
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
  playerOf,
  leader,
}: {
  view: TriviaHostView;
  playerOf: PlayerLookup;
  leader: string | null;
}) {
  return (
    <main className="final">
      <p className="eyebrow">Final scores</p>
      <ol className="podium" aria-label="Final scores">
        {view.leaderboard.map((entry, i) => (
          <li key={entry.playerId} className={i === 0 ? 'winner' : undefined}>
            <span className="place">{i + 1}</span>
            <PlayerTag player={playerOf(entry.playerId)} size={i === 0 ? 48 : 36} />
            <span className="score">{entry.score}</span>
          </li>
        ))}
      </ol>
      {leader && <p className="hint">{leader} can pick the next game from their phone</p>}
    </main>
  );
}
