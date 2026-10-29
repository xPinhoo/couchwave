import { gameInfo, triviaTopic, type GameSetup, type LobbyState } from '@couchwave/shared';
import { PlayerAvatar } from './PlayerAvatar';

interface SetupScreenProps {
  lobby: LobbyState;
}

/** The settings as label/value rows, for whichever game is being set up. */
function settingRows(setup: GameSetup): { label: string; value: string }[] {
  if (setup.gameId === 'draw') {
    const { secondsToDraw, rounds } = setup.options;
    return [
      { label: 'Time to draw', value: `${secondsToDraw}s` },
      { label: 'Rounds', value: String(rounds) },
    ];
  }
  const { topic, secondsPerQuestion, questionCount } = setup.options;
  const { emoji, name } = triviaTopic(topic);
  return [
    { label: 'Topic', value: `${emoji} ${name}` },
    { label: 'Time per question', value: `${secondsPerQuestion}s` },
    { label: 'Questions', value: String(questionCount) },
  ];
}

/** The pre-game screen: the host's settings, live, and who has pressed Ready. */
export function SetupScreen({ lobby }: SetupScreenProps) {
  const setup = lobby.setup;
  if (!setup) return null;

  const game = gameInfo(setup.gameId);
  const { readyIds } = setup;
  const leader = lobby.players.find((p) => p.id === lobby.leaderId);
  const leaderReady = leader !== undefined && readyIds.includes(leader.id);
  const connected = lobby.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => readyIds.includes(p.id)).length;
  const missing = game.minPlayers - connected.length;

  return (
    <main className="setup">
      <header className="setup-header">
        <p className="eyebrow">Room {lobby.roomCode}</p>
        <h1>
          <span aria-hidden="true">{game.emoji}</span> {game.name}
        </h1>
      </header>

      <dl className="setup-options" aria-label="Settings">
        {settingRows(setup).map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
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
          {missing > 0
            ? `${game.name} needs at least ${game.minPlayers} players. Join with room code ${lobby.roomCode}`
            : !leaderReady
              ? `${leader?.name ?? 'The host'} is choosing the settings…`
              : `Waiting for everyone to press Ready (${readyCount}/${connected.length})`}
        </p>
      </section>
    </main>
  );
}
