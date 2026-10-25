import type { LobbyState } from '@couchwave/shared';
import { QRCodeSVG } from 'qrcode.react';

interface LobbyProps {
  lobby: LobbyState;
  controllerUrl: string;
}

export function Lobby({ lobby, controllerUrl }: LobbyProps) {
  const joinUrl = `${controllerUrl}/?room=${lobby.roomCode}`;
  const emptySeats = lobby.maxPlayers - lobby.players.length;

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
        {lobby.players.length === 0 && <p className="hint">Waiting for players…</p>}
      </section>
    </main>
  );
}
