import type { LobbyState } from '@couchwave/shared';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';

interface LobbyProps {
  lobby: LobbyState;
  controllerUrl: string;
  /** Resolves with an error code, or null once the game started. */
  onStart: () => Promise<string | null>;
}

export function Lobby({ lobby, controllerUrl, onStart }: LobbyProps) {
  const joinUrl = `${controllerUrl}/?room=${lobby.roomCode}`;
  const emptySeats = lobby.maxPlayers - lobby.players.length;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setStarting(true);
    setError(await onStart());
    setStarting(false);
  }

  return (
    <main className="lobby">
      <section className="join">
        <p className="eyebrow">Join on your phone</p>
        <h1 className="room-code" aria-label="Room code">
          {lobby.roomCode}
        </h1>
        <div className="qr">
          <QRCodeSVG value={joinUrl} size={200} marginSize={2} title="Scan to join" />
        </div>
        <p className="hint">{joinUrl}</p>
      </section>

      <section className="players" aria-label="Players">
        <h2>
          Players {lobby.players.length}/{lobby.maxPlayers}
        </h2>
        <ul>
          {lobby.players.map((player) => (
            <li key={player.id} className={player.connected ? 'seat taken' : 'seat taken away'}>
              {player.name}
              {!player.connected && <span className="seat-status">reconnecting…</span>}
            </li>
          ))}
          {Array.from({ length: emptySeats }, (_, i) => (
            <li key={`empty-${i}`} className="seat" aria-hidden="true" />
          ))}
        </ul>
        {lobby.players.length === 0 ? (
          <p className="hint">Waiting for players…</p>
        ) : (
          <div className="start">
            <button
              type="button"
              className="primary-button"
              disabled={starting}
              onClick={() => void start()}
            >
              Start trivia
            </button>
            {error && <p className="error">Couldn't start the game ({error}).</p>}
          </div>
        )}
      </section>
    </main>
  );
}
