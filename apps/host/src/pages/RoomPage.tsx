import { Link } from 'react-router';
import { Library } from '../components/Library';
import { Lobby } from '../components/Lobby';
import { Reactions } from '../components/Reactions';
import { TriviaHost } from '../components/TriviaHost';
import { TriviaSetup } from '../components/TriviaSetup';
import { CONTROLLER_URL } from '../config';
import { useHostRoom } from '../useHostRoom';

/** The TV screen. It only displays; the leader controls everything from their phone. */
export function RoomPage() {
  const { room, game, reactions } = useHostRoom();

  switch (room.status) {
    case 'connecting':
      return <p className="status">Connecting…</p>;
    case 'closed':
      return (
        <div className="status">
          <p>This room was closed.</p>
          <Link to="/">Back home</Link>
        </div>
      );
    case 'error':
      return (
        <div className="status error">
          <p>{room.message}</p>
          <Link to="/">Back home</Link>
        </div>
      );
    case 'ready': {
      const { lobby } = room;
      return (
        <>
          {lobby.status === 'playing' && game ? (
            <TriviaHost game={game} lobby={lobby} />
          ) : lobby.status === 'library' ? (
            <Library lobby={lobby} />
          ) : lobby.status === 'setup' ? (
            <TriviaSetup lobby={lobby} />
          ) : (
            <Lobby lobby={lobby} controllerUrl={CONTROLLER_URL} />
          )}
          <Reactions reactions={reactions} players={lobby.players} />
        </>
      );
    }
  }
}
