import {
  CHOICE_STYLES,
  triviaTopic,
  type LobbyState,
  type TriviaHostView,
} from '@couchwave/shared';
import type { CSSProperties } from 'react';
import type { HostGame } from '../useHostRoom';
import { useCountdownTicks } from '../sound';
import { useCountdown } from '../useCountdown';
import { FinalScores } from './FinalScores';
import { PlayerAvatar } from './PlayerAvatar';
import { Gained, PlayerTag, type PlayerLookup } from './PlayerTag';

interface TriviaHostProps {
  game: HostGame<TriviaHostView>;
  lobby: LobbyState;
}

/** Display only: the leader ends the game or goes back to the library from their phone. */
export function TriviaHost({ game, lobby }: TriviaHostProps) {
  const { view, serverTime } = game.update;
  const msLeft = useCountdown(view.endsAt, serverTime, game.receivedAt);
  useCountdownTicks(msLeft, view.phase === 'countdown' || view.phase === 'question');
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

  const revealed = view.phase === 'reveal';
  const topic = triviaTopic(view.topic);

  if (view.phase === 'countdown') {
    const seconds = Math.ceil(msLeft / 1000);
    return (
      <main className="trivia">
        <header className="trivia-header">
          <span className="eyebrow">
            {topic.emoji} {topic.name} · {view.totalRounds} questions
          </span>
          <span className="eyebrow">Room {lobby.roomCode}</span>
        </header>
        <section className="trivia-countdown">
          <h1>Get ready!</h1>
          {/* Keyed so each second pops in */}
          <span key={seconds} className="countdown-number" aria-label="Starting in">
            {seconds}
          </span>
          <p className="hint">Answer on your phone. Fast and right scores the most!</p>
        </section>
      </main>
    );
  }

  return (
    <main className="trivia">
      <header className="trivia-header">
        <span className="eyebrow">
          {topic.emoji} {topic.name} · Question {view.round}/{view.totalRounds}
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
          const pickers = (view.picks ?? []).filter((pick) => pick.choice === i);
          const className = ['choice', revealed && !isCorrect && 'dimmed', isCorrect && 'correct']
            .filter(Boolean)
            .join(' ');
          return (
            <li key={i} className={className} style={{ '--choice': style?.color } as CSSProperties}>
              <span className="choice-symbol" aria-hidden="true">
                {style?.symbol}
              </span>
              <span className="choice-text">{choice}</span>
              {pickers.length > 0 && (
                <span className="pickers" aria-label={`${pickers.length} picked this`}>
                  {pickers.map(({ playerId }) => {
                    const player = playerOf(playerId);
                    return player ? (
                      <PlayerAvatar key={playerId} avatar={player.avatar} size={40} />
                    ) : null;
                  })}
                </span>
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
                <Gained points={entry.gained} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <footer className="trivia-footer">
          <ul className="answered-row" aria-label="Who has answered">
            {view.playerIds.map((id) => {
              const player = playerOf(id);
              const answered = view.answeredIds.includes(id);
              return (
                <li key={id} className={answered ? 'answered' : undefined}>
                  <span className="avatar-badge">
                    {player && <PlayerAvatar avatar={player.avatar} size={52} />}
                    {answered && (
                      <span className="check" aria-label="Answered">
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
            {view.answeredIds.length}/{view.playerIds.length} answered
          </span>
        </footer>
      )}
    </main>
  );
}
