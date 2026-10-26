import { triviaTopic, type LobbyState } from '@couchwave/shared';
import { PlayerAvatar } from './PlayerAvatar';

interface TriviaSetupProps {
  lobby: LobbyState;
}

/** The pre-game screen: the host's settings, live, and who has pressed Ready. */
export function TriviaSetup({ lobby }: TriviaSetupProps) {
  const setup = lobby.setup;
  if (!setup) return null;

  const { options, readyIds } = setup;
  const topic = triviaTopic(options.topic);
  const leader = lobby.players.find((p) => p.id === lobby.leaderId);
  const leaderReady = leader !== undefined && readyIds.includes(leader.id);
  const connected = lobby.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => readyIds.includes(p.id)).length;

  return (
    <main className="setup">
      <header className="setup-header">
        <p className="eyebrow">Room {lobby.roomCode}</p>
        <h1>Quick-fire trivia</h1>
      </header>

      <dl className="setup-options" aria-label="Settings">
        <div>
          <dt>Topic</dt>
          <dd>
            <span aria-hidden="true">{topic.emoji}</span> {topic.name}
          </dd>
        </div>
        <div>
          <dt>Time per question</dt>
          <dd>{options.secondsPerQuestion}s</dd>
        </div>
        <div>
          <dt>Questions</dt>
          <dd>{options.questionCount}</dd>
        </div>
      </dl>

      <section aria-label="Ready check">
        <ul className="ready-list">
          {lobby.players.map((player) => {
            const ready = readyIds.includes(player.id);
            return (
              <li
                key={player.id}
                className={[ready && 'ready', !player.connected && 'away']
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="avatar-badge">
                  <PlayerAvatar avatar={player.avatar} size={72} />
                  {ready && (
                    <span className="check" aria-label="Ready">
                      ✓
                    </span>
                  )}
                </span>
                <span>{player.name}</span>
              </li>
            );
          })}
        </ul>
        <p className="hint setup-status">
          {!leaderReady
            ? `${leader?.name ?? 'The host'} is choosing the settings…`
            : `Waiting for everyone to press Ready (${readyCount}/${connected.length})`}
        </p>
      </section>
    </main>
  );
}
