import { Link } from 'react-router';
import { DrawHost } from '../components/DrawHost';
import { Library } from '../components/Library';
import { Lobby } from '../components/Lobby';
import { PhoneHost } from '../components/PhoneHost';
import { Reactions } from '../components/Reactions';
import { SetupScreen } from '../components/SetupScreen';
import { TriviaHost } from '../components/TriviaHost';
import { CONTROLLER_URL } from '../config';
import { isGame, useHostRoom } from '../useHostRoom';

/** The TV screen. It only displays; the leader controls everything from their phone. */
export function RoomPage() {
  const { room, game, reactions, strokes } = useHostRoom();

  switch (room.status) {
    case 'connecting':
      return room.waking ? (
        <div className="status" role="status">
          <p>Waking up the server…</p>
          <p className="status-hint">
            It sleeps when nobody is playing. This takes up to a minute.
          </p>
        </div>
      ) : (
        <p className="status">Connecting…</p>
      );
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
          {lobby.status === 'playing' && game && isGame(game, 'trivia') ? (
            <TriviaHost game={game} lobby={lobby} />
          ) : lobby.status === 'playing' && game && isGame(game, 'draw') ? (
            <DrawHost game={game} lobby={lobby} strokes={strokes} />
          ) : lobby.status === 'playing' && game && isGame(game, 'phone') ? (
            <PhoneHost game={game} lobby={lobby} />
          ) : lobby.status === 'library' ? (
            <Library lobby={lobby} />
          ) : lobby.status === 'setup' ? (
            <SetupScreen lobby={lobby} />
          ) : (
            <Lobby lobby={lobby} controllerUrl={CONTROLLER_URL} />
          )}
          <Reactions reactions={reactions} players={lobby.players} />
        </>
      );
    }
  }
}
