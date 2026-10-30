import { REACTIONS, type LobbyState } from '@couchwave/shared';
import { QRCodeSVG } from 'qrcode.react';
import { PlayerAvatar } from './PlayerAvatar';

interface LobbyProps {
  lobby: LobbyState;
  controllerUrl: string;
}

export function Lobby({ lobby, controllerUrl }: LobbyProps) {
  const joinUrl = `${controllerUrl}/?room=${lobby.roomCode}`;
  const emptySeats = lobby.maxPlayers - lobby.players.length;
  const leader = lobby.players.find((p) => p.id === lobby.leaderId);

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
              <PlayerAvatar
                avatar={player.avatar}
                size={44}
                leader={player.id === lobby.leaderId}
              />
              <span className="seat-name">
                {player.name}
                {!player.connected && <span className="seat-status">reconnecting…</span>}
              </span>
            </li>
          ))}
          {Array.from({ length: emptySeats }, (_, i) => (
            <li key={`empty-${i}`} className="seat" aria-hidden="true" />
          ))}
        </ul>
        <p className="hint lobby-status">
          {leader
            ? `Waiting for ${leader.name} to start the game from their phone…`
            : 'Waiting for players… the first to join becomes the host 👑'}
        </p>
        {lobby.players.length > 0 && (
          <p className="hint">Bored? Send reactions from your phone {REACTIONS.slice(0, 3)}</p>
        )}
      </section>
    </main>
  );
}
