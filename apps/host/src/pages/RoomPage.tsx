import { Link } from 'react-router';
import { Lobby } from '../components/Lobby';
import { TriviaHost } from '../components/TriviaHost';
import { CONTROLLER_URL } from '../config';
import { useHostRoom } from '../useHostRoom';

/** The TV screen. It only displays; the leader controls everything from their phone. */
export function RoomPage() {
  const { room, game } = useHostRoom();

  switch (room.status) {
    case 'connecting':
      return <p className="status">Connecting…</p>;
    case 'error':
      return (
        <div className="status error">
          <p>{room.message}</p>
          <Link to="/">Back home</Link>
        </div>
      );
    case 'ready':
      return room.lobby.status === 'playing' && game ? (
        <TriviaHost game={game} lobby={room.lobby} />
      ) : (
        <Lobby lobby={room.lobby} controllerUrl={CONTROLLER_URL} />
      );
  }
}
