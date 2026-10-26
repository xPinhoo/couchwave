import {
  CHOICE_STYLES,
  triviaTopic,
  type LeaderboardEntry,
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

/** "+850" in green, "−250" in red. */
function Gained({ points }: { points: number }) {
  if (points === 0) return null;
  return (
    <span className={points > 0 ? 'gained' : 'lost'}>
      {' '}
      {points > 0 ? `+${points}` : `−${Math.abs(points)}`}
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
  const topic = triviaTopic(view.topic);

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

/** Second, first and third place, in that order, so the winner stands in the middle. */
const PODIUM_ORDER = [1, 0, 2];

function FinalScores({
  view,
  playerOf,
  leader,
}: {
  view: TriviaHostView;
  playerOf: PlayerLookup;
  leader: string | null;
}) {
  const top = view.leaderboard.slice(0, 3);
  const rest = view.leaderboard.slice(3);

  return (
    <main className="final">
      <p className="eyebrow">Final scores</p>

      <ol className="podium" aria-label="Podium">
        {PODIUM_ORDER.map((place) => {
          const entry: LeaderboardEntry | undefined = top[place];
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
